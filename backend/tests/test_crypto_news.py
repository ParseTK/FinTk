"""Crypto news: the printed keyword rule, the printed company list, and how they are combined.

Headlines and filings here are invented. The feeds and the SEC are replaced by small fakes.
"""

from datetime import UTC, date, datetime, timedelta
from typing import cast

import httpx
import pytest

from app.core.errors import NotFoundError, UnavailableError, UpstreamError
from app.domain.crypto_news import (
    CRYPTO_COMPANIES,
    CRYPTO_TERMS,
    FILING_DAYS,
    filing_cutoff,
    is_crypto_related,
)
from app.domain.models import CompanyRef, Filing
from app.domain.news import NewsItem
from app.main import create_app
from app.providers.feeds import CRYPTO_FEEDS, Feed, FeedProvider
from app.services.companies import CompanyService
from app.services.news import NewsService
from tests.conftest import make_settings

TODAY = datetime.now(UTC).date()


# -- the keyword rule --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "title",
    [
        "SEC Charges Founder of Crypto Trading Platform",
        "CFTC Announces Digital Assets Pilot Program",
        "Man Sentenced for Bitcoin Fraud",
        "A BLOCKCHAIN roundtable",
        "Statement on stablecoins",
        "Virtual currency exchange charged",
        "Crypto-asset custody guidance",
    ],
)
def test_headlines_with_a_printed_term_match(title: str) -> None:
    assert is_crypto_related(title)


@pytest.mark.parametrize(
    "title",
    [
        "CFTC and USDA Sign MOU to Protect Integrity of American Agricultural Markets",
        "New cryptography standards for payment systems",  # "crypto" only inside another word
        "Cryptic crossword fraud scheme",
        "Digital transformation of the Division of Examinations",  # "digital" alone is not enough
        "",
    ],
)
def test_other_headlines_do_not(title: str) -> None:
    assert not is_crypto_related(title)


def test_the_printed_lists_are_plain_and_short() -> None:
    assert all(term == term.lower() and term.strip() == term for term in CRYPTO_TERMS)
    assert len(set(CRYPTO_COMPANIES)) == len(CRYPTO_COMPANIES) <= 12
    assert all(ticker.isupper() for ticker in CRYPTO_COMPANIES)


def test_the_filing_window() -> None:
    assert filing_cutoff(date(2026, 11, 4)) == date(2026, 11, 4) - timedelta(days=FILING_DAYS)


def test_the_crypto_feeds_are_fixed_https_and_on_their_own_hosts() -> None:
    for feed in CRYPTO_FEEDS:
        assert feed.url.startswith("https://")
        assert feed.host in feed.url


# -- the service -------------------------------------------------------------------------------


def announcement(source: str, title: str, days_ago: int, slug: str) -> NewsItem:
    return NewsItem(
        source,
        "press_release",
        title,
        TODAY - timedelta(days=days_ago),
        f"https://example.gov/{slug}",
    )


class Feeds:
    """Stands in for FeedProvider: items per feed name, or a failure."""

    feeds = CRYPTO_FEEDS

    def __init__(self, items: dict[str, list[NewsItem]], down: set[str] | None = None) -> None:
        self._items = items
        self._down = down or set()
        self.calls = 0

    async def fetch(self, feed: Feed) -> list[NewsItem]:
        self.calls += 1
        if feed.name in self._down:
            msg = "down"
            raise UpstreamError(msg)
        return self._items.get(feed.name, [])


class Companies:
    """Stands in for CompanyService: each known ticker has some 8-Ks (days ago, item numbers)."""

    def __init__(self, filings: dict[str, list[tuple[int, tuple[str, ...]]]]) -> None:
        self._filings = filings

    async def resolve(self, ticker: str) -> CompanyRef:
        if ticker not in self._filings:
            msg = "No company with that ticker."
            raise NotFoundError(msg)
        return CompanyRef("0000000001", ticker, f"{ticker} Corp", None)

    async def filings(self, ticker: str, form: str | None, limit: int) -> list[Filing]:
        assert form == "8-K"
        return [
            Filing(
                f"0001-{n}",
                "8-K",
                TODAY - timedelta(days=ago),
                None,
                "8-K",
                f"https://sec/{ticker}/{n}",
                items,
            )
            for n, (ago, items) in enumerate(self._filings[ticker])
        ]


def service(feeds: Feeds, companies: Companies | None) -> NewsService:
    return NewsService(cast(FeedProvider, feeds), cast(CompanyService | None, companies))


ALL_COMPANIES = {ticker: [(5, ("2.02", "9.01"))] for ticker in CRYPTO_COMPANIES}


