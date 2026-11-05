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
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from app.core.cache import AsyncTTLCache
from app.core.errors import AppError, NotFoundError
from app.domain.crypto import AnchorPrices, CryptoAsset, FearGreed, MarketTotals
from app.domain.crypto_markets import Composition, composition, percent_change
from app.domain.crypto_search import search_assets
from app.providers.base import CryptoProvider

logger = logging.getLogger(__name__)

TOP_N = 25  # how many coins the overview shows
# How many the one cached listing holds: the overview shows the first TOP_N, and search and coin
# pages use the rest. A 200-row page costs the same single credit, so this adds no provider calls.
FETCH_N = 200
LISTINGS_TTL = 10 * 60.0
TOTALS_TTL = 10 * 60.0
FEAR_GREED_TTL = 60 * 60.0  # the index moves slowly
# An old copy may be served this long if a refresh fails. Short on purpose: stored data must stay
# temporary under the licence, and stale prices become misleading quickly.
STALE = 60 * 60.0

SUMMARY_NAMES = ("market totals", "fear and greed")

# The markets view.
MAJORS = 10  # how many of the largest coins get a performance row
# Prices on two fixed days are all the history needed (ten coins cost one credit per day asked), and
# they barely change once fetched, so they are refreshed twice a day.
ANCHOR_TTL = 12 * 60 * 60.0
ANCHOR_STALE = 24 * 60 * 60.0
# The free plan allows twelve months of history. 358 days back stays safely inside it.
PAST_YEAR_DAYS = 358


@dataclass(frozen=True, slots=True)
class CryptoOverview:
    assets: tuple[CryptoAsset, ...]
    as_of: datetime
    totals: MarketTotals | None
    fear_greed: FearGreed | None
    unavailable: tuple[str, ...]  # summaries that could not be loaded this time


@dataclass(frozen=True, slots=True)
class MajorCoin:
    asset: CryptoAsset  # its 24 hour, 7 day, 30 day and 90 day changes come with the listing
    year_to_date: Decimal | None  # percent, from its price on the first day of the year
    past_year: Decimal | None  # percent, from its price about a year ago


@dataclass(frozen=True, slots=True)
class CryptoMarkets:
    majors: tuple[MajorCoin, ...]
    composition: Composition | None
    as_of: datetime
    year_start: date | None  # the day the year-to-date change is measured from
    past_year_start: date | None  # the day the past-year change is measured from
    unavailable: tuple[str, ...]  # parts that could not be loaded this time


class CryptoService:
    def __init__(
        self,
        provider: CryptoProvider,
        *,
        top: int = TOP_N,
        fetch: int = FETCH_N,
        clock: Callable[[], float] = time.monotonic,
        today: Callable[[], date] = lambda: datetime.now(UTC).date(),
    ) -> None:
        self._today = today
        self._provider = provider
        self._top = top
        self._fetch = max(fetch, top)
        self._listings: AsyncTTLCache[str, tuple[tuple[CryptoAsset, ...], datetime]] = (
            AsyncTTLCache(max_entries=1, clock=clock)
        )
        self._totals: AsyncTTLCache[str, MarketTotals] = AsyncTTLCache(max_entries=1, clock=clock)
        self._fear_greed: AsyncTTLCache[str, FearGreed] = AsyncTTLCache(max_entries=1, clock=clock)
        self._anchors: AsyncTTLCache[tuple[date, tuple[int, ...]], AnchorPrices] = AsyncTTLCache(
            max_entries=8, clock=clock
        )

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
            assets=assets[: self._top],
            as_of=as_of,
            totals=kept_totals,
            fear_greed=kept_fear,
            unavailable=tuple(down),
        )

    async def markets(self) -> CryptoMarkets:
        """The market's make-up, and how the largest coins have done over 30 days to a year.

        The listing is essential. Everything else is an extra: if the totals or either anchor day
        cannot be loaded, the rest still answers and the missing part is named.
        """
        assets, as_of = await self._listings.get_or_load(
            "top", self._load_listings, ttl=LISTINGS_TTL, stale_ttl=STALE
        )
        majors = assets[:MAJORS]
        ids = tuple(sorted({a.cmc_id for a in majors if a.cmc_id is not None}))
        today = self._today()
        year_start = date(today.year, 1, 1)
        past_year = today - timedelta(days=PAST_YEAR_DAYS)
        totals, begin, then = await asyncio.gather(
            self._totals.get_or_load(
                "totals", self._provider.market_totals, ttl=TOTALS_TTL, stale_ttl=STALE
            ),
            self._anchor(ids, year_start),
            self._anchor(ids, past_year),
            return_exceptions=True,
        )
        down: list[str] = []
        kept_totals = self._summary(totals, SUMMARY_NAMES[0], down)
        year_anchor = self._summary(begin, "year-to-date change", down)
        past_anchor = self._summary(then, "past-year change", down)
        coins = tuple(
            MajorCoin(
                asset=a,
                year_to_date=self._change(a, year_anchor),
                past_year=self._change(a, past_anchor),
            )
            for a in majors
        )
        return CryptoMarkets(
            majors=coins,
            composition=composition(kept_totals) if kept_totals else None,
            as_of=as_of,
            year_start=year_anchor.on if year_anchor else None,
            past_year_start=past_anchor.on if past_anchor else None,
            unavailable=tuple(down),
        )

    async def listing(self) -> tuple[tuple[CryptoAsset, ...], datetime]:
        """The cached listing of the largest coins and when it was taken (the provider is asked at
        most once per lifetime, however many callers). Raises the provider's error if there is
        nothing cached and it cannot be reached."""
        return await self._listings.get_or_load(
            "top", self._load_listings, ttl=LISTINGS_TTL, stale_ttl=STALE
        )

    async def search(self, query: str, limit: int) -> tuple[list[CryptoAsset], datetime]:
        """Listed coins matching a name or symbol, from the cached listing (no provider call)."""
        assets, as_of = await self._listings.get_or_load(
            "top", self._load_listings, ttl=LISTINGS_TTL, stale_ttl=STALE
        )
        return search_assets(assets, query, limit), as_of

    async def coin(self, slug: str) -> tuple[CryptoAsset, datetime]:
        """One listed coin by its slug. Only the coins in the cached listing are known."""
        assets, as_of = await self._listings.get_or_load(
            "top", self._load_listings, ttl=LISTINGS_TTL, stale_ttl=STALE
        )
        for asset in assets:
            if asset.slug == slug:
                return asset, as_of
        msg = "That coin is not among the largest coins this site covers."
        raise NotFoundError(msg)

    async def _anchor(self, ids: tuple[int, ...], day: date) -> AnchorPrices:
        return await self._anchors.get_or_load(
            (day, ids),
            lambda: self._provider.anchor_prices(ids, day),
            ttl=ANCHOR_TTL,
            stale_ttl=ANCHOR_STALE,
        )

    @staticmethod
    def _change(asset: CryptoAsset, anchor: AnchorPrices | None) -> Decimal | None:
        if anchor is None or asset.cmc_id is None:
            return None
        return percent_change(asset.price, anchor.prices.get(asset.cmc_id))

    async def _load_listings(self) -> tuple[tuple[CryptoAsset, ...], datetime]:
        listings = await self._provider.listings(self._fetch)
        return listings.assets[: self._fetch], listings.as_of

    @staticmethod
    def _summary[T](result: T | BaseException, name: str, down: list[str]) -> T | None:
        if isinstance(result, BaseException):
            if isinstance(result, AppError):
                down.append(name)
                return None
            raise result  # not a provider failure: a bug, let it surface
        return result
