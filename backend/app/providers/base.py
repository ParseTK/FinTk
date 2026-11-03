"""The provider interfaces. Services depend on these, never on a concrete data source."""

from datetime import date
from typing import Protocol

from app.domain.models import (
    CompanyProfile,
    CompanyRef,
    Filing,
    MetricSeries,
    PriceHistory,
)


class CompanyDirectory(Protocol):
    async def lookup(self, ticker: str) -> CompanyRef | None: ...

    async def search(self, query: str, limit: int) -> list[CompanyRef]: ...


class FilingsProvider(Protocol):
    async def profile(self, company: CompanyRef) -> CompanyProfile: ...

    async def filings(self, company: CompanyRef, form: str | None, limit: int) -> list[Filing]: ...


class FundamentalsProvider(Protocol):
    async def annual_metrics(self, company: CompanyRef, years: int) -> list[MetricSeries]: ...


class PriceProvider(Protocol):
    @property
    def source(self) -> str:
        """Where the numbers come from, shown to users ("Twelve Data", or "sample")."""
        ...

    async def monthly_history(self, symbol: str, *, since: date | None = None) -> PriceHistory:
        """Completed months, oldest first. With ``since``, a provider may return only the months
        from that one on (it must include it, so a restated month is corrected)."""
        ...
