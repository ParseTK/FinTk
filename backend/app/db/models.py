"""ORM models: the database's view of the data. Never returned from the API (see app.schemas).

Price history is fetched from a provider once per symbol and kept permanently, so the free provider
quotas are only spent on the newest month. Two tables keep that cheap:

- ``price_series``: one row per symbol (where the data came from, when we last refreshed it).
- ``monthly_price``: one row per symbol and month. The primary key (symbol, month_end) is also the
  index for every access pattern we have: "all months of a symbol", "a date range of a symbol" and
  "append the newest month" are all single index range scans or inserts, with no extra index to
  maintain. A symbol has a few hundred rows, so a row costs about 40 bytes: tens of megabytes cover
  thousands of symbols.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
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

SYMBOL_LENGTH = 12
SOURCE_LENGTH = 32


class PriceSeries(Base):
    __tablename__ = "price_series"

    symbol: Mapped[str] = mapped_column(String(SYMBOL_LENGTH), primary_key=True)
    source: Mapped[str] = mapped_column(String(SOURCE_LENGTH))
    refreshed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class MonthlyPrice(Base):
    __tablename__ = "monthly_price"
    __table_args__ = (CheckConstraint("close > 0", name="close_positive"),)

    symbol: Mapped[str] = mapped_column(
        String(SYMBOL_LENGTH),
        ForeignKey("price_series.symbol", ondelete="CASCADE"),
        primary_key=True,
    )
    month_end: Mapped[date] = mapped_column(Date, primary_key=True)
    # NUMERIC, never float: money is exact. Six decimals covers split-adjusted history.
    close: Mapped[Decimal] = mapped_column(Numeric(18, 6))


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
