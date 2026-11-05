"""Company filings use cases. Knows about providers through their interfaces only."""

import re

from app.core.errors import NotFoundError
from app.domain.models import CompanyRef, Filing
from app.providers.base import CompanyDirectory, FilingsProvider

TICKER_PATTERN = re.compile(r"^[A-Za-z]{1,6}([.-][A-Za-z]{1,2})?$")


def is_valid_ticker(value: str) -> bool:
    return TICKER_PATTERN.fullmatch(value) is not None


class CompanyService:
    """Looks up a public company in the SEC directory and lists its filings."""

    def __init__(self, directory: CompanyDirectory, filings: FilingsProvider) -> None:
        self._directory = directory
        self._filings = filings

    async def filings(self, ticker: str, form: str | None, limit: int) -> list[Filing]:
        return await self._filings.filings(await self.resolve(ticker), form, limit)

    async def resolve(self, ticker: str) -> CompanyRef:
        """The directory entry for a ticker, or NotFoundError. Also validates the format."""
        company = await self._directory.lookup(ticker) if is_valid_ticker(ticker) else None
        if company is None:
            msg = "No company with that ticker."
            raise NotFoundError(msg)
        return company
