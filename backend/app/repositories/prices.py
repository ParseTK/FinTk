"""Persistence for monthly price history. The only place that knows the price tables' SQL."""

from collections.abc import Iterator, Sequence
from datetime import date, datetime
from itertools import batched

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MonthlyPrice, PriceSeries
from app.domain.models import MonthlyPrice as MonthlyPriceValue

# asyncpg allows 32,767 bind parameters per statement; 3 per row keeps a batch far below that and
# keeps each statement (and the memory it needs) a bounded size however long the history is.
BATCH_SIZE = 1000


class PriceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

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
