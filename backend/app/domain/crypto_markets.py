"""The crypto markets view: arithmetic on figures we already have. Pure functions, no I/O.

Two things are worked out here, both from numbers the provider published:

- the **composition** of the market (how much of the total is Bitcoin, Ethereum and everything else,
  with stablecoins and DeFi shown as overlapping groups, not slices), and
- the **change since a fixed date** for a coin (year to date, past year), from its price now and its
  price then.

Nothing is guessed: a figure is ``None`` when an input is missing or a divisor is not positive.
"""

from dataclasses import dataclass
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Literal

from app.domain.crypto import CryptoAsset, MarketTotals

ZERO = Decimal(0)
HUNDRED = Decimal(100)
CENT = Decimal("0.01")

Key = Literal["bitcoin", "ethereum", "other", "stablecoins", "defi"]


@dataclass(frozen=True, slots=True)
class CompositionRow:
    key: Key
    label: str
    share: Decimal | None  # percent of the total market capitalization
    market_cap: Decimal | None  # US dollars
    share_change: Decimal | None  # percentage points since yesterday, when the provider gives it
    overlaps: bool  # True for groups that are also counted among the rows above them


@dataclass(frozen=True, slots=True)
class Composition:
    total_market_cap: Decimal | None
    total_change_24h: Decimal | None  # percent, total now against a day ago
    rows: tuple[CompositionRow, ...]


def _round(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def percent_change(now: Decimal | None, before: Decimal | None) -> Decimal | None:
    """Percent change from ``before`` to ``now``; None unless ``before`` is positive."""
    if now is None or before is None or before <= ZERO:
        return None
    try:
        return _round((now - before) / before * HUNDRED)
    except InvalidOperation:
        return None


def _share(part: Decimal | None, total: Decimal | None) -> Decimal | None:
    if part is None or total is None or total <= ZERO or part < ZERO:
        return None
    try:
        return _round(part / total * HUNDRED)
    except InvalidOperation:
        return None


def _of_total(share: Decimal | None, total: Decimal | None) -> Decimal | None:
    if share is None or total is None:
        return None
    try:
        return _round(total * share / HUNDRED)
    except InvalidOperation:
        return None


def _points(now: Decimal | None, before: Decimal | None) -> Decimal | None:
    return None if now is None or before is None else _round(now - before)


def composition(totals: MarketTotals) -> Composition:
    """Bitcoin, Ethereum and all other coins as shares of the whole, plus two overlapping groups."""
    total = totals.total_market_cap
    btc, eth = totals.btc_dominance, totals.eth_dominance
    btc_change = _points(btc, totals.btc_dominance_yesterday)
    eth_change = _points(eth, totals.eth_dominance_yesterday)
    other = _round(HUNDRED - btc - eth) if btc is not None and eth is not None else None
    other_change = (
        _round(-(btc_change + eth_change))
        if btc_change is not None and eth_change is not None
        else None
    )
    rows = (
        CompositionRow("bitcoin", "Bitcoin", btc, _of_total(btc, total), btc_change, False),
        CompositionRow("ethereum", "Ethereum", eth, _of_total(eth, total), eth_change, False),
        CompositionRow(
            "other", "All other coins", other, _of_total(other, total), other_change, False
        ),
        CompositionRow(
            "stablecoins",
            "Stablecoins",
            _share(totals.stablecoin_market_cap, total),
            totals.stablecoin_market_cap,
            None,
            True,
        ),
        CompositionRow(
            "defi",
            "DeFi tokens",
            _share(totals.defi_market_cap, total),
            totals.defi_market_cap,
            None,
            True,
        ),
    )
    return Composition(
        total_market_cap=total,
        total_change_24h=percent_change(total, totals.total_market_cap_yesterday),
        rows=rows,
    )


@dataclass(frozen=True, slots=True)
class MajorCoin:
    asset: CryptoAsset  # its 24 hour, 7 day, 30 day and 90 day changes come with the listing
    year_to_date: Decimal | None  # percent, from its price on the first day of the year
    past_year: Decimal | None  # percent, from its price about a year ago


@dataclass(frozen=True, slots=True)
class CryptoMarkets:
    majors: tuple[MajorCoin, ...]
    composition: Composition | None
    as_of: datetime
    year_start: date | None  # the day the year-to-date change is measured from
    past_year_start: date | None  # the day the past-year change is measured from
    unavailable: tuple[str, ...]  # parts that could not be loaded this time
