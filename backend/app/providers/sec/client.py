"""SEC EDGAR provider: the ticker directory and a company's recent filings.

Used for the filings of crypto-related public companies in the crypto news. EDGAR is key-less but
asks for a User-Agent that identifies the caller with a contact address, and blocks clients above
10 requests per second. We cap at 8 and cache everything.

Raw documents are never cached: a submissions document is decoded and reduced to the filings we
serve, and only that small result is kept. The decode runs in a worker thread so other requests and
I/O interleave with it (the C JSON decoder holds the GIL for its whole run, so a cold company still
costs other requests a short hiccup; it happens once per company per cache lifetime).
"""

import asyncio
import json
import logging
from collections.abc import Callable, Mapping
from itertools import islice
from typing import Any, cast

import httpx

from app.core.cache import AsyncTTLCache
from app.core.errors import UpstreamError
from app.core.http import build_client
from app.core.rate_limit import AsyncRateLimiter
from app.domain.models import CompanyRef, Filing
from app.providers.sec import parsers

logger = logging.getLogger(__name__)

DIRECTORY_URL = "https://www.sec.gov/files/company_tickers_exchange.json"
SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"

REQUESTS_PER_SECOND = 8.0
TIMEOUT = httpx.Timeout(15.0, connect=5.0)
RETRYABLE_STATUS = frozenset({429, 500, 502, 503, 504})

DIRECTORY_TTL = 6 * 3600.0
DIRECTORY_STALE = 7 * 86400.0
SUBMISSIONS_TTL = 15 * 60.0
STALE = 7 * 86400.0  # how long an old copy may be served if the SEC is down


def build_user_agent(contact_email: str) -> str:
    return f"Virello/0.1 ({contact_email})"


def build_http_client(contact_email: str) -> httpx.AsyncClient:
    return build_client(
        headers={"User-Agent": build_user_agent(contact_email), "Accept": "application/json"},
        timeout=TIMEOUT,
    )


def normalise_ticker(ticker: str) -> str:
    return ticker.strip().upper().replace(".", "-")


class DirectoryIndex:
    """The ticker directory, keyed by normalised ticker."""

    def __init__(self, companies: list[CompanyRef]) -> None:
        self._by_ticker = {c.ticker: c for c in companies}

    def lookup(self, ticker: str) -> CompanyRef | None:
        return self._by_ticker.get(normalise_ticker(ticker))


class SecProvider:
    """Implements the directory and filings provider interfaces."""

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
        self._filings: AsyncTTLCache[str, tuple[Filing, ...]] = AsyncTTLCache(max_entries=256)

    # -- CompanyDirectory -------------------------------------------------------------------

    async def lookup(self, ticker: str) -> CompanyRef | None:
        return (await self._index()).lookup(ticker)

    # -- FilingsProvider --------------------------------------------------------------------

    async def filings(self, company: CompanyRef, form: str | None, limit: int) -> list[Filing]:
        everything = await self._recent(company)
        matching = (f for f in everything if form is None or f.form == form)
        return list(islice(matching, limit))

    # -- internals --------------------------------------------------------------------------

    async def _index(self) -> DirectoryIndex:
        async def load() -> DirectoryIndex:
            return await self._download(
                DIRECTORY_URL, lambda payload: DirectoryIndex(parsers.parse_directory(payload))
            )

        return await self._directory.get_or_load(
            "directory", load, ttl=DIRECTORY_TTL, stale_ttl=DIRECTORY_STALE
        )

    async def _recent(self, company: CompanyRef) -> tuple[Filing, ...]:
        async def load() -> tuple[Filing, ...]:
            return await self._download(
                SUBMISSIONS_URL.format(cik=company.cik),
                lambda payload: parsers.parse_recent_filings(payload, company.cik),
            )

        return await self._filings.get_or_load(
            company.cik, load, ttl=SUBMISSIONS_TTL, stale_ttl=STALE
        )

    async def _download[T](self, url: str, reduce: Callable[[Mapping[str, Any]], T]) -> T:
        """Fetch a document, then decode and reduce it off the event loop."""
        content = await self._fetch(url)
        try:
            return await asyncio.to_thread(_decode_and_reduce, content, reduce)
        except (ValueError, KeyError, IndexError, TypeError) as error:
            logger.error("unreadable SEC document: %s", type(error).__name__, exc_info=True)
            msg = "The SEC data service returned an unreadable response."
            raise UpstreamError(msg) from error

    async def _fetch(self, url: str) -> bytes:
        """GET one document, retrying once on a transient failure."""
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
                if response.status_code in RETRYABLE_STATUS and attempt == 1:
                    pass
                elif response.is_success:
                    return response.content
                else:
                    logger.warning("SEC returned status %s", response.status_code)
                    msg = "The SEC data service returned an error."
                    raise UpstreamError(msg)
            await asyncio.sleep(self._retry_delay)
        msg = "The SEC data service is unavailable."  # unreachable; keeps the type checker honest
        raise UpstreamError(msg)


def _decode_and_reduce[T](content: bytes, reduce: Callable[[Mapping[str, Any]], T]) -> T:
    """Runs in a worker thread: parse the JSON and keep only what we serve."""
    payload = json.loads(content)
    if not isinstance(payload, dict):
        msg = "unexpected document shape"
        raise ValueError(msg)
    return reduce(cast("Mapping[str, Any]", payload))
