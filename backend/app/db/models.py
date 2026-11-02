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

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Numeric, String, func
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
