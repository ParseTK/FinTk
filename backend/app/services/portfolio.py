"""Watchlist and portfolio use cases. Knows nothing about HTTP.

Rules that live here (not in routes or SQL):
- A symbol must exist in the company directory before it can be saved.
- Limits per user bound storage and abuse. They are checked under the user's row lock, so two
  simultaneous requests cannot both slip under the cap.
- A lot is only ever handed out after the ownership check (``require_owner``).
- Writes are idempotent where a repeat is likely: adding to the watchlist twice, removing twice,
  and creating a lot twice with the same Idempotency-Key.
"""

import uuid
from collections.abc import Awaitable, Callable, Iterable
from dataclasses import dataclass, replace
from datetime import UTC, date, datetime
from decimal import Decimal

from app.core.authz import require_owner
from app.core.errors import (
    BadRequestError,
    ConflictError,
    LimitReachedError,
    NotFoundError,
    UnavailableError,
)
from app.domain.portfolio import (
    TWO_PLACES,
    Holding,
    Lot,
    NewLot,
    PortfolioValuation,
    WatchlistEntry,
    value_holding,
    value_portfolio,
)
from app.repositories.portfolio import LotRepository, WatchlistRepository
from app.services.companies import CompanyService, is_valid_ticker

LockUser = Callable[[uuid.UUID], Awaitable[bool]]


def utcnow() -> datetime:
    return datetime.now(UTC)


@dataclass(frozen=True, slots=True)
class Portfolio:
    holdings: list[Holding]
    total_cost_basis: Decimal
    names: dict[str, str]
    valuation: PortfolioValuation | None = None


@dataclass(frozen=True, slots=True)
class Watchlist:
    entries: list[WatchlistEntry]
    names: dict[str, str]


