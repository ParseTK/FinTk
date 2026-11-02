"""SEC EDGAR provider: ticker directory, company profile, filings and annual fundamentals.

EDGAR is key-less but asks for a User-Agent that identifies the caller with a contact address, and
blocks clients above 10 requests per second. We cap at 8 and cache everything.

Memory and CPU discipline. Measured on real data: a company's facts document is 4-5 MB on the
wire and 16-22 MB once parsed, so forty cached companies cost about 800 MB. Raw documents are
therefore never cached: each download is decoded and reduced to the few hundred values we serve,
and only that small result is kept (about 36 MB for the same forty companies).

The decode runs in a worker thread so other requests and I/O interleave with it. Be aware of the
limit of that: the C JSON decoder holds the GIL for its whole run, so a cold company still costs
other requests a hiccup of roughly 30-50 ms. That is acceptable because it happens once per
company per cache lifetime and cold loads are capped at 8 per second. A process pool would isolate
it fully, at the price of crash handling and a second interpreter's memory.
"""

import asyncio
import json
import logging
from collections.abc import Callable, Mapping
from dataclasses import dataclass, replace
from itertools import islice
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
MAX_YEARS = 20  # the most years the API serves; fewer are sliced from this at request time
FACTS_TTL = 24 * 3600.0  # annual figures change only when a company files a 10-K
STALE = 7 * 86400.0  # how long an old copy may be served if the SEC is down


def build_user_agent(contact_email: str) -> str:
    return f"Virello/0.1 ({contact_email})"


def build_http_client(contact_email: str) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        headers={"User-Agent": build_user_agent(contact_email), "Accept": "application/json"},
        timeout=TIMEOUT,
        follow_redirects=False,
    )


@dataclass(frozen=True, slots=True)
class _Entry:
    """A company plus its lowercase search keys, computed once when the directory loads."""

    company: CompanyRef
    ticker: str
    name: str
    words: tuple[str, ...]


class DirectoryIndex:
    """The ticker directory with a ticker lookup and ranked name search.

    Search is a scan over about ten thousand companies, run on every keystroke of a search box. The
    lowercase keys are therefore built once here instead of on every request, and the ranked
    results of recent queries are remembered.
    """

    SEARCH_CACHE_SIZE = 512

    def __init__(self, companies: list[CompanyRef]) -> None:
        self._by_ticker = {c.ticker: c for c in companies}
        self._entries = tuple(
            _Entry(
                company=c,
                ticker=c.ticker.casefold(),
                name=c.name.casefold(),
                words=tuple(c.name.casefold().replace(",", " ").split()),
            )
            for c in companies
        )
        self._recent: dict[str, tuple[CompanyRef, ...]] = {}

    def lookup(self, ticker: str) -> CompanyRef | None:
        return self._by_ticker.get(normalise_ticker(ticker))

    def search(self, query: str, limit: int) -> list[CompanyRef]:
        needle = query.strip().casefold()
        if not needle:
            return []
        ranked = self._recent.get(needle)
        if ranked is None:
            ranked = self._rank_all(needle)
            if len(self._recent) >= self.SEARCH_CACHE_SIZE:
                self._recent.pop(
                    next(iter(self._recent))
                )  # oldest first: dicts keep insertion order
            self._recent[needle] = ranked
        return list(ranked[:limit])

    def _rank_all(self, needle: str) -> tuple[CompanyRef, ...]:
        scored: list[tuple[int, int, str, CompanyRef]] = []  # rank, name length, ticker
        for entry in self._entries:
            rank = _rank(needle, entry)
            if rank is not None:
                scored.append((rank, len(entry.name), entry.company.ticker, entry.company))
        scored.sort(key=lambda item: item[:3])
        return tuple(item[3] for item in scored)


def normalise_ticker(ticker: str) -> str:
    return ticker.strip().upper().replace(".", "-")


