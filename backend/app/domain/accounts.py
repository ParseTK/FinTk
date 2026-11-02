"""Account domain models, independent of the ORM and of any sign-in provider."""

import uuid
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True, slots=True)
class UserAccount:
    id: uuid.UUID
    email: str
    name: str | None
    avatar_url: str | None


@dataclass(frozen=True, slots=True)
class ExternalProfile:
    """Who a provider says the person is, after we exchanged the code ourselves."""

    provider: str
    provider_user_id: str
    email: str | None
    email_verified: bool
    name: str | None
    avatar_url: str | None


@dataclass(frozen=True, slots=True)
class AuthContext:
    """The signed-in user and the session they are using."""

    user: UserAccount
    csrf_token: str
    token_hash: bytes
    last_seen_at: datetime
    expires_at: datetime
    absolute_expires_at: datetime
