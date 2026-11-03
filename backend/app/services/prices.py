"""Price history that is fetched once and then kept.

Free price APIs allow a few hundred calls a day, so the only way to serve a public site on them is
to treat a provider as a source to *copy from*, not to *ask on every request*.
``StoredPriceProvider`` wraps any ``PriceProvider``:

- A symbol's history is fetched in full once and stored permanently (see ``PriceRepository``).
- After that, a month later, only the newest months are requested and appended.
- Concurrent requests for the same symbol share one provider call.
- If the provider fails but we hold older data, that data is served instead of an error.
- A failing symbol is left alone for a minute, so an outage costs one call per minute, not one per
  request.

Slow network calls never happen inside a database transaction (the database closes transactions
that sit idle for ten seconds), so each step opens its own short session.
"""

import logging
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from app.core.cache import AsyncTTLCache
from app.core.errors import AppError, UpstreamError
from app.db.engine import Database
from app.domain.models import PriceHistory
from app.domain.months import last_complete_month_end, month_index
from app.providers.base import PriceProvider
from app.repositories.prices import PriceRepository, SeriesInfo

logger = logging.getLogger(__name__)

# Without a database the history is held in memory instead (one copy per symbol, bounded).
MEMORY_TTL = 6 * 3600.0
MEMORY_STALE = 7 * 86400.0
MEMORY_ENTRIES = 512
# Cooldown bookkeeping is bounded too, so a stream of bad symbols cannot grow it without limit.
COOLDOWN_ENTRIES = 1024


@dataclass(frozen=True, slots=True)
class _Stored:
    info: SeriesInfo
    history: PriceHistory


def _utc_now() -> datetime:
    return datetime.now(UTC)


class StoredPriceProvider:
    def __init__(
        self,
        upstream: PriceProvider,
        database: Database | None,
        *,
        now: Callable[[], datetime] = _utc_now,
        refresh_after: timedelta = timedelta(hours=12),
        failure_cooldown: float = 60.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._upstream = upstream
        self._database = database
        self._now = now
        self._refresh_after = refresh_after
        self._cooldown = failure_cooldown
        self._clock = clock
        self._memory: AsyncTTLCache[str, PriceHistory] = AsyncTTLCache(max_entries=MEMORY_ENTRIES)
        # Shares one refresh between concurrent requests. The result is not kept (ttl 0): the
        # database is the cache.
        self._refreshing: AsyncTTLCache[str, None] = AsyncTTLCache(max_entries=COOLDOWN_ENTRIES)
        self._failed_at: dict[str, float] = {}

    @property
    def source(self) -> str:
        return self._upstream.source

    async def monthly_history(self, symbol: str, *, since: date | None = None) -> PriceHistory:
        """The whole stored series. ``since`` is accepted for the interface and ignored: this
        class decides for itself how much to ask the provider for."""
        symbol = symbol.upper()
        database = self._database
        if database is None:
            return await self._memory.get_or_load(
                symbol,
                lambda: self._upstream.monthly_history(symbol),
                ttl=MEMORY_TTL,
                stale_ttl=MEMORY_STALE,
            )

        stored = await self._read(database, symbol)
        if stored is not None and self._is_fresh(stored.info):
            return stored.history
        if self._cooling_down(symbol):
            return self._fallback(stored)

        try:
            await self._refreshing.get_or_load(
                symbol, lambda: self._refresh(database, symbol, stored), ttl=0
            )
        except AppError:
            self._remember_failure(symbol)
            if stored is None:
                raise
            logger.warning("serving stored prices after a failed refresh")
            return stored.history
        refreshed = await self._read(database, symbol)
        if refreshed is None:  # cannot happen: the refresh just saved the series
            msg = "Price history could not be stored."
            raise UpstreamError(msg)
        return refreshed.history

    # -- internals --------------------------------------------------------------------------

    def _is_fresh(self, info: SeriesInfo) -> bool:
        if info.source != self._upstream.source:
            return False  # stored from another source (for example sample data): fetch again
        now = self._now()
        last_complete = last_complete_month_end(now.date())
        if info.latest_month is not None and month_index(info.latest_month) >= month_index(
            last_complete
        ):
            return True  # we already hold the newest completed month
        # Otherwise the provider may simply not have it (delisted, new listing). If we asked after
        # that month had settled, do not ask again for a while.
        settled = last_complete + timedelta(days=2)
        return info.refreshed_at.date() >= settled and now - info.refreshed_at < self._refresh_after

    def _cooling_down(self, symbol: str) -> bool:
        failed = self._failed_at.get(symbol)
        return failed is not None and self._clock() - failed < self._cooldown

    def _remember_failure(self, symbol: str) -> None:
        self._failed_at.pop(symbol, None)
        self._failed_at[symbol] = self._clock()
        while len(self._failed_at) > COOLDOWN_ENTRIES:
            self._failed_at.pop(next(iter(self._failed_at)))  # oldest first

    @staticmethod
    def _fallback(stored: _Stored | None) -> PriceHistory:
        if stored is None:
            msg = "Price history is unavailable right now. Please try again shortly."
            raise UpstreamError(msg)
        return stored.history

    @staticmethod
    async def _read(database: Database, symbol: str) -> _Stored | None:
        async with database.session() as session:
            repo = PriceRepository(session)
            info = await repo.info(symbol)
            if info is None:
                return None
            months = await repo.months(symbol)
        return _Stored(info, PriceHistory(symbol=symbol, source=info.source, prices=tuple(months)))

    async def _refresh(self, database: Database, symbol: str, stored: _Stored | None) -> None:
        info = stored.info if stored is not None else None
        resume_from = (
            info.latest_month if info is not None and info.source == self._upstream.source else None
        )
        fetched = await self._upstream.monthly_history(symbol, since=resume_from)  # no transaction
        async with database.session() as session:
            await PriceRepository(session).save(symbol, fetched.source, fetched.prices)
