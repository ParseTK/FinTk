"""Persistence for the watchlist and portfolio lots. The only place that knows their SQL.

Every statement that touches a row filters by ``user_id`` as well as by the row's own key. That is
a second layer under the ownership check in the API: even if a caller forgot to check, one user's
request can never read or change another user's rows.
"""

import uuid
from collections.abc import Sequence
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import HoldingLot, User, WatchlistItem
from app.domain.portfolio import Lot, LotTotals, NewLot, WatchlistEntry


def _lot(row: HoldingLot) -> Lot:
    return Lot(
        id=row.id,
        user_id=row.user_id,
        symbol=row.symbol,
        shares=row.shares,
        unit_cost=row.unit_cost,
        acquired_on=row.acquired_on,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def lock_user(session: AsyncSession, user_id: uuid.UUID) -> bool:
    """Serialize this user's writes until the transaction ends.

    Limits ("at most N items") are check-then-insert, which two simultaneous requests can both
    pass. Taking the user's row lock first makes the second wait, then see the first's rows.
    Returns False if the user no longer exists (for example, the account was just deleted).
    """
    locked = await session.scalar(select(User.id).where(User.id == user_id).with_for_update())
    return locked is not None


class WatchlistRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def for_user(self, user_id: uuid.UUID) -> list[WatchlistEntry]:
        rows = await self._session.execute(
            select(WatchlistItem.symbol, WatchlistItem.added_at)
            .where(WatchlistItem.user_id == user_id)
            .order_by(WatchlistItem.symbol)
        )
        return [WatchlistEntry(symbol=symbol, added_at=added_at) for symbol, added_at in rows]

    async def count(self, user_id: uuid.UUID) -> int:
        return (
            await self._session.scalar(
                select(func.count())
                .select_from(WatchlistItem)
                .where(WatchlistItem.user_id == user_id)
            )
            or 0
        )

    async def contains(self, user_id: uuid.UUID, symbol: str) -> bool:
        found = await self._session.scalar(
            select(WatchlistItem.symbol).where(
                WatchlistItem.user_id == user_id, WatchlistItem.symbol == symbol
            )
        )
        return found is not None

    async def add(self, user_id: uuid.UUID, symbol: str) -> WatchlistEntry:
        """Idempotent: adding what is already there changes nothing and returns the original."""
        await self._session.execute(
            insert(WatchlistItem)
            .values(user_id=user_id, symbol=symbol)
            .on_conflict_do_nothing(index_elements=["user_id", "symbol"])
        )
        row = await self._session.execute(
            select(WatchlistItem.symbol, WatchlistItem.added_at).where(
                WatchlistItem.user_id == user_id, WatchlistItem.symbol == symbol
            )
        )
        symbol_, added_at = row.one()
        return WatchlistEntry(symbol=symbol_, added_at=added_at)

    async def remove(self, user_id: uuid.UUID, symbol: str) -> None:
        """Idempotent: removing what is not there is fine."""
        await self._session.execute(
            delete(WatchlistItem).where(
                WatchlistItem.user_id == user_id, WatchlistItem.symbol == symbol
            )
        )


class LotRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def count(self, user_id: uuid.UUID) -> int:
        return (
            await self._session.scalar(
                select(func.count()).select_from(HoldingLot).where(HoldingLot.user_id == user_id)
            )
            or 0
        )

    async def get(self, lot_id: uuid.UUID) -> Lot | None:
        """By id alone, so the caller can run the ownership check (a missing row and someone
        else's row must be answered identically)."""
        row = await self._session.get(HoldingLot, lot_id)
        return _lot(row) if row else None

    async def by_client_key(self, user_id: uuid.UUID, client_key: str) -> Lot | None:
        row = await self._session.scalar(
            select(HoldingLot).where(
                HoldingLot.user_id == user_id, HoldingLot.client_key == client_key
            )
        )
        return _lot(row) if row else None

    async def by_client_keys(self, user_id: uuid.UUID, client_keys: Sequence[str]) -> list[Lot]:
        """The lots saved under these keys, in the order of the keys (missing ones are skipped)."""
        rows = await self._session.scalars(
            select(HoldingLot).where(
                HoldingLot.user_id == user_id, HoldingLot.client_key.in_(client_keys)
            )
        )
        order = {key: index for index, key in enumerate(client_keys)}
        return [_lot(row) for row in sorted(rows, key=lambda r: order[r.client_key or ""])]

    async def for_user(self, user_id: uuid.UUID, symbol: str | None = None) -> list[Lot]:
        query = select(HoldingLot).where(HoldingLot.user_id == user_id)
        if symbol is not None:
            query = query.where(HoldingLot.symbol == symbol)
        rows = await self._session.scalars(
            query.order_by(HoldingLot.symbol, HoldingLot.acquired_on, HoldingLot.created_at)
        )
        return [_lot(row) for row in rows]

    async def totals(self, user_id: uuid.UUID) -> list[LotTotals]:
        """One row per symbol, summed by the database in exact arithmetic (index-ordered)."""
        rows = await self._session.execute(
            select(
                HoldingLot.symbol,
                func.sum(HoldingLot.shares),
                func.sum(HoldingLot.shares * HoldingLot.unit_cost),
                func.count(),
            )
            .where(HoldingLot.user_id == user_id)
            .group_by(HoldingLot.symbol)
            .order_by(HoldingLot.symbol)
        )
        return [
            LotTotals(symbol=symbol, shares=shares, cost=cost, lots=lots)
            for symbol, shares, cost, lots in rows
        ]

    async def create(self, user_id: uuid.UUID, new: NewLot) -> Lot:
        row = HoldingLot(
            user_id=user_id,
            symbol=new.symbol,
            shares=new.shares,
            unit_cost=new.unit_cost,
            acquired_on=new.acquired_on,
            client_key=new.client_key,
        )
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row)
        return _lot(row)

    async def update(
        self,
        user_id: uuid.UUID,
        lot_id: uuid.UUID,
        *,
        shares: Decimal,
        unit_cost: Decimal,
        acquired_on: date | None,
        now: datetime,
    ) -> Lot | None:
        """Change a lot, but only if it is this user's. None if there is no such lot for them."""
        row = await self._session.scalar(
            update(HoldingLot)
            .where(HoldingLot.id == lot_id, HoldingLot.user_id == user_id)
            .values(shares=shares, unit_cost=unit_cost, acquired_on=acquired_on, updated_at=now)
            .returning(HoldingLot)
        )
        return _lot(row) if row else None

    async def delete(self, user_id: uuid.UUID, lot_id: uuid.UUID) -> bool:
        result = await self._session.execute(
            delete(HoldingLot).where(HoldingLot.id == lot_id, HoldingLot.user_id == user_id)
        )
        return result.rowcount > 0  # type: ignore[attr-defined]