async def test_only_crypto_headlines_and_recent_company_8ks_are_included_newest_first() -> None:
    feeds = Feeds(
        {
            "SEC": [
                announcement("SEC", "SEC charges crypto platform", 3, "a"),
                announcement("SEC", "SEC adopts audit rule", 1, "b"),
            ],
            "Department of Justice": [
                announcement("Department of Justice", "Bitcoin fraud", 9, "c")
            ],
        }
    )
    filings = {**ALL_COMPANIES, "COIN": [(2, ("8.01",)), (200, ("2.02",))]}
    news = await service(feeds, Companies(filings)).crypto_news(100)

    titles = [item.title for item in news.items]
    assert "SEC adopts audit rule" not in titles
    assert "SEC charges crypto platform" in titles
    assert "Bitcoin fraud" in titles
    # One recent 8-K per company; COIN's 200-day-old one is outside the window.
    assert sum(item.kind == "filing" for item in news.items) == len(CRYPTO_COMPANIES)
    assert all(
        item.published >= filing_cutoff(TODAY) for item in news.items if item.kind == "filing"
    )
    dates = [item.published for item in news.items]
    assert dates == sorted(dates, reverse=True)
    assert news.unavailable == ()


async def test_an_item_that_two_feeds_repeat_is_shown_once() -> None:
    same = announcement("CFTC", "CFTC charges crypto firm", 1, "same")
    feeds = Feeds({"CFTC": [same], "CFTC enforcement": [same]})
    news = await service(feeds, Companies({})).crypto_news(10)
    assert [item.url for item in news.items].count(same.url) == 1


async def test_nothing_matching_is_an_honest_empty_list_not_an_error() -> None:
    feeds = Feeds({"SEC": [announcement("SEC", "SEC adopts audit rule", 1, "b")]})
    news = await service(feeds, Companies({ticker: [] for ticker in CRYPTO_COMPANIES})).crypto_news(
        10
    )
    assert news.items == ()
    assert news.unavailable == ()


async def test_a_source_or_company_that_fails_is_named_and_the_rest_still_answers() -> None:
    feeds = Feeds(
        {"CFTC": [announcement("CFTC", "CFTC statement on stablecoins", 1, "x")]},
        down={"SEC"},
    )
    filings = {k: v for k, v in ALL_COMPANIES.items() if k != "RIOT"}  # RIOT is not found
    news = await service(feeds, Companies(filings)).crypto_news(100)
    assert set(news.unavailable) == {"SEC", "RIOT"}
    assert any(item.title == "CFTC statement on stablecoins" for item in news.items)


async def test_everything_down_is_unavailable_and_is_not_cached_as_empty() -> None:
    feeds = Feeds({}, down={feed.name for feed in CRYPTO_FEEDS})
    svc = service(feeds, Companies({}))
    with pytest.raises(UnavailableError):
        await svc.crypto_news(10)
    calls = feeds.calls
    with pytest.raises(UnavailableError):
        await svc.crypto_news(10)
    assert feeds.calls > calls  # asked again, not served from a cached failure


async def test_without_company_data_only_the_announcements_are_missing_filings() -> None:
    feeds = Feeds({"SEC": [announcement("SEC", "SEC and crypto custody", 1, "z")]})
    news = await service(feeds, None).crypto_news(10)
    assert [item.title for item in news.items] == ["SEC and crypto custody"]
    assert set(news.unavailable) == set(CRYPTO_COMPANIES)


async def test_the_limit_applies_and_results_are_cached() -> None:
    feeds = Feeds(
        {"SEC": [announcement("SEC", f"Crypto item {n}", n, str(n)) for n in range(1, 8)]}
    )
    svc = service(feeds, Companies({ticker: [] for ticker in CRYPTO_COMPANIES}))
    assert len((await svc.crypto_news(3)).items) == 3
    calls = feeds.calls
    assert len((await svc.crypto_news(5)).items) == 5
    assert feeds.calls == calls


# -- HTTP --------------------------------------------------------------------------------------


async def test_the_endpoint_prints_its_rules_and_validates_the_limit() -> None:
    feeds = Feeds({"SEC": [announcement("SEC", "SEC charges crypto platform", 3, "a")]})
    app = create_app(make_settings(), news_service=service(feeds, Companies(ALL_COMPANIES)))
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/news/crypto", params={"limit": 5})
        assert response.status_code == 200
        body = response.json()
        assert body["terms"] == list(CRYPTO_TERMS)
        assert body["companies"] == list(CRYPTO_COMPANIES)
        assert "No opinions" in body["basis"]
        assert len(body["items"]) == 5
        assert response.headers["cache-control"] == "public, max-age=300"
        assert (await client.get("/api/v1/news/crypto", params={"limit": 0})).status_code == 422


async def test_without_a_news_service_the_endpoint_is_a_clean_503() -> None:
    app = create_app(make_settings())
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        assert (await client.get("/api/v1/news/crypto")).status_code == 503
