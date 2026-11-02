"""Company use cases. Knows about providers through their interfaces only."""

import re

from app.core.errors import NotFoundError
from app.domain.models import (
    CompanyProfile,
    CompanyRef,
    Filing,
    MetricSeries,
    PriceHistory,
)
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
        return await self._filings.profile(await self._require(ticker))

    async def filings(self, ticker: str, form: str | None, limit: int) -> list[Filing]:
        return await self._filings.filings(await self._require(ticker), form, limit)

    async def financials(self, ticker: str, years: int) -> list[MetricSeries]:
        return await self._fundamentals.annual_metrics(await self._require(ticker), years)

    async def monthly_prices(self, ticker: str) -> PriceHistory:
        company = await self._require(ticker)
        return await self._prices.monthly_history(company.ticker)

    async def _require(self, ticker: str) -> CompanyRef:
        company = await self._directory.lookup(ticker) if is_valid_ticker(ticker) else None
        if company is None:
            msg = "No company with that ticker."
            raise NotFoundError(msg)
        return company
