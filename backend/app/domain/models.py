"""Provider-independent domain models for SEC filings.

These are what services and providers exchange. They are deliberately separate from the API
schemas (``app.schemas``) so that swapping a data source never changes the public contract.
"""

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True, slots=True)
class CompanyRef:
    """One row of the ticker directory."""

    cik: str  # zero-padded to 10 digits
    ticker: str
    name: str
    exchange: str | None


@dataclass(frozen=True, slots=True)
class Filing:
    accession_number: str
    form: str
    filed: date
    report_date: date | None
    description: str | None
    url: str
    items: tuple[str, ...] = ()  # Form 8-K item numbers, e.g. ("2.02", "9.01"); empty otherwise
