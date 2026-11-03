"""Month-by-year returns ("seasonality") worked out from monthly closing prices.

Pure functions, no I/O: easy to test and safe to call from anywhere. Returns are price returns in
percent points (``5.76`` means +5.76%), from one month's close to the next. A month is only scored
when the month before it is present, so a gap in the data never produces a return that secretly
spans several months.
"""

import itertools
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from decimal import ROUND_HALF_EVEN, Decimal

from app.domain.models import MonthlyPrice, PriceHistory

_HUNDRED = Decimal(100)
_TWO_PLACES = Decimal("0.01")


@dataclass(frozen=True, slots=True)
class MonthReturn:
    year: int
    month: int  # 1-12
    percent: Decimal  # rounded to two decimal places


@dataclass(frozen=True, slots=True)
class MonthStats:
    """How one calendar month (for example every August) has behaved across the years."""

    month: int
    count: int  # years with a return for this month
    average: Decimal
    median: Decimal
    positive: int  # years that closed up
    best: MonthReturn
    worst: MonthReturn

    @property
    def win_rate(self) -> Decimal:
        """Share of years that closed up, in percent."""
        return _round(Decimal(self.positive) * _HUNDRED / Decimal(self.count))


@dataclass(frozen=True, slots=True)
class Seasonality:
    symbol: str
    source: str
    first_month: tuple[int, int] | None  # (year, month) of the first price, the start of the data
    last_month: tuple[int, int] | None
    returns: tuple[MonthReturn, ...]  # by year, then month
    stats: tuple[MonthStats, ...]  # by month, only months that have at least one return


def _round(value: Decimal) -> Decimal:
    return value.quantize(_TWO_PLACES, rounding=ROUND_HALF_EVEN)


def _median(values: list[Decimal]) -> Decimal:
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2


def closes_by_month(prices: Iterable[MonthlyPrice]) -> dict[tuple[int, int], Decimal]:
    """One close per calendar month (a later duplicate wins), unusable closes dropped.

    Keyed by (year, month) rather than by date, so it does not matter whether a provider labels a
    month by its first day, its last day or its last trading day.
    """
    by_month: dict[tuple[int, int], Decimal] = {}
    for price in prices:
        if price.close > 0:
            by_month[(price.month_end.year, price.month_end.month)] = price.close
    return by_month


def _one_per_month(prices: Iterable[MonthlyPrice]) -> list[tuple[int, int, Decimal]]:
    """Oldest first, one close per calendar month."""
    return [
        (year, month, close) for (year, month), close in sorted(closes_by_month(prices).items())
    ]


def monthly_returns(prices: Iterable[MonthlyPrice]) -> list[tuple[int, int, Decimal]]:
    """Unrounded (year, month, percent) for every month whose previous month is also present."""
    months = _one_per_month(prices)
    found: list[tuple[int, int, Decimal]] = []
    for (prev_year, prev_month, prev_close), (year, month, close) in itertools.pairwise(months):
        if (prev_year * 12 + prev_month) + 1 == year * 12 + month:
            found.append((year, month, (close / prev_close - 1) * _HUNDRED))
    return found


def build_seasonality(history: PriceHistory) -> Seasonality:
    months = _one_per_month(history.prices)
    raw = monthly_returns(history.prices)

    returns = tuple(MonthReturn(year, month, _round(value)) for year, month, value in raw)
    by_calendar_month: dict[int, list[tuple[int, Decimal]]] = defaultdict(list)
    for year, month, value in raw:
        by_calendar_month[month].append((year, value))

    stats: list[MonthStats] = []
    for month in sorted(by_calendar_month):
        entries = by_calendar_month[month]
        values = [value for _, value in entries]
        best_year, best = max(entries, key=lambda item: item[1])
        worst_year, worst = min(entries, key=lambda item: item[1])
        stats.append(
            MonthStats(
                month=month,
                count=len(values),
                average=_round(sum(values, Decimal(0)) / len(values)),
                median=_round(_median(values)),
                positive=sum(1 for value in values if value > 0),
                best=MonthReturn(best_year, month, _round(best)),
                worst=MonthReturn(worst_year, month, _round(worst)),
            )
        )

    return Seasonality(
        symbol=history.symbol,
        source=history.source,
        first_month=(months[0][0], months[0][1]) if months else None,
        last_month=(months[-1][0], months[-1][1]) if months else None,
        returns=returns,
        stats=tuple(stats),
    )
