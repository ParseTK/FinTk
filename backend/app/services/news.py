"""News use cases: market-wide official announcements, and a company's own SEC 8-K events.

Official sources only (see ``app.domain.news``). A source that is down is reported as such and the
others still answer; an old copy is served for up to a week if every refresh fails.
"""

import asyncio
import logging
from dataclasses import dataclass

from app.core.cache import AsyncTTLCache
from app.core.errors import AppError, UnavailableError
from app.domain.news import NewsItem, filing_news, latest_first
from app.providers.feeds import Feed, FeedProvider
from app.services.companies import CompanyService

logger = logging.getLogger(__name__)

MARKET_TTL = 15 * 60.0
MARKET_STALE = 7 * 86400.0
# The most 8-Ks looked at per company; a year of them is rarely more than a dozen.
COMPANY_FETCH = 50


@dataclass(frozen=True, slots=True)
class MarketNews:
    items: tuple[NewsItem, ...]
    unavailable: tuple[str, ...]  # names of sources that could not be read this time


class NewsService:
    def __init__(self, feeds: FeedProvider, companies: CompanyService | None) -> None:
        self._feeds = feeds
        self._companies = companies
        self._market: AsyncTTLCache[str, MarketNews] = AsyncTTLCache(max_entries=1)

    async def market_news(self, limit: int) -> MarketNews:
        news = await self._market.get_or_load(
            "market", self._load_market, ttl=MARKET_TTL, stale_ttl=MARKET_STALE
        )
        return MarketNews(items=news.items[:limit], unavailable=news.unavailable)

    async def _load_market(self) -> MarketNews:
        feeds = self._feeds.feeds
        results = await asyncio.gather(
            *(self._feeds.fetch(feed) for feed in feeds), return_exceptions=True
        )
        items: list[NewsItem] = []
        down: list[str] = []
        for feed, result in zip(feeds, results, strict=True):
            self._collect(feed, result, items, down)
        if not items and down:
            # Nothing at all: fail, so a stale copy (if there is one) is served and nothing
            # empty is cached as if it were fresh.
            msg = "News is unavailable right now. Please try again shortly."
            raise UnavailableError(msg)
        return MarketNews(items=tuple(latest_first(items)), unavailable=tuple(down))

    @staticmethod
    def _collect(
        feed: Feed, result: list[NewsItem] | BaseException, items: list[NewsItem], down: list[str]
    ) -> None:
        if isinstance(result, list):
            items.extend(result)
        elif isinstance(result, AppError):
            down.append(feed.name)
        else:
            raise result  # not a provider failure: a bug, let it surface

    async def company_news(self, ticker: str, limit: int) -> list[NewsItem]:
        """The company's recent Form 8-K events, newest first."""
        if self._companies is None:
            msg = "Company data is not configured on this server."
            raise UnavailableError(msg)
        company = await self._companies.resolve(ticker)
        filings = await self._companies.filings(company.ticker, "8-K", COMPANY_FETCH)
        events = [item for f in filings if (item := filing_news(f, company.name)) is not None]
        return latest_first(events)[:limit]
