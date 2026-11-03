"""Company use cases. Knows about providers through their interfaces only."""

import re
from collections.abc import Iterable

from app.core.errors import AppError, NotFoundError
from app.domain.models import (
    CompanyProfile,
    CompanyRef,
    Filing,
    MetricSeries,
    PriceHistory,
)
from app.domain.seasonality import Seasonality, build_seasonality
from app.providers.base import (
    CompanyDirectory,
    FilingsProvider,
    FundamentalsProvider,
    PriceProvider,
)

TICKER_PATTERN = re.compile(r"^[A-Za-z]{1,6}([.-][A-Za-z]{1,2})?$")


def is_valid_ticker(value: str) -> bool:
    return TICKER_PATTERN.fullmatch(value) is not None


class CompanyService:
    def __init__(
        self,
        directory: CompanyDirectory,
        filings: FilingsProvider,
        fundamentals: FundamentalsProvider,
        prices: PriceProvider,
    ) -> None:
        self._directory = directory
        self._filings = filings
        self._fundamentals = fundamentals
        self._prices = prices

    async def search(self, query: str, limit: int) -> list[CompanyRef]:
        return await self._directory.search(query, limit)

    async def profile(self, ticker: str) -> CompanyProfile:
        return await self._filings.profile(await self.resolve(ticker))

    async def filings(self, ticker: str, form: str | None, limit: int) -> list[Filing]:
        return await self._filings.filings(await self.resolve(ticker), form, limit)

    async def financials(self, ticker: str, years: int) -> list[MetricSeries]:
        return await self._fundamentals.annual_metrics(await self.resolve(ticker), years)

    async def monthly_prices(self, ticker: str) -> PriceHistory:
        company = await self.resolve(ticker)
        return await self._prices.monthly_history(company.ticker)

    async def seasonality(self, ticker: str) -> Seasonality:
        return build_seasonality(await self.monthly_prices(ticker))

    async def names(self, symbols: Iterable[str]) -> dict[str, str]:
        """Company names for display, best effort: a symbol that cannot be looked up (or a
        directory that cannot be loaded) is simply left out rather than failing the page."""
        found: dict[str, str] = {}
        for symbol in symbols:
            try:
                company = await self._directory.lookup(symbol)
            except AppError:
                break  # the directory is unavailable; every further lookup would fail the same way
            if company is not None:
                found[symbol] = company.name
        return found

    async def resolve(self, ticker: str) -> CompanyRef:
        """The directory entry for a ticker, or NotFoundError. Also validates the format."""
        company = await self._directory.lookup(ticker) if is_valid_ticker(ticker) else None
        if company is None:
            msg = "No company with that ticker."
            raise NotFoundError(msg)
        return company
