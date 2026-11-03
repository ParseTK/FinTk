"""Crypto use case: the top coins plus two optional summaries, cached briefly in memory.

Licence: CoinMarketCap's terms allow storing its data only temporarily, so everything here lives in
process memory with short lifetimes and is never written to the database. Every visitor reads the
cache; the provider is called at most once per lifetime however many people look.

The listing is the essential part. The market totals and the Fear and Greed index are extras: if
one cannot be loaded the rest still answer and the page says which part is missing, instead of
looking complete.
"""

import asyncio
import logging
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

from app.core.cache import AsyncTTLCache
from app.core.errors import AppError
from app.domain.crypto import CryptoAsset, FearGreed, MarketTotals
from app.providers.base import CryptoProvider

logger = logging.getLogger(__name__)

TOP_N = 25
LISTINGS_TTL = 10 * 60.0
TOTALS_TTL = 10 * 60.0
FEAR_GREED_TTL = 60 * 60.0  # the index moves slowly
# An old copy may be served this long if a refresh fails. Short on purpose: stored data must stay
# temporary under the licence, and stale prices become misleading quickly.
STALE = 60 * 60.0

SUMMARY_NAMES = ("market totals", "fear and greed")


@dataclass(frozen=True, slots=True)
class CryptoOverview:
    assets: tuple[CryptoAsset, ...]
    as_of: datetime
    totals: MarketTotals | None
    fear_greed: FearGreed | None
    unavailable: tuple[str, ...]  # summaries that could not be loaded this time


class CryptoService:
    def __init__(
        self,
        provider: CryptoProvider,
        *,
        top: int = TOP_N,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._provider = provider
        self._top = top
        self._listings: AsyncTTLCache[str, tuple[tuple[CryptoAsset, ...], datetime]] = (
            AsyncTTLCache(max_entries=1, clock=clock)
        )
        self._totals: AsyncTTLCache[str, MarketTotals] = AsyncTTLCache(max_entries=1, clock=clock)
        self._fear_greed: AsyncTTLCache[str, FearGreed] = AsyncTTLCache(max_entries=1, clock=clock)

    @property
    def source(self) -> str:
        return self._provider.source

    async def overview(self) -> CryptoOverview:
        # The listing first and on its own: if it fails and nothing old is held, the error goes to
        # the caller and no extra calls are spent on a page that cannot be shown.
        assets, as_of = await self._listings.get_or_load(
            "top", self._load_listings, ttl=LISTINGS_TTL, stale_ttl=STALE
        )
        totals, fear_greed = await asyncio.gather(
            self._totals.get_or_load(
                "totals", self._provider.market_totals, ttl=TOTALS_TTL, stale_ttl=STALE
            ),
            self._fear_greed.get_or_load(
                "fear", self._provider.fear_greed, ttl=FEAR_GREED_TTL, stale_ttl=STALE
            ),
            return_exceptions=True,
        )
        down: list[str] = []
        kept_totals = self._summary(totals, SUMMARY_NAMES[0], down)
        kept_fear = self._summary(fear_greed, SUMMARY_NAMES[1], down)
        return CryptoOverview(
            assets=assets,
            as_of=as_of,
            totals=kept_totals,
            fear_greed=kept_fear,
            unavailable=tuple(down),
        )

    async def _load_listings(self) -> tuple[tuple[CryptoAsset, ...], datetime]:
        listings = await self._provider.listings(self._top)
        return listings.assets[: self._top], listings.as_of

    @staticmethod
    def _summary[T](result: T | BaseException, name: str, down: list[str]) -> T | None:
        if isinstance(result, BaseException):
            if isinstance(result, AppError):
                down.append(name)
                return None
            raise result  # not a provider failure: a bug, let it surface
        return result
