"""ORM models: the database's view of the data. Never returned from the API (see app.schemas)."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    LargeBinary,
    Numeric,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

SLUG_LENGTH = 80  # the data provider's URL-safe coin name, for example "bitcoin"


# -- Accounts ---------------------------------------------------------------------------------
#
# Sign-in is social only, so there are no passwords anywhere. A user can link several providers.


class User(Base):
    __tablename__ = "user_account"  # "user" is a reserved word in Postgres
    __table_args__ = (CheckConstraint("email = lower(email)", name="email_lowercase"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    # Always stored lowercase (enforced), so the unique index is a case-insensitive match.
    email: Mapped[str] = mapped_column(String(320), unique=True)
    name: Mapped[str | None] = mapped_column(String(200))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class OAuthIdentity(Base):
    """One account at one provider. (provider, provider_user_id) is globally unique."""

    __tablename__ = "oauth_identity"
    __table_args__ = (UniqueConstraint("provider", "provider_user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user_account.id", ondelete="CASCADE"), index=True
    )
    provider: Mapped[str] = mapped_column(String(16))
    provider_user_id: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserSession(Base):
    """A signed-in browser. The cookie holds a random token; only its SHA-256 is stored here, so a
    leaked database cannot be replayed as logins."""

    __tablename__ = "user_session"
    __table_args__ = (Index("ix_user_session_expires_at", "expires_at"),)

    token_hash: Mapped[bytes] = mapped_column(LargeBinary(32), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user_account.id", ondelete="CASCADE"), index=True
    )
    csrf_token: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))  # idle (sliding) limit
    absolute_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))  # hard limit


# -- Crypto watchlist and holdings ------------------------------------------------------------
#
# Every row belongs to one user and goes with them when the account is deleted (ON DELETE CASCADE).
# Only what the person entered is stored: a coin's slug, an amount, an optional cost. No prices:
# the data provider's licence allows its data to be kept only temporarily, so values are worked out
# from the live listing when a page is built.


class CryptoWatch(Base):
    __tablename__ = "crypto_watch"

    # The primary key doubles as the "is it already there" check, so adding twice is a no-op, and
    # as the index for "everything this user watches".
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user_account.id", ondelete="CASCADE"), primary_key=True
    )
    slug: Mapped[str] = mapped_column(String(SLUG_LENGTH), primary_key=True)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CryptoHolding(Base):
    """How much of one coin a person holds, and optionally what they paid in total (US dollars).

    One row per coin: changing the amount or cost replaces the row. NUMERIC, not float: amounts and
    money are exact.
    """

    __tablename__ = "crypto_holding"
    __table_args__ = (
        CheckConstraint("amount > 0", name="amount_positive"),
        CheckConstraint("cost IS NULL OR cost >= 0", name="cost_not_negative"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user_account.id", ondelete="CASCADE"), primary_key=True
    )
    slug: Mapped[str] = mapped_column(String(SLUG_LENGTH), primary_key=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(30, 18))
    cost: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
