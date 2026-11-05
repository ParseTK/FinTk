"""Crypto news: official announcements that mention crypto, and the SEC 8-Ks of listed companies.

Official sources only (see ``app.domain.news`` and ``app.domain.crypto_news``). A source that is
down is reported as such and the others still answer; an old copy is served for up to a week if
every refresh fails.
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import UTC, datetime

from app.core.cache import AsyncTTLCache
from app.core.errors import AppError, UnavailableError
from app.domain.crypto_news import (
    CRYPTO_COMPANIES,
    PER_COMPANY_LIMIT,
    filing_cutoff,
    is_crypto_related,
)
from app.domain.news import NewsItem, filing_news, latest_first
from app.providers.feeds import CRYPTO_FEEDS, FeedProvider
from app.services.companies import CompanyService

logger = logging.getLogger(__name__)

NEWS_TTL = 15 * 60.0
NEWS_STALE = 7 * 86400.0
# The most 8-Ks looked at per company; a year of them is rarely more than a dozen.
COMPANY_FETCH = 50


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
        items: list[NewsItem] = []
        down: list[str] = []
        for feed, result in zip(CRYPTO_FEEDS, announcements, strict=True):
            if isinstance(result, list):
                items.extend(item for item in result if is_crypto_related(item.title))
            elif isinstance(result, AppError):
                down.append(feed.name)
            else:
                raise result
        for ticker, filed in zip(CRYPTO_COMPANIES, filings, strict=True):
            if isinstance(filed, list):
                recent = [item for item in filed if item.published >= cutoff]
                items.extend(latest_first(recent)[:PER_COMPANY_LIMIT])
            elif isinstance(filed, AppError):
                down.append(ticker)
            else:
                raise filed
        if not items and down:
            # Nothing at all: fail, so a stale copy (if there is one) is served and nothing
            # empty is cached as if it were fresh.
            msg = "News is unavailable right now. Please try again shortly."
            raise UnavailableError(msg)
        unique = {item.url: item for item in items}  # the two CFTC feeds can repeat an item
        return NewsDigest(items=tuple(latest_first(list(unique.values()))), unavailable=tuple(down))

    async def _company_events(self, ticker: str) -> list[NewsItem]:
        if self._companies is None:
            msg = "Company data is not configured on this server."
            raise UnavailableError(msg)
        company = await self._companies.resolve(ticker)
        filings = await self._companies.filings(company.ticker, "8-K", COMPANY_FETCH)
        return [item for f in filings if (item := filing_news(f, company.name)) is not None]
