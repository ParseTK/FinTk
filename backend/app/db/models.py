"""ORM models: the database's view of the data. Never returned from the API (see app.schemas).

RETIRED TABLES. `price_series`, `monthly_price`, `watchlist_item` and `holding_lot` belong to the
stock features that were removed when the product became crypto-only. Nothing reads or writes them.
They are kept here, and in the migrations, only so the schema and the models still agree; a later
migration drops them together with the crypto holdings that replace them (expand, then contract).
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


# -- Watchlist and portfolio ------------------------------------------------------------------
#
# Every row belongs to one user and goes with them when the account is deleted (ON DELETE CASCADE).


class WatchlistItem(Base):
    __tablename__ = "watchlist_item"

    # The primary key doubles as the "is it already there" check, so adding twice is a no-op, and
    # as the index for "everything this user watches".
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user_account.id", ondelete="CASCADE"), primary_key=True
    )
    symbol: Mapped[str] = mapped_column(String(SYMBOL_LENGTH), primary_key=True)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class HoldingLot(Base):
    """One purchase: some shares at one price per share (US dollars).

    A holding is the sum of its lots, and its average cost is computed from them, never typed.
    NUMERIC, not float: money is exact. Six decimals allow fractional shares and split-adjusted
    prices.
    """

    __tablename__ = "holding_lot"
    __table_args__ = (
        CheckConstraint("shares > 0", name="shares_positive"),
        CheckConstraint("unit_cost > 0", name="unit_cost_positive"),
        # One row per (user, client key): a repeated submit with the same Idempotency-Key finds the
        # lot it already created instead of making a second one. NULL keys are never compared.
        UniqueConstraint("user_id", "client_key"),
        # Serves "my holdings" (group by symbol) and "the lots of one symbol".
        Index("ix_holding_lot_user_id_symbol", "user_id", "symbol"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user_account.id", ondelete="CASCADE"))
    symbol: Mapped[str] = mapped_column(String(SYMBOL_LENGTH))
    shares: Mapped[Decimal] = mapped_column(Numeric(20, 6))
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    acquired_on: Mapped[date | None] = mapped_column(Date)
    client_key: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