class PortfolioService:
    def __init__(
        self,
        watchlist: WatchlistRepository,
        lots: LotRepository,
        companies: CompanyService | None,
        lock_user: LockUser,
        *,
        max_watchlist_items: int,
        max_lots: int,
        clock: Callable[[], datetime] = utcnow,
    ) -> None:
        self._watchlist = watchlist
        self._lots = lots
        self._companies = companies
        self._lock_user = lock_user
        self._max_watchlist_items = max_watchlist_items
        self._max_lots = max_lots
        self._clock = clock

    # -- watchlist -------------------------------------------------------------------------

    async def watchlist(self, user_id: uuid.UUID) -> Watchlist:
        entries = await self._watchlist.for_user(user_id)
        return Watchlist(entries, await self._names(e.symbol for e in entries))

    async def watch(self, user_id: uuid.UUID, ticker: str) -> tuple[WatchlistEntry, bool]:
        """Add a symbol. Returns the entry and whether it was newly added (False on a repeat)."""
        symbol = await self._canonical_symbol(ticker)
        await self._lock(user_id)
        if await self._watchlist.contains(user_id, symbol):
            return await self._watchlist.add(user_id, symbol), False
        if await self._watchlist.count(user_id) >= self._max_watchlist_items:
            msg = f"Your watchlist is full ({self._max_watchlist_items} companies)."
            raise LimitReachedError(msg)
        return await self._watchlist.add(user_id, symbol), True

    async def name_of(self, symbol: str) -> str | None:
        return (await self._names([symbol])).get(symbol)

    async def unwatch(self, user_id: uuid.UUID, ticker: str) -> None:
        """Remove a symbol. Works for any well-formed ticker, even one that has since left the
        directory, so nothing can get stuck on someone's list."""
        if not is_valid_ticker(ticker):
            raise NotFoundError
        await self._watchlist.remove(user_id, ticker.strip().upper().replace(".", "-"))

    # -- portfolio -------------------------------------------------------------------------

    async def portfolio(self, user_id: uuid.UUID) -> Portfolio:
        totals = await self._lots.totals(user_id)
        # Worth is best effort: with no stored prices, or if they cannot be had, the portfolio is
        # still returned with its cost figures and no valuation.
        closes = (
            await self._companies.latest_prices(t.symbol for t in totals)
            if self._companies is not None
            else {}
        )
        holdings = [
            replace(
                Holding.from_totals(t),
                valuation=value_holding(t, closes[t.symbol]) if t.symbol in closes else None,
            )
            for t in totals
        ]
        # Summed exactly, rounded once: adding rounded per-symbol figures would drift by cents.
        total = sum((t.cost for t in totals), Decimal(0)).quantize(TWO_PLACES)
        return Portfolio(
            holdings,
            total,
            await self._names(h.symbol for h in holdings),
            value_portfolio(totals, closes),
        )

    async def lots(self, user_id: uuid.UUID, ticker: str | None = None) -> list[Lot]:
        symbol = None
        if ticker is not None:
            if not is_valid_ticker(ticker):
                return []
            symbol = ticker.strip().upper().replace(".", "-")
        return await self._lots.for_user(user_id, symbol)

    async def get_owned_lot(self, user_id: uuid.UUID, lot_id: uuid.UUID) -> Lot:
        """The lot, but only for its owner. A missing lot and a foreign one look the same."""
        lot = await self._lots.get(lot_id)
        require_owner(lot.user_id if lot else None, user_id)
        assert lot is not None  # require_owner raised otherwise  # noqa: S101
        return lot

    async def add_lot(
        self,
        user_id: uuid.UUID,
        *,
        ticker: str,
        shares: Decimal,
        unit_cost: Decimal,
        acquired_on: date | None,
        client_key: str | None,
    ) -> tuple[Lot, bool]:
        """Create a lot. Returns it and whether it was newly created.

        With an Idempotency-Key, repeating the same request returns the original lot instead of
        adding a second one (a double click, a retry after a dropped connection). The same key
        with different content is a conflict, never a silent overwrite.
        """
        self._check_date(acquired_on)
        symbol = await self._canonical_symbol(ticker)
        new = NewLot(symbol, shares, unit_cost, acquired_on, client_key)
        await self._lock(user_id)  # also makes concurrent repeats of one key line up
        if client_key is not None:
            existing = await self._lots.by_client_key(user_id, client_key)
            if existing is not None:
                if not _same_request(existing, new):
                    msg = "That Idempotency-Key was already used for a different request."
                    raise ConflictError(msg)
                return existing, False
        if await self._lots.count(user_id) >= self._max_lots:
            msg = f"You have reached the limit of {self._max_lots} purchases."
            raise LimitReachedError(msg)
        return await self._lots.create(user_id, new), True

    async def update_lot(
        self,
        user_id: uuid.UUID,
        lot: Lot,
        *,
        shares: Decimal,
        unit_cost: Decimal,
        acquired_on: date | None,
    ) -> Lot:
        self._check_date(acquired_on)
        updated = await self._lots.update(
            user_id,
            lot.id,
            shares=shares,
            unit_cost=unit_cost,
            acquired_on=acquired_on,
            now=self._clock(),
        )
        if updated is None:  # deleted between the check and the write
            raise NotFoundError
        return updated

    async def delete_lot(self, user_id: uuid.UUID, lot: Lot) -> None:
        if not await self._lots.delete(user_id, lot.id):
            raise NotFoundError

    # -- internals -------------------------------------------------------------------------

    async def _canonical_symbol(self, ticker: str) -> str:
        if self._companies is None:
            msg = "Company data is not configured on this server."
            raise UnavailableError(msg)
        return (await self._companies.resolve(ticker)).ticker

    async def _lock(self, user_id: uuid.UUID) -> None:
        if not await self._lock_user(user_id):
            raise NotFoundError  # the account is gone

    async def _names(self, symbols: Iterable[str]) -> dict[str, str]:
        return await self._companies.names(symbols) if self._companies is not None else {}

    def _check_date(self, acquired_on: date | None) -> None:
        if acquired_on is not None and acquired_on > self._clock().date():
            msg = "The purchase date cannot be in the future."
            raise BadRequestError(msg)


def _same_request(existing: Lot, new: NewLot) -> bool:
    return (
        existing.symbol == new.symbol
        and existing.shares == new.shares
        and existing.unit_cost == new.unit_cost
        and existing.acquired_on == new.acquired_on
    )
