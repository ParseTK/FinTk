"""A person's crypto watchlist and holdings, as provider-independent models.

Only what the person entered is stored (which coin, how much, optionally what they paid). Prices
are never stored: they come from the data provider's licensed listing at the moment a view is
built, and the valuation here is arithmetic on them. Money is ``Decimal``, never ``float``.
"""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, localcontext

from app.domain.crypto import CryptoAsset

CENTS = Decimal("0.01")
PERCENT = Decimal("0.01")
_PRECISION = 60  # more than any amount times any price can need, so the arithmetic is exact


@dataclass(frozen=True, slots=True)
class WatchEntry:
    slug: str
    added_at: datetime


@dataclass(frozen=True, slots=True)
class Holding:
    slug: str
    amount: Decimal  # coins
    cost: Decimal | None  # total US dollars paid, as entered; None when the person left it out
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class Valuation:
    """One holding at today's price; the price-related fields are None when it is not priced."""

    holding: Holding
    asset: CryptoAsset | None  # None: no longer among the coins the site covers
    value: Decimal | None  # US dollars, to cents
    gain: Decimal | None  # value minus cost; None without a price or a cost
    gain_percent: Decimal | None  # of the cost; None when the cost is zero


@dataclass(frozen=True, slots=True)
class Totals:
    """Roll-up of the priced holdings.

    ``total_value`` counts every priced holding. The gain only counts those that also have a cost
    (``cost`` and ``value_with_cost`` cover the same holdings), so it is never inflated by a
    holding whose cost was left out.
    """

    total_value: Decimal
    priced: int
    unpriced: int
    cost: Decimal
    value_with_cost: Decimal
    gain: Decimal | None  # None when no priced holding has a cost
    gain_percent: Decimal | None


def value_holding(holding: Holding, asset: CryptoAsset | None) -> Valuation:
    if asset is None:
        return Valuation(holding, None, None, None, None)
    with localcontext() as context:
        context.prec = _PRECISION
        value = (holding.amount * asset.price).quantize(CENTS)
        if holding.cost is None:
            return Valuation(holding, asset, value, None, None)
        gain = value - holding.cost
        percent = (gain / holding.cost * 100).quantize(PERCENT) if holding.cost > 0 else None
    return Valuation(holding, asset, value, gain, percent)


def totals_of(valuations: list[Valuation]) -> Totals:
    with localcontext() as context:
        context.prec = _PRECISION
        priced = [v for v in valuations if v.value is not None]
        total = sum((v.value for v in priced if v.value is not None), Decimal(0))
        with_cost = [v for v in priced if v.holding.cost is not None]
        cost = sum((v.holding.cost for v in with_cost if v.holding.cost is not None), Decimal(0))
        value_with_cost = sum((v.value for v in with_cost if v.value is not None), Decimal(0))
        gain = (value_with_cost - cost) if with_cost else None
        percent = (gain / cost * 100).quantize(PERCENT) if gain is not None and cost > 0 else None
    return Totals(
        total_value=total.quantize(CENTS),
        priced=len(priced),
        unpriced=len(valuations) - len(priced),
        cost=cost.quantize(CENTS),
        value_with_cost=value_with_cost.quantize(CENTS),
        gain=gain.quantize(CENTS) if gain is not None else None,
        gain_percent=percent,
    )


@dataclass(frozen=True, slots=True)
class WatchRow:
    entry: WatchEntry
    asset: CryptoAsset | None  # None: not priced now (the coin left the list, or prices are down)
