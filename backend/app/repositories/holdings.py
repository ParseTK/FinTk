"""Persistence for the crypto watchlist and holdings. The only place that knows their SQL.

Every statement filters by ``user_id`` as well as by the coin's slug. That is a second layer under
the ownership rule in the API: even if a caller forgot to check, one person's request can never read
or change another person's rows. (There is no row id to guess: the key is the person plus the coin.)
"""

import uuid
from decimal import Decimal

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CryptoHolding, CryptoWatch, User
from app.domain.holdings import Holding, WatchEntry


async def lock_user(session: AsyncSession, user_id: uuid.UUID) -> bool:
    """Serialize this user's writes until the transaction ends.

    Limits ("at most N coins") are check-then-insert, which two simultaneous requests can both
    pass. Taking the user's row lock first makes the second wait, then see the first's rows.
    Returns False if the user no longer exists (for example, the account was just deleted).
    """
    locked = await session.scalar(select(User.id).where(User.id == user_id).with_for_update())
    return locked is not None


class WatchRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def for_user(self, user_id: uuid.UUID) -> list[WatchEntry]:
        rows = await self._session.execute(
            select(CryptoWatch.slug, CryptoWatch.added_at)
            .where(CryptoWatch.user_id == user_id)
            .order_by(CryptoWatch.added_at, CryptoWatch.slug)
        )
        return [WatchEntry(slug=slug, added_at=added_at) for slug, added_at in rows]

    async def count(self, user_id: uuid.UUID) -> int:
        return (
            await self._session.scalar(
                select(func.count()).select_from(CryptoWatch).where(CryptoWatch.user_id == user_id)
            )
            or 0
        )

    async def contains(self, user_id: uuid.UUID, slug: str) -> bool:
        found = await self._session.scalar(
            select(CryptoWatch.slug).where(CryptoWatch.user_id == user_id, CryptoWatch.slug == slug)
        )
        return found is not None

    async def add(self, user_id: uuid.UUID, slug: str) -> WatchEntry:
        """Idempotent: adding what is already there changes nothing and returns the original."""
        await self._session.execute(
            insert(CryptoWatch)
            .values(user_id=user_id, slug=slug)
            .on_conflict_do_nothing(index_elements=["user_id", "slug"])
        )
        row = await self._session.execute(
            select(CryptoWatch.slug, CryptoWatch.added_at).where(
                CryptoWatch.user_id == user_id, CryptoWatch.slug == slug
            )
        )
        found_slug, added_at = row.one()
        return WatchEntry(slug=found_slug, added_at=added_at)

    async def remove(self, user_id: uuid.UUID, slug: str) -> None:
        """Idempotent: removing what is not there is fine."""
        await self._session.execute(
            delete(CryptoWatch).where(CryptoWatch.user_id == user_id, CryptoWatch.slug == slug)
        )


class HoldingRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    @staticmethod
    def _holding(row: CryptoHolding) -> Holding:
        return Holding(slug=row.slug, amount=row.amount, cost=row.cost, updated_at=row.updated_at)

    async def for_user(self, user_id: uuid.UUID) -> list[Holding]:
        rows = await self._session.scalars(
            select(CryptoHolding)
            .where(CryptoHolding.user_id == user_id)
            .order_by(CryptoHolding.created_at, CryptoHolding.slug)
        )
        return [self._holding(row) for row in rows]

    async def count(self, user_id: uuid.UUID) -> int:
        return (
            await self._session.scalar(
                select(func.count())
                .select_from(CryptoHolding)
                .where(CryptoHolding.user_id == user_id)
            )
            or 0
        )

    async def contains(self, user_id: uuid.UUID, slug: str) -> bool:
        found = await self._session.scalar(
            select(CryptoHolding.slug).where(
                CryptoHolding.user_id == user_id, CryptoHolding.slug == slug
            )
        )
        return found is not None

    async def upsert(
        self, user_id: uuid.UUID, slug: str, amount: Decimal, cost: Decimal | None
    ) -> Holding:
        """Create the holding, or replace its amount and cost, in one statement (no check first)."""
        statement = insert(CryptoHolding).values(
            user_id=user_id, slug=slug, amount=amount, cost=cost
        )
        statement = statement.on_conflict_do_update(
            index_elements=["user_id", "slug"],
            set_={"amount": amount, "cost": cost, "updated_at": func.now()},
        ).returning(CryptoHolding)
        row = (await self._session.execute(statement)).scalar_one()
        return self._holding(row)

    async def remove(self, user_id: uuid.UUID, slug: str) -> None:
        """Idempotent: removing what is not there is fine."""
        await self._session.execute(
            delete(CryptoHolding).where(
                CryptoHolding.user_id == user_id, CryptoHolding.slug == slug
            )
        )
