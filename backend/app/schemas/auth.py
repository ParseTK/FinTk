"""API response models for sign-in and the signed-in user."""

import uuid

from pydantic import BaseModel, ConfigDict

from app.domain.accounts import UserAccount


class UserResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: uuid.UUID
    email: str
    name: str | None
    avatar_url: str | None

    @classmethod
    def from_domain(cls, user: UserAccount) -> "UserResponse":
        return cls(id=user.id, email=user.email, name=user.name, avatar_url=user.avatar_url)


class SessionResponse(BaseModel):
    """Everything the UI needs at page load, in one request."""

    model_config = ConfigDict(frozen=True)

    user: UserResponse | None
    # Sent back as the X-CSRF-Token header on state-changing requests. None when signed out.
    csrf_token: str | None
    # Providers that are configured on this server, so the UI only offers what works.
    providers: list[str]
