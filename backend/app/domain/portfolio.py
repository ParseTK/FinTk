"""Watchlist and portfolio domain models. Money is Decimal, never float."""

import uuid
from dataclasses import dataclass
from datetime import date, datetime
from decimal import ROUND_HALF_EVEN, Decimal

SIX_PLACES = Decimal("0.000001")
TWO_PLACES = Decimal("0.01")


@dataclass(frozen=True, slots=True)
class WatchlistEntry:
    symbol: str
    added_at: datetime


@dataclass(frozen=True, slots=True)
class Lot:
    """One purchase of one symbol."""

    id: uuid.UUID
    user_id: uuid.UUID
    symbol: str
    shares: Decimal
    unit_cost: Decimal
    acquired_on: date | None
    created_at: datetime
    updated_at: datetime

    @property
    def cost(self) -> Decimal:
        return self.shares * self.unit_cost


@dataclass(frozen=True, slots=True)
class LotTotals:
    """What the database adds up for one symbol: exact sums, no rounding yet."""

    symbol: str
    shares: Decimal
    cost: Decimal  # sum of shares x unit cost over the lots
    lots: int


@dataclass(frozen=True, slots=True)
class Holding:
    """A symbol the user owns, derived from its lots."""

    symbol: str
    shares: Decimal
    average_cost: Decimal  # cost / shares, to six places
    cost_basis: Decimal  # total paid, to cents
    lots: int

    @classmethod
    def from_totals(cls, totals: LotTotals) -> "Holding":
        # shares is positive by a database constraint, so the division is always defined.
        return cls(
            symbol=totals.symbol,
            shares=totals.shares,
            average_cost=(totals.cost / totals.shares).quantize(SIX_PLACES, ROUND_HALF_EVEN),
            cost_basis=totals.cost.quantize(TWO_PLACES, ROUND_HALF_EVEN),
            lots=totals.lots,
        )


@dataclass(frozen=True, slots=True)
class NewLot:
    symbol: str
    shares: Decimal
    unit_cost: Decimal
    acquired_on: date | None
    client_key: str | None