def _rank(needle: str, entry: _Entry) -> int | None:
    if needle == entry.ticker:
        return 0
    if entry.ticker.startswith(needle):
        return 1
    if entry.name.startswith(needle):
        return 2
    if any(word.startswith(needle) for word in entry.words):
        return 3
    if needle in entry.name:
        return 4
    return None


@dataclass(frozen=True, slots=True)
class _Submissions:
    """What we keep from a company's submissions document: small, and already parsed."""

    profile: CompanyProfile
    filings: tuple[Filing, ...]


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
        self._submissions: AsyncTTLCache[str, _Submissions] = AsyncTTLCache(max_entries=256)
        self._facts: AsyncTTLCache[str, tuple[MetricSeries, ...]] = AsyncTTLCache(max_entries=256)

    # -- CompanyDirectory -------------------------------------------------------------------

    async def lookup(self, ticker: str) -> CompanyRef | None:
        return (await self._index()).lookup(ticker)

    async def search(self, query: str, limit: int) -> list[CompanyRef]:
        return (await self._index()).search(query, limit)

    # -- FilingsProvider --------------------------------------------------------------------

    async def profile(self, company: CompanyRef) -> CompanyProfile:
        return (await self._company(company)).profile

    async def filings(self, company: CompanyRef, form: str | None, limit: int) -> list[Filing]:
        everything = (await self._company(company)).filings
        matching = (f for f in everything if form is None or f.form == form)
        return list(islice(matching, limit))

    # -- FundamentalsProvider ---------------------------------------------------------------

    async def annual_metrics(self, company: CompanyRef, years: int) -> list[MetricSeries]:
        async def load() -> tuple[MetricSeries, ...]:
            return await self._download(
                FACTS_URL.format(cik=company.cik),
                lambda payload: tuple(parsers.parse_annual_metrics(payload, MAX_YEARS)),
                missing_ok=True,
            )

        series = await self._facts.get_or_load(company.cik, load, ttl=FACTS_TTL, stale_ttl=STALE)
        return [replace(item, values=item.values[:years]) for item in series]

    # -- internals --------------------------------------------------------------------------

    async def _index(self) -> DirectoryIndex:
        async def load() -> DirectoryIndex:
            return await self._download(
                DIRECTORY_URL, lambda payload: DirectoryIndex(parsers.parse_directory(payload))
            )

        return await self._directory.get_or_load(
            "directory", load, ttl=DIRECTORY_TTL, stale_ttl=DIRECTORY_STALE
        )

    async def _company(self, company: CompanyRef) -> _Submissions:
        async def load() -> _Submissions:
            return await self._download(
                SUBMISSIONS_URL.format(cik=company.cik),
                lambda payload: _Submissions(
                    profile=parsers.parse_profile(payload, company),
                    filings=parsers.parse_recent_filings(payload, company.cik),
                ),
            )

        return await self._submissions.get_or_load(
            company.cik, load, ttl=SUBMISSIONS_TTL, stale_ttl=STALE
        )

    async def _download[T](
        self,
        url: str,
        reduce: Callable[[Mapping[str, Any]], T],
        *,
        missing_ok: bool = False,
    ) -> T:
        """Fetch a document, then decode and reduce it off the event loop."""
        content = await self._fetch(url, missing_ok=missing_ok)
        try:
            return await asyncio.to_thread(_decode_and_reduce, content, reduce)
        except (ValueError, KeyError, IndexError, TypeError) as error:
            logger.error("unreadable SEC document: %s", type(error).__name__, exc_info=True)
            msg = "The SEC data service returned an unreadable response."
            raise UpstreamError(msg) from error

    async def _fetch(self, url: str, *, missing_ok: bool) -> bytes:
        """GET one document, retrying once on a transient failure. Empty for a tolerated 404."""
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
                    return b""
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
    """Runs in a worker thread: parse the JSON and keep only what we serve. Empty means none."""
    if not content:
        return reduce({})
    payload = json.loads(content)
    if not isinstance(payload, dict):
        msg = "unexpected document shape"
        raise ValueError(msg)
    return reduce(cast("Mapping[str, Any]", payload))
