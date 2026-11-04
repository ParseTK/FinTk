"""The provider interfaces. Services depend on these, never on a concrete data source."""

from collections.abc import Iterable
from datetime import date
from typing import Protocol

from app.domain.crypto import CryptoListings, FearGreed, MarketTotals
from app.domain.models import (
    CompanyProfile,
    CompanyRef,
    Filing,
    LatestClose,
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
        """Where the numbers come from, shown to users (a provider's name, or "sample")."""
        ...

    async def monthly_history(self, symbol: str, *, since: date | None = None) -> PriceHistory:
        """Completed months, oldest first. With ``since``, a provider may return only the months
        from that one on (it must include it, so a restated month is corrected)."""
        ...


class CryptoProvider(Protocol):
    """Cryptocurrency market data. Each call may spend a quota, so callers cache the answers."""

    @property
    def source(self) -> str:
        """Where the numbers come from, shown to users together with the required attribution."""
        ...

    async def listings(self, limit: int) -> CryptoListings:
        """The top ``limit`` coins by market capitalization, ordered by rank."""
        ...

    async def market_totals(self) -> MarketTotals: ...

    async def fear_greed(self) -> FearGreed: ...


class LatestPriceSource(Protocol):
    """The newest stored close of many symbols at once, for valuing holdings."""

    async def latest_closes(
        self, symbols: Iterable[str], *, max_refresh: int = 3
    ) -> dict[str, LatestClose]: ...
