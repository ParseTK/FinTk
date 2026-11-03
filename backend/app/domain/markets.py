"""How the broad market and its sectors have done, from month-end closes.

The market is shown through ETFs that track it (an ETF is a proxy, not the index itself). Pure
functions, no I/O. Returns are price returns in percent points (``5.76`` means +5.76%), split
adjusted, dividends not included. Every figure is optional: a figure whose month is missing from
the data is None rather than a number that quietly spans a gap.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from decimal import ROUND_HALF_EVEN, Decimal

from app.domain.models import MonthlyPrice
from app.domain.seasonality import closes_by_month

_HUNDRED = Decimal(100)
_TWO_PLACES = Decimal("0.01")


@dataclass(frozen=True, slots=True)
class Instrument:
    symbol: str
    name: str
    group: str  # "index" or "sector"


# Fixed in code, never taken from a request.
INSTRUMENTS: tuple[Instrument, ...] = (
    Instrument("SPY", "S&P 500", "index"),
    Instrument("QQQ", "Nasdaq 100", "index"),
    Instrument("DIA", "Dow Jones Industrial Average", "index"),
    Instrument("IWM", "Russell 2000", "index"),
    Instrument("XLK", "Technology", "sector"),
    Instrument("XLF", "Financials", "sector"),
    Instrument("XLV", "Health Care", "sector"),
    Instrument("XLE", "Energy", "sector"),
    Instrument("XLY", "Consumer Discretionary", "sector"),
    Instrument("XLP", "Consumer Staples", "sector"),
    Instrument("XLI", "Industrials", "sector"),
    Instrument("XLB", "Materials", "sector"),
    Instrument("XLU", "Utilities", "sector"),
    Instrument("XLRE", "Real Estate", "sector"),
    Instrument("XLC", "Communication Services", "sector"),
)


@dataclass(frozen=True, slots=True)
class MarketFigures:
    """The figures for one instrument. ``as_of`` is the newest month they are measured to."""

    as_of: tuple[int, int]  # (year, month)
    last_month: Decimal | None  # return of that month
    year_to_date: Decimal | None  # since the previous December's close
    trailing_12_months: Decimal | None
    annualized: Decimal | None  # compound yearly rate since the start of the data
    since_year: int  # year the data starts


@dataclass(frozen=True, slots=True)
class MarketRow:
    instrument: Instrument
    figures: MarketFigures | None  # None while there is no data for it yet


def _round(value: Decimal) -> Decimal:
    return value.quantize(_TWO_PLACES, rounding=ROUND_HALF_EVEN)


def _change(now: Decimal, then: Decimal | None) -> Decimal | None:
    if then is None or then <= 0:
        return None
    return _round((now / then - 1) * _HUNDRED)


def market_figures(prices: Iterable[MonthlyPrice]) -> MarketFigures | None:
    closes = closes_by_month(prices)
    if not closes:
        return None
    first = min(closes)
    last = max(closes)
    now = closes[last]

    def index(key: tuple[int, int]) -> int:
        return key[0] * 12 + key[1]

    def at(year: int, month: int) -> Decimal | None:
        return closes.get((year, month))

    previous = (last[0], last[1] - 1) if last[1] > 1 else (last[0] - 1, 12)
    year_ago = (last[0] - 1, last[1])

    annualized: Decimal | None = None
    span = index(last) - index(first)
    if span >= 12:
        start = closes[first]
        years = Decimal(span) / Decimal(12)
        annualized = _round(((now / start).ln() / years).exp() * _HUNDRED - _HUNDRED)

    return MarketFigures(
        as_of=last,
        last_month=_change(now, at(*previous)),
        year_to_date=_change(now, at(last[0] - 1, 12)),
        trailing_12_months=_change(now, at(*year_ago)),
        annualized=annualized,
        since_year=first[0],
    )
