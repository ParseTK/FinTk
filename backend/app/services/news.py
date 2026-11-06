"""Crypto news: official announcements that mention crypto, and the SEC 8-Ks of listed companies.

Official sources only (see ``app.domain.news`` and ``app.domain.crypto_news``). A source that is
down is reported as such and the others still answer; an old copy is served for up to a week if
every refresh fails.
"""

import asyncio
import logging
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime

from app.core.cache import AsyncTTLCache
from app.core.errors import AppError, UnavailableError
from app.domain.crypto_news import CRYPTO_COMPANIES, assemble_crypto_news, filing_cutoff
from app.domain.news import NewsItem, filing_news
from app.providers.feeds import CRYPTO_FEEDS, FeedProvider
from app.services.companies import CompanyService

logger = logging.getLogger(__name__)

NEWS_TTL = 15 * 60.0
NEWS_STALE = 7 * 86400.0
# The most 8-Ks looked at per company; a year of them is rarely more than a dozen.
COMPANY_FETCH = 50


def _readable(results: Sequence[list[NewsItem] | BaseException]) -> list[list[NewsItem] | None]:
    """A source that failed with one of our own errors becomes None (reported as down); anything
    else is a bug and is raised, never quietly turned into a missing source."""
    readable: list[list[NewsItem] | None] = []
    for result in results:
        if isinstance(result, list):
            readable.append(result)
        elif isinstance(result, AppError):
            readable.append(None)
        else:
            raise result
    return readable


@dataclass(frozen=True, slots=True)
class NewsDigest:
    items: tuple[NewsItem, ...]
    unavailable: tuple[str, ...]  # names of sources that could not be read this time


class NewsService:
    def __init__(self, feeds: FeedProvider, companies: CompanyService | None) -> None:
        self._feeds = feeds
        self._companies = companies
        self._crypto: AsyncTTLCache[str, NewsDigest] = AsyncTTLCache(max_entries=1)

    async def crypto_news(self, limit: int) -> NewsDigest:
        """Official crypto-related announcements, and the 8-Ks of the printed crypto companies."""
        news = await self._crypto.get_or_load(
            "crypto", self._load_crypto, ttl=NEWS_TTL, stale_ttl=NEWS_STALE
        )
        return NewsDigest(items=news.items[:limit], unavailable=news.unavailable)

    async def _load_crypto(self) -> NewsDigest:
        cutoff = filing_cutoff(datetime.now(UTC).date())
        announcements, filings = await asyncio.gather(
            asyncio.gather(
                *(self._feeds.fetch(feed) for feed in CRYPTO_FEEDS), return_exceptions=True
            ),
            asyncio.gather(
                *(self._company_events(ticker) for ticker in CRYPTO_COMPANIES),
                return_exceptions=True,
            ),
        )
        # What to keep, cap and order is the domain's rule; this only fetches and decides failure.
        items, down = assemble_crypto_news(
            list(zip((feed.name for feed in CRYPTO_FEEDS), _readable(announcements), strict=True)),
            list(zip(CRYPTO_COMPANIES, _readable(filings), strict=True)),
            cutoff,
        )
        if not items and down:
            # Nothing at all: fail, so a stale copy (if there is one) is served and nothing
            # empty is cached as if it were fresh.
            msg = "News is unavailable right now. Please try again shortly."
            raise UnavailableError(msg)
        return NewsDigest(items=tuple(items), unavailable=tuple(down))

    async def _company_events(self, ticker: str) -> list[NewsItem]:
        if self._companies is None:
            msg = "Company data is not configured on this server."
            raise UnavailableError(msg)
        company = await self._companies.resolve(ticker)
        filings = await self._companies.filings(company.ticker, "8-K", COMPANY_FETCH)
        return [item for f in filings if (item := filing_news(f, company.name)) is not None]
