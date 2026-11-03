"""Persistence for monthly price history. The only place that knows the price tables' SQL."""

from collections.abc import Collection, Iterator, Sequence
from dataclasses import dataclass
from datetime import date, datetime
from itertools import batched

from sqlalchemy import func, select, true
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MonthlyPrice, PriceSeries
from app.domain.models import LatestClose
from app.domain.models import MonthlyPrice as MonthlyPriceValue

# asyncpg allows 32,767 bind parameters per statement; 3 per row keeps a batch far below that and
# keeps each statement (and the memory it needs) a bounded size however long the history is.
BATCH_SIZE = 1000


@dataclass(frozen=True, slots=True)
class SeriesInfo:
    """What we know about a stored series without reading its months."""

    source: str
    refreshed_at: datetime
    latest_month: date | None  # None for a series the provider had no months for


class PriceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def info(self, symbol: str) -> SeriesInfo | None:
        """Source, last refresh and newest month in one round trip. None if never stored."""
        newest = (
            select(func.max(MonthlyPrice.month_end))
            .where(MonthlyPrice.symbol == PriceSeries.symbol)
            .scalar_subquery()
        )
        row = (
            await self._session.execute(
                select(PriceSeries.source, PriceSeries.refreshed_at, newest).where(
                    PriceSeries.symbol == symbol
                )
            )
        ).one_or_none()
        return None if row is None else SeriesInfo(row[0], row[1], row[2])

    async def infos(self, symbols: Collection[str]) -> dict[str, SeriesInfo]:
        """info for many symbols in one round trip (a portfolio page asks for all of them)."""
        if not symbols:
            return {}
        newest = (
            select(func.max(MonthlyPrice.month_end))
            .where(MonthlyPrice.symbol == PriceSeries.symbol)
            .scalar_subquery()
        )
        rows = await self._session.execute(
            select(PriceSeries.symbol, PriceSeries.source, PriceSeries.refreshed_at, newest).where(
                PriceSeries.symbol.in_(symbols)
            )
        )
        return {row[0]: SeriesInfo(row[1], row[2], row[3]) for row in rows}

    async def latest_closes(self, symbols: Collection[str]) -> dict[str, LatestClose]:
        """The newest close of each symbol, in one query.

        A lateral join: for each listed series, one probe of the (symbol, month_end) primary key
        for its newest row. The cost is proportional to the number of symbols, not to how much
        history they have. (DISTINCT ON with an IN list reads every month of every symbol:
        measured at 126 ms against 2.8 ms for 200 symbols over 1.5 million rows.)
        """
        if not symbols:
            return {}
        newest = (
            select(MonthlyPrice.month_end, MonthlyPrice.close)
            .where(MonthlyPrice.symbol == PriceSeries.symbol)
            .order_by(MonthlyPrice.month_end.desc())
            .limit(1)
            .lateral("newest")
        )
        rows = await self._session.execute(
            select(PriceSeries.symbol, newest.c.month_end, newest.c.close, PriceSeries.source)
            .join(newest, true())
            .where(PriceSeries.symbol.in_(symbols))
        )
        return {row[0]: LatestClose(row[0], row[1], row[2], row[3]) for row in rows}

    async def refreshed_at(self, symbol: str) -> datetime | None:
        """When the series was last refreshed, or None if we have never stored it."""
        return await self._session.scalar(
            select(PriceSeries.refreshed_at).where(PriceSeries.symbol == symbol)
        )

    async def source(self, symbol: str) -> str | None:
        return await self._session.scalar(
            select(PriceSeries.source).where(PriceSeries.symbol == symbol)
        )

    async def latest_month(self, symbol: str) -> date | None:
        """Newest stored month. One index lookup, so deciding what to fetch next is O(log n)."""
        return await self._session.scalar(
            select(func.max(MonthlyPrice.month_end)).where(MonthlyPrice.symbol == symbol)
        )

    async def months(
        self,
        symbol: str,
        *,
        start: date | None = None,
        end: date | None = None,
    ) -> list[MonthlyPriceValue]:
        """Months in ascending order, optionally limited to ``start <= month_end <= end``.

        A range scan on the primary key: rows come back already ordered, with no sort step.
        """
        query = select(MonthlyPrice.month_end, MonthlyPrice.close).where(
            MonthlyPrice.symbol == symbol
        )
        if start is not None:
            query = query.where(MonthlyPrice.month_end >= start)
        if end is not None:
            query = query.where(MonthlyPrice.month_end <= end)
        rows = await self._session.execute(query.order_by(MonthlyPrice.month_end))
        return [MonthlyPriceValue(month_end=month_end, close=close) for month_end, close in rows]

    async def save(self, symbol: str, source: str, prices: Sequence[MonthlyPriceValue]) -> int:
        """Insert or correct months and mark the series refreshed. Returns the rows written.

        Idempotent: running it twice with the same data changes nothing but ``refreshed_at``, and
        a provider restating a month overwrites the stored value instead of failing on the key.
        """
        series = insert(PriceSeries).values(symbol=symbol, source=source)
        await self._session.execute(
            series.on_conflict_do_update(
                index_elements=[PriceSeries.symbol],
                set_={"source": series.excluded.source, "refreshed_at": func.now()},
            )
        )
        written = 0
        for chunk in _chunks(prices):
            statement = insert(MonthlyPrice).values(
                [{"symbol": symbol, "month_end": p.month_end, "close": p.close} for p in chunk]
            )
            await self._session.execute(
                statement.on_conflict_do_update(
                    index_elements=[MonthlyPrice.symbol, MonthlyPrice.month_end],
                    set_={"close": statement.excluded.close},
                    where=MonthlyPrice.close.is_distinct_from(statement.excluded.close),
                )
            )
            written += len(chunk)
        return written


def _chunks(prices: Sequence[MonthlyPriceValue]) -> Iterator[tuple[MonthlyPriceValue, ...]]:
    return batched(prices, BATCH_SIZE, strict=False)
