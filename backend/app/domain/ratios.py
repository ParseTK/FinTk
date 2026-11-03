"""Ratios worked out from a company's own annual SEC figures. Pure functions, no I/O.

Nothing here scores, ranks or labels a company as good or bad: a ratio is arithmetic on published
numbers, shown with its formula. A ratio is ``None`` (shown as "not available") rather than guessed
whenever an input is missing, a divisor is not positive, or a sign makes the result meaningless (for
example growth measured from a loss). Money is ``Decimal`` throughout.
"""

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Literal

from app.domain.models import MetricSeries

Unit = Literal["percent", "times"]
Figures = Mapping[str, Mapping[date, Decimal]]  # metric -> fiscal period end -> value

ZERO = Decimal(0)
HUNDRED = Decimal(100)
CENT = Decimal("0.01")
# A fiscal year is 52 or 53 weeks, and period ends drift by a few days, so "the year before" is
# the period ending 320 to 410 days earlier (nearest to 365 wins). Skipping a year gives None.
PRIOR_MIN_DAYS = 320
PRIOR_MAX_DAYS = 410


@dataclass(frozen=True, slots=True)
class RatioValue:
    period_end: date
    value: Decimal | None


@dataclass(frozen=True, slots=True)
class RatioSeries:
    ratio: str  # stable key, for example "gross_margin"
    label: str
    formula: str  # plain words, shown beside the numbers
    unit: Unit
    values: tuple[RatioValue, ...]  # newest first, the same fiscal years as the metrics


def _round(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def _percent(numerator: Decimal, denominator: Decimal) -> Decimal | None:
    try:
        return _round(numerator / denominator * HUNDRED)
    except InvalidOperation:
        return None


def _times(numerator: Decimal, denominator: Decimal) -> Decimal | None:
    try:
        return _round(numerator / denominator)
    except InvalidOperation:
        return None


def _prior(by_date: Mapping[date, Decimal], period: date) -> Decimal | None:
    """The value for the fiscal year before ``period``: the one ending about 365 days earlier."""
    best: tuple[int, Decimal] | None = None
    for other, value in by_date.items():
        gap = (period - other).days
        if PRIOR_MIN_DAYS <= gap <= PRIOR_MAX_DAYS:
            distance = abs(gap - 365)
            if best is None or distance < best[0]:
                best = (distance, value)
    return best[1] if best else None


def _get(figures: Figures, metric: str, period: date) -> Decimal | None:
    return figures.get(metric, {}).get(period)


def _margin(top: str) -> Callable[[Figures, date], Decimal | None]:
    def compute(figures: Figures, period: date) -> Decimal | None:
        part, revenue = _get(figures, top, period), _get(figures, "revenue", period)
        if part is None or revenue is None or revenue <= ZERO:
            return None
        return _percent(part, revenue)

    return compute


def _growth(metric: str) -> Callable[[Figures, date], Decimal | None]:
    def compute(figures: Figures, period: date) -> Decimal | None:
        now = _get(figures, metric, period)
        before = _prior(figures.get(metric, {}), period)
        if now is None or before is None or before <= ZERO:
            return None
        return _percent(now - before, before)

    return compute


def _over_positive(
    top: str, bottom: str, shape: Callable[[Decimal, Decimal], Decimal | None]
) -> Callable[[Figures, date], Decimal | None]:
    """``top`` divided by ``bottom``, only when ``bottom`` is above zero."""

    def compute(figures: Figures, period: date) -> Decimal | None:
        a, b = _get(figures, top, period), _get(figures, bottom, period)
        if a is None or b is None or b <= ZERO:
            return None
        return shape(a, b)

    return compute


@dataclass(frozen=True, slots=True)
class _Definition:
    key: str
    label: str
    formula: str
    unit: Unit
    compute: Callable[[Figures, date], Decimal | None]


DEFINITIONS: tuple[_Definition, ...] = (
    _Definition(
        "gross_margin", "Gross margin", "gross profit / revenue", "percent", _margin("gross_profit")
    ),
    _Definition(
        "operating_margin",
        "Operating margin",
        "operating income / revenue",
        "percent",
        _margin("operating_income"),
    ),
    _Definition(
        "net_margin", "Net margin", "net income / revenue", "percent", _margin("net_income")
    ),
    _Definition(
        "revenue_growth",
        "Revenue growth",
        "(revenue - last year's revenue) / last year's revenue",
        "percent",
        _growth("revenue"),
    ),
    _Definition(
        "net_income_growth",
        "Net income growth",
        "(net income - last year's) / last year's, only when last year's was a profit",
        "percent",
        _growth("net_income"),
    ),
    _Definition(
        "eps_growth",
        "Diluted EPS growth",
        "(EPS - last year's EPS) / last year's EPS, only when last year's was positive",
        "percent",
        _growth("eps_diluted"),
    ),
    _Definition(
        "return_on_equity",
        "Return on equity",
        "net income / shareholders' equity at year end, only when equity is positive",
        "percent",
        _over_positive("net_income", "equity", _percent),
    ),
    _Definition(
        "return_on_assets",
        "Return on assets",
        "net income / total assets at year end",
        "percent",
        _over_positive("net_income", "assets", _percent),
    ),
    _Definition(
        "liabilities_to_equity",
        "Liabilities to equity",
        "total liabilities / shareholders' equity (all liabilities, not just debt)",
        "times",
        _over_positive("liabilities", "equity", _times),
    ),
    _Definition(
        "cash_conversion",
        "Cash conversion",
        "cash from operations / net income, only when net income is positive",
        "times",
        _over_positive("operating_cash_flow", "net_income", _times),
    ),
    _Definition(
        "cash_share_of_assets",
        "Cash share of assets",
        "cash and equivalents / total assets",
        "percent",
        _over_positive("cash", "assets", _percent),
    ),
)


def compute_ratios(metrics: Sequence[MetricSeries]) -> list[RatioSeries]:
    """Every ratio that has at least one value, over the fiscal years the metrics cover.

    The periods are those of the supplied metrics, newest first. A ratio with no value in any of
    them is left out entirely, so a company that never reports gross profit has no empty row.
    """
    figures: dict[str, dict[date, Decimal]] = {
        series.metric: {value.period_end: value.value for value in series.values}
        for series in metrics
    }
    periods = sorted({period for by_date in figures.values() for period in by_date}, reverse=True)
    result: list[RatioSeries] = []
    for definition in DEFINITIONS:
        values = tuple(
            RatioValue(period, definition.compute(figures, period)) for period in periods
        )
        if any(value.value is not None for value in values):
            result.append(
                RatioSeries(
                    ratio=definition.key,
                    label=definition.label,
                    formula=definition.formula,
                    unit=definition.unit,
                    values=values,
                )
            )
    return result
