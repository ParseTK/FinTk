"""The provider interfaces. Services depend on these, never on a concrete data source."""

from collections.abc import Sequence
from datetime import date
from typing import Protocol

from app.domain.crypto import AnchorPrices, CryptoListings, FearGreed, MarketTotals
from app.domain.models import CompanyRef, Filing


class CompanyDirectory(Protocol):
    async def lookup(self, ticker: str) -> CompanyRef | None: ...


class FilingsProvider(Protocol):
    async def filings(self, company: CompanyRef, form: str | None, limit: int) -> list[Filing]: ...


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

    async def anchor_prices(self, ids: Sequence[int], day: date) -> AnchorPrices:
        """Each coin's price at 00:00 UTC on ``day``, to measure change since a fixed date."""
        ...
