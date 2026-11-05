"""Crypto watchlist and holdings use cases.

Two rules shape this file:

- Prices come from the live listing (``CryptoService``) and are never stored. A coin is accepted
  only if it is in that listing, so what is saved is always a coin the site can show.
- The listing is read BEFORE the first database query. A request that has touched the database holds
  a transaction, and Postgres ends one that sits idle for 10 seconds; a slow provider call made
  inside it would be killed. The provider's failure is not fatal for reads (rows show without
  prices); for a write it is, because the coin cannot be checked.
"""

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, LimitReachedError, NotFoundError
from app.domain.crypto import CryptoAsset
from app.domain.holdings import (
    Holding,
    Totals,
    Valuation,
    WatchEntry,
    WatchRow,
    totals_of,
    value_holding,
)
from app.repositories.holdings import HoldingRepository, WatchRepository, lock_user
from app.services.crypto import CryptoService

logger = logging.getLogger(__name__)

MAX_WATCHED = 100
MAX_HOLDINGS = 100


@dataclass(frozen=True, slots=True)
class WatchlistView:
    rows: tuple[WatchRow, ...]
    as_of: datetime | None  # None when prices could not be loaded
    prices_available: bool


@dataclass(frozen=True, slots=True)
class PortfolioView:
    valuations: tuple[Valuation, ...]
    totals: Totals
    as_of: datetime | None
    prices_available: bool


class HoldingsService:
    def __init__(
        self,
        session: AsyncSession,
        watch: WatchRepository,
        holdings: HoldingRepository,
        crypto: CryptoService,
    ) -> None:
        self._session = session
        self._watch = watch
        self._holdings = holdings
        self._crypto = crypto

    async def _prices(self) -> tuple[dict[str, CryptoAsset], datetime | None]:
        """The listing by slug, or nothing when it cannot be had (reads then show no prices)."""
        try:
            assets, as_of = await self._crypto.listing()
        except AppError:
            logger.warning("holdings view built without prices")
            return {}, None
        return {asset.slug: asset for asset in assets}, as_of

    async def _require_covered(self, slug: str) -> None:
        """Raise NotFoundError unless the site covers this coin (and the provider's error if the
        listing cannot be had at all: a coin cannot be checked without it)."""
        await self._crypto.coin(slug)

    # -- watchlist -------------------------------------------------------------------------------

    async def watchlist(self, user_id: uuid.UUID) -> WatchlistView:
        prices, as_of = await self._prices()
        entries = await self._watch.for_user(user_id)
        rows = tuple(WatchRow(entry, prices.get(entry.slug)) for entry in entries)
        return WatchlistView(rows, as_of, prices_available=as_of is not None)

    async def watch(self, user_id: uuid.UUID, slug: str) -> tuple[WatchEntry, bool]:
        """Add a coin. Safe to repeat: the second time returns the original and created=False."""
        await self._require_covered(slug)
        if not await lock_user(self._session, user_id):
            msg = "That does not exist."
            raise NotFoundError(msg)
        existed = await self._watch.contains(user_id, slug)
        if not existed and await self._watch.count(user_id) >= MAX_WATCHED:
            msg = f"You can watch at most {MAX_WATCHED} coins. Remove one to add another."
            raise LimitReachedError(msg)
        return await self._watch.add(user_id, slug), not existed

    async def unwatch(self, user_id: uuid.UUID, slug: str) -> None:
        await self._watch.remove(user_id, slug)

    # -- holdings --------------------------------------------------------------------------------

    async def portfolio(self, user_id: uuid.UUID) -> PortfolioView:
        prices, as_of = await self._prices()
        held = await self._holdings.for_user(user_id)
        valuations = tuple(value_holding(holding, prices.get(holding.slug)) for holding in held)
        return PortfolioView(
            valuations, totals_of(list(valuations)), as_of, prices_available=as_of is not None
        )

    async def hold(
        self, user_id: uuid.UUID, slug: str, amount: Decimal, cost: Decimal | None
    ) -> tuple[Holding, bool]:
        """Record how much of a coin the person holds (and optionally what they paid in total),
        replacing any earlier entry for that coin. Returns the holding and whether it is new."""
        await self._require_covered(slug)
        if not await lock_user(self._session, user_id):
            msg = "That does not exist."
            raise NotFoundError(msg)
        existed = await self._holdings.contains(user_id, slug)
        if not existed and await self._holdings.count(user_id) >= MAX_HOLDINGS:
            msg = f"You can hold at most {MAX_HOLDINGS} coins. Remove one to add another."
            raise LimitReachedError(msg)
        return await self._holdings.upsert(user_id, slug, amount, cost), not existed

    async def release(self, user_id: uuid.UUID, slug: str) -> None:
        await self._holdings.remove(user_id, slug)
