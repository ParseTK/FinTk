"""Sign-in and session use cases. Knows nothing about HTTP, cookies or a specific provider."""

import logging
import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from app.auth.providers import EmailNotVerifiedError
from app.auth.security import hash_token, new_csrf_token, new_session_token
from app.domain.accounts import AuthContext, ExternalProfile, UserAccount
from app.repositories.accounts import AccountRepository, SessionRepository

logger = logging.getLogger(__name__)

# A visit extends the idle limit, but writing on every request would turn each read into a write.
# Once an hour is plenty for a limit measured in days.
EXTEND_AFTER = timedelta(hours=1)
MAX_EMAIL = 320


def utcnow() -> datetime:
    return datetime.now(UTC)


class AuthService:
    def __init__(
        self,
        accounts: AccountRepository,
        sessions: SessionRepository,
        *,
        idle: timedelta,
        maximum: timedelta,
        clock: Callable[[], datetime] = utcnow,
    ) -> None:
        self._accounts = accounts
        self._sessions = sessions
        self._idle = idle
        self._maximum = maximum
        self._clock = clock

    async def sign_in(self, profile: ExternalProfile) -> tuple[str, AuthContext]:
        """Resolve the person, start a session, and return the cookie token and the context."""
        user = await self._resolve_user(profile)
        now = self._clock()
        await self._accounts.refresh_profile(user.id, profile.name, profile.avatar_url, now)
        token, token_hash = new_session_token()
        csrf = new_csrf_token()
        expires = now + self._idle
        absolute = now + self._maximum
        await self._sessions.create(
            token_hash=token_hash,
            user_id=user.id,
            csrf_token=csrf,
            expires_at=min(expires, absolute),
            absolute_expires_at=absolute,
            now=now,
        )
        await self._sessions.delete_expired(now)  # opportunistic, bounded cleanup
        context = AuthContext(
            user=user,
            csrf_token=csrf,
            token_hash=token_hash,
            last_seen_at=now,
            expires_at=min(expires, absolute),
            absolute_expires_at=absolute,
        )
        return token, context

    async def authenticate(self, token: str) -> AuthContext | None:
        """The context for a cookie token, or None. Slides the idle limit at most hourly."""
        now = self._clock()
        context = await self._sessions.active(hash_token(token), now)
        if context is None:
            return None
        if now - context.last_seen_at >= EXTEND_AFTER:
            expires = min(now + self._idle, context.absolute_expires_at)
            await self._sessions.extend(context.token_hash, last_seen_at=now, expires_at=expires)
        return context

    async def sign_out(self, token_hash: bytes) -> None:
        await self._sessions.delete(token_hash)

    async def delete_account(self, user_id: uuid.UUID) -> bool:
        return await self._accounts.delete(user_id)

    async def _resolve_user(self, profile: ExternalProfile) -> UserAccount:
        """Existing identity, else link by *verified* email, else create.

        Matching on an unverified email would let anyone claim an account by registering that
        address at a provider that does not check it. So an unverified or missing email is refused.
        """
        existing = await self._accounts.by_identity(profile.provider, profile.provider_user_id)
        if existing is not None:
            return existing
        email = (profile.email or "").strip().lower()
        if not profile.email_verified or not email or len(email) > MAX_EMAIL or "@" not in email:
            logger.info("sign-in refused: no verified email from %s", profile.provider)
            raise EmailNotVerifiedError
        user = await self._accounts.get_or_create(email, profile.name, profile.avatar_url)
        await self._accounts.link_identity(user.id, profile.provider, profile.provider_user_id)
        return user
