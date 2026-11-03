"""Watchlist and portfolio domain models. Money is Decimal, never float."""

import uuid
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import date, datetime
from decimal import ROUND_HALF_EVEN, Decimal

from app.domain.models import LatestClose

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
    valuation: "Valuation | None" = None  # filled in when a price is held for the symbol

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


@dataclass(frozen=True, slots=True)
class Valuation:
    """What a holding is worth at the latest month-end close we hold."""

    price: Decimal
    as_of: date
    source: str
    market_value: Decimal  # to cents
    gain: Decimal  # market value minus total paid, to cents
    gain_percent: Decimal  # gain as a percentage of total paid, two places


def value_holding(totals: LotTotals, close: LatestClose) -> Valuation:
    """Exact arithmetic, rounded once at the end: shares x close, less the exact cost."""
    market = totals.shares * close.close
    gain = market - totals.cost
    return Valuation(
        price=close.close,
        as_of=close.month_end,
        source=close.source,
        market_value=market.quantize(TWO_PLACES, ROUND_HALF_EVEN),
        gain=gain.quantize(TWO_PLACES, ROUND_HALF_EVEN),
        gain_percent=(gain * 100 / totals.cost).quantize(TWO_PLACES, ROUND_HALF_EVEN),
    )


@dataclass(frozen=True, slots=True)
class PortfolioValuation:
    """Totals over the holdings that could be valued. Others are simply left out of it."""

    market_value: Decimal
    gain: Decimal
    gain_percent: Decimal
    holdings_valued: int
    as_of: (
        date  # the oldest month-end among the valued holdings: the figure is no fresher than this
    )
    source: str


def value_portfolio(
    totals: Iterable[LotTotals], closes: Mapping[str, LatestClose]
) -> PortfolioValuation | None:
    market = Decimal(0)
    cost = Decimal(0)
    valued = 0
    oldest: date | None = None
    sources: set[str] = set()
    for item in totals:
        close = closes.get(item.symbol)
        if close is None:
            continue
        market += item.shares * close.close
        cost += item.cost
        valued += 1
        oldest = close.month_end if oldest is None else min(oldest, close.month_end)
        sources.add(close.source)
    if valued == 0 or oldest is None:
        return None
    gain = market - cost
    return PortfolioValuation(
        market_value=market.quantize(TWO_PLACES, ROUND_HALF_EVEN),
        gain=gain.quantize(TWO_PLACES, ROUND_HALF_EVEN),
        gain_percent=(gain * 100 / cost).quantize(TWO_PLACES, ROUND_HALF_EVEN),
        holdings_valued=valued,
        as_of=oldest,
        source=" and ".join(sorted(sources)),
    )
