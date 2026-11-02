"""SEC EDGAR provider: ticker directory, company profile, filings and annual fundamentals.

EDGAR is key-less but asks for a User-Agent that identifies the caller with a contact address, and
blocks clients above 10 requests per second. We cap at 8 and cache everything.
"""

import asyncio
import logging
from collections.abc import Mapping
from typing import Any, cast

import httpx

from app.core.cache import AsyncTTLCache
from app.core.errors import UpstreamError
from app.core.rate_limit import AsyncRateLimiter
from app.domain.models import CompanyProfile, CompanyRef, Filing, MetricSeries
from app.providers.sec import parsers

logger = logging.getLogger(__name__)

DIRECTORY_URL = "https://www.sec.gov/files/company_tickers_exchange.json"
SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"

REQUESTS_PER_SECOND = 8.0
TIMEOUT = httpx.Timeout(15.0, connect=5.0)
RETRYABLE_STATUS = frozenset({429, 500, 502, 503, 504})

DIRECTORY_TTL = 6 * 3600.0
DIRECTORY_STALE = 7 * 86400.0
SUBMISSIONS_TTL = 15 * 60.0
FACTS_TTL = 6 * 3600.0  # annual figures change a few times a year
STALE = 24 * 3600.0


def build_user_agent(contact_email: str) -> str:
    return f"Virello/0.1 ({contact_email})"


def build_http_client(contact_email: str) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        headers={"User-Agent": build_user_agent(contact_email), "Accept": "application/json"},
        timeout=TIMEOUT,
        follow_redirects=False,
    )


class DirectoryIndex:
    """The ticker directory with a ticker lookup and ranked name search."""

    def __init__(self, companies: list[CompanyRef]) -> None:
        self._companies = companies
        self._by_ticker = {c.ticker: c for c in companies}

    def lookup(self, ticker: str) -> CompanyRef | None:
        return self._by_ticker.get(normalise_ticker(ticker))

    def search(self, query: str, limit: int) -> list[CompanyRef]:
        needle = query.strip().casefold()
        if not needle:
            return []
        ranked: list[tuple[int, int, str, CompanyRef]] = []  # rank, name length, ticker
        for company in self._companies:
            rank = _rank(needle, company)
            if rank is not None:
                ranked.append((rank, len(company.name), company.ticker, company))
        ranked.sort(key=lambda item: item[:3])
        return [item[3] for item in ranked[:limit]]


def normalise_ticker(ticker: str) -> str:
    return ticker.strip().upper().replace(".", "-")


def _rank(needle: str, company: CompanyRef) -> int | None:
    ticker, name = company.ticker.casefold(), company.name.casefold()
    if needle == ticker:
        return 0
    if ticker.startswith(needle):
        return 1
    if name.startswith(needle):
        return 2
    if any(word.startswith(needle) for word in name.replace(",", " ").split()):
        return 3
    if needle in name:
        return 4
    return None


class SecProvider:
    """Implements the directory, filings and fundamentals provider interfaces."""

    def __init__(
        self,
        client: httpx.AsyncClient,
        *,
        limiter: AsyncRateLimiter | None = None,
        retry_delay: float = 1.0,
    ) -> None:
        self._client = client
        self._limiter = limiter or AsyncRateLimiter(REQUESTS_PER_SECOND)
        self._retry_delay = retry_delay
        self._directory: AsyncTTLCache[str, DirectoryIndex] = AsyncTTLCache(max_entries=1)
        self._documents: AsyncTTLCache[str, Mapping[str, Any]] = AsyncTTLCache(max_entries=256)

    # -- CompanyDirectory -------------------------------------------------------------------

    async def lookup(self, ticker: str) -> CompanyRef | None:
        return (await self._index()).lookup(ticker)

    async def search(self, query: str, limit: int) -> list[CompanyRef]:
        return (await self._index()).search(query, limit)

    # -- FilingsProvider --------------------------------------------------------------------

    async def profile(self, company: CompanyRef) -> CompanyProfile:
        return parsers.parse_profile(await self._submissions(company), company)

    async def filings(self, company: CompanyRef, form: str | None, limit: int) -> list[Filing]:
        return parsers.parse_filings(await self._submissions(company), company.cik, form, limit)

    # -- FundamentalsProvider ---------------------------------------------------------------

    async def annual_metrics(self, company: CompanyRef, years: int) -> list[MetricSeries]:
        payload = await self._document(
            FACTS_URL.format(cik=company.cik), FACTS_TTL, missing_ok=True
        )
        return parsers.parse_annual_metrics(payload, years)

    # -- internals --------------------------------------------------------------------------

    async def _index(self) -> DirectoryIndex:
        async def load() -> DirectoryIndex:
            payload = await self._fetch_json(DIRECTORY_URL)
            try:
                return DirectoryIndex(parsers.parse_directory(payload))
            except (ValueError, KeyError, IndexError, TypeError) as error:
                logger.error("unreadable SEC company directory", exc_info=True)
                msg = "The SEC company directory could not be read."
                raise UpstreamError(msg) from error

        return await self._directory.get_or_load(
            "directory", load, ttl=DIRECTORY_TTL, stale_ttl=DIRECTORY_STALE
        )

    async def _submissions(self, company: CompanyRef) -> Mapping[str, Any]:
        return await self._document(SUBMISSIONS_URL.format(cik=company.cik), SUBMISSIONS_TTL)

    async def _document(
        self, url: str, ttl: float, *, missing_ok: bool = False
    ) -> Mapping[str, Any]:
        async def load() -> Mapping[str, Any]:
            return await self._fetch_json(url, missing_ok=missing_ok)

        return await self._documents.get_or_load(url, load, ttl=ttl, stale_ttl=STALE)

    async def _fetch_json(self, url: str, *, missing_ok: bool = False) -> Mapping[str, Any]:
        """GET one JSON document, retrying once on a transient failure."""
        for attempt in (1, 2):
            await self._limiter.acquire()
            try:
                response = await self._client.get(url)
            except httpx.TransportError as error:
                if attempt == 2:
                    logger.warning("SEC request failed: %s", type(error).__name__)
                    msg = "The SEC data service is unreachable."
                    raise UpstreamError(msg) from error
            else:
                if response.status_code == 404 and missing_ok:
                    return dict[str, Any]()
                if response.status_code in RETRYABLE_STATUS and attempt == 1:
                    pass
                elif response.is_success:
                    return self._decode(response)
                else:
                    logger.warning("SEC returned status %s", response.status_code)
                    msg = "The SEC data service returned an error."
                    raise UpstreamError(msg)
            await self._pause()
        msg = "The SEC data service is unavailable."  # unreachable; keeps the type checker honest
        raise UpstreamError(msg)

    @staticmethod
    def _decode(response: httpx.Response) -> Mapping[str, Any]:
        try:
            payload = response.json()
        except ValueError as error:
            msg = "The SEC data service returned an unreadable response."
            raise UpstreamError(msg) from error
        if not isinstance(payload, dict):
            msg = "The SEC data service returned an unexpected response."
            raise UpstreamError(msg)
        return cast("Mapping[str, Any]", payload)

    async def _pause(self) -> None:
        await asyncio.sleep(self._retry_delay)
