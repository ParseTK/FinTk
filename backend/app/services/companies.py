"""Company use cases. Knows about providers through their interfaces only."""

import logging
import re
from collections.abc import Iterable

from app.core.errors import AppError, NotFoundError
from app.domain.models import (
    CompanyProfile,
    CompanyRef,
    Filing,
    LatestClose,
    MetricSeries,
    PriceHistory,
)
from app.domain.ratios import RatioSeries, compute_ratios
from app.domain.seasonality import Seasonality, build_seasonality
from app.providers.base import (
    CompanyDirectory,
    FilingsProvider,
    FundamentalsProvider,
    LatestPriceSource,
    PriceProvider,
)

logger = logging.getLogger(__name__)

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
        latest: LatestPriceSource | None = None,
    ) -> None:
        self._directory = directory
        self._filings = filings
        self._fundamentals = fundamentals
        self._prices = prices
        self._latest = latest

    async def search(self, query: str, limit: int) -> list[CompanyRef]:
        return await self._directory.search(query, limit)

    async def profile(self, ticker: str) -> CompanyProfile:
        return await self._filings.profile(await self.resolve(ticker))

    async def filings(self, ticker: str, form: str | None, limit: int) -> list[Filing]:
        return await self._filings.filings(await self.resolve(ticker), form, limit)

    async def financials(self, ticker: str, years: int) -> list[MetricSeries]:
        return await self._fundamentals.annual_metrics(await self.resolve(ticker), years)

    @staticmethod
    def ratios(metrics: list[MetricSeries]) -> list[RatioSeries]:
        """Ratios worked out from the annual figures (pure arithmetic, no provider call)."""
        return compute_ratios(metrics)

    async def monthly_prices(self, ticker: str) -> PriceHistory:
        company = await self.resolve(ticker)
        return await self._prices.monthly_history(company.ticker)

    async def seasonality(self, ticker: str) -> Seasonality:
        return build_seasonality(await self.monthly_prices(ticker))

    async def latest_prices(self, symbols: Iterable[str]) -> dict[str, LatestClose]:
        """Newest stored close per symbol, best effort: with no price store, or if it fails, the
        answer is simply empty (a value is a nice-to-have, never a reason to fail a page)."""
        if self._latest is None:
            return {}
        try:
            return await self._latest.latest_closes(symbols)
        except AppError:
            logger.warning("latest prices unavailable", exc_info=True)
            return {}

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
