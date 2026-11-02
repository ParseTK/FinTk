"""Persistence for users, linked identities and sessions. The only place that knows their SQL."""

import uuid
from datetime import datetime

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import OAuthIdentity, User, UserSession
from app.domain.accounts import AuthContext, UserAccount


def _account(user: User) -> UserAccount:
    return UserAccount(id=user.id, email=user.email, name=user.name, avatar_url=user.avatar_url)


class AccountRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def by_identity(self, provider: str, provider_user_id: str) -> UserAccount | None:
        user = await self._session.scalar(
            select(User)
            .join(OAuthIdentity, OAuthIdentity.user_id == User.id)
            .where(
                OAuthIdentity.provider == provider,
                OAuthIdentity.provider_user_id == provider_user_id,
            )
        )
        return _account(user) if user else None

    async def by_email(self, email: str) -> UserAccount | None:
        user = await self._session.scalar(select(User).where(User.email == email))
        return _account(user) if user else None

    async def get(self, user_id: uuid.UUID) -> UserAccount | None:
        user = await self._session.get(User, user_id)
        return _account(user) if user else None

    async def get_or_create(
        self, email: str, name: str | None, avatar_url: str | None
    ) -> UserAccount:
        """Find the user with this email, or create it, in one atomic statement.

        Check-then-insert is a race: two simultaneous first sign-ins (a double click, a retry)
        both see "no such user" and the second insert fails on the unique email. An upsert makes
        the database settle it: the loser waits for the winner's commit and gets the same row. The
        no-op DO UPDATE is what makes RETURNING yield the existing row on conflict.
        """
        statement = insert(User).values(email=email, name=name, avatar_url=avatar_url)
        user = (
            await self._session.execute(
                statement.on_conflict_do_update(
                    index_elements=[User.email], set_={"email": statement.excluded.email}
                ).returning(User)
            )
        ).scalar_one()
        return _account(user)

    async def link_identity(self, user_id: uuid.UUID, provider: str, provider_user_id: str) -> None:
        # Idempotent: two concurrent callbacks for the same account must not collide on the key.
        await self._session.execute(
            insert(OAuthIdentity)
            .values(user_id=user_id, provider=provider, provider_user_id=provider_user_id)
            .on_conflict_do_nothing(index_elements=["provider", "provider_user_id"])
        )

    async def refresh_profile(
        self, user_id: uuid.UUID, name: str | None, avatar_url: str | None, now: datetime
    ) -> None:
        """Record the login and fill in a name or avatar we did not have (never overwrite)."""
        await self._session.execute(
            update(User)
            .where(User.id == user_id)
            .values(
                last_login_at=now,
                # COALESCE in SQL: keep what we have, fill in only what is missing.
                name=func.coalesce(User.name, name),
                avatar_url=func.coalesce(User.avatar_url, avatar_url),
            )
        )

    async def delete(self, user_id: uuid.UUID) -> bool:
        """Delete the account. Identities and sessions go with it (ON DELETE CASCADE)."""
        result = await self._session.execute(delete(User).where(User.id == user_id))
        return result.rowcount > 0  # type: ignore[attr-defined]


class SessionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        *,
        token_hash: bytes,
        user_id: uuid.UUID,
        csrf_token: str,
        expires_at: datetime,
        absolute_expires_at: datetime,
        now: datetime,
    ) -> None:
        self._session.add(
            UserSession(
                token_hash=token_hash,
                user_id=user_id,
                csrf_token=csrf_token,
                created_at=now,
                last_seen_at=now,
                expires_at=expires_at,
                absolute_expires_at=absolute_expires_at,
            )
        )
        await self._session.flush()

    async def active(self, token_hash: bytes, now: datetime) -> AuthContext | None:
        """The session and its user if neither limit has passed. One indexed join."""
        row = (
            await self._session.execute(
                select(UserSession, User)
                .join(User, User.id == UserSession.user_id)
                .where(
                    UserSession.token_hash == token_hash,
                    UserSession.expires_at > now,
                    UserSession.absolute_expires_at > now,
                )
            )
        ).first()
        if row is None:
            return None
        found, user = row
        return AuthContext(
            user=_account(user),
            csrf_token=found.csrf_token,
            token_hash=found.token_hash,
            last_seen_at=found.last_seen_at,
            expires_at=found.expires_at,
            absolute_expires_at=found.absolute_expires_at,
        )

    async def extend(
        self, token_hash: bytes, *, last_seen_at: datetime, expires_at: datetime
    ) -> None:
        await self._session.execute(
            update(UserSession)
            # Only if still behind: when several requests of one session arrive together after an
            # hour of quiet, the first writes and the rest find it already current and skip.
            .where(UserSession.token_hash == token_hash, UserSession.last_seen_at < last_seen_at)
            .values(last_seen_at=last_seen_at, expires_at=expires_at)
        )

    async def delete(self, token_hash: bytes) -> None:
        await self._session.execute(delete(UserSession).where(UserSession.token_hash == token_hash))

    async def delete_expired(self, now: datetime, limit: int = 500) -> int:
        """Housekeeping in bounded batches, so it never holds a long lock or scans everything."""
        # SKIP LOCKED: if another request is already cleaning some of these rows, leave them to it
        # instead of waiting (or deadlocking) on locks taken in a different order.
        expired = (
            select(UserSession.token_hash)
            .where((UserSession.expires_at <= now) | (UserSession.absolute_expires_at <= now))
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        result = await self._session.execute(
            delete(UserSession).where(UserSession.token_hash.in_(expired))
        )
        return result.rowcount  # type: ignore[attr-defined]
