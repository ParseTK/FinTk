"""Provider-independent domain models.

These are what services and providers exchange. They are deliberately separate from the API
schemas (``app.schemas``) so that swapping a data source never changes the public contract.
Money is ``Decimal``, never ``float``.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass(frozen=True, slots=True)
class CompanyRef:
    """One row of the ticker directory."""

    cik: str  # zero-padded to 10 digits
    ticker: str
    name: str
    exchange: str | None


@dataclass(frozen=True, slots=True)
class CompanyProfile:
    cik: str
    ticker: str
    name: str
    exchange: str | None
    sic: str | None
    industry: str | None
    fiscal_year_end: str | None  # "MMDD", e.g. "0926"
    category: str | None  # e.g. "Large accelerated filer"
    website: str | None


@dataclass(frozen=True, slots=True)
class Filing:
    accession_number: str
    form: str
    filed: date
    report_date: date | None
    description: str | None
    url: str


@dataclass(frozen=True, slots=True)
class AnnualValue:
    """One fiscal year of one metric."""

    period_end: date
    value: Decimal
    filed: date
    form: str


@dataclass(frozen=True, slots=True)
class MetricSeries:
    metric: str
    unit: str  # "USD" or "USD/shares"
    values: tuple[AnnualValue, ...]  # newest first


@dataclass(frozen=True, slots=True)
class MonthlyPrice:
    month_end: date
    close: Decimal


@dataclass(frozen=True, slots=True)
class PriceHistory:
    symbol: str
    source: str  # where the numbers came from, shown to the user ("sample" until a real provider)
    prices: tuple[MonthlyPrice, ...]  # oldest first


@dataclass(frozen=True, slots=True)
class LatestClose:
    """The newest stored month-end close of a symbol."""

    symbol: str
    month_end: date
    close: Decimal
    source: str
