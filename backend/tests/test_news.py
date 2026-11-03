from collections.abc import Callable
from datetime import date
from pathlib import Path

import httpx
import pytest

from app.core.errors import AppError, UnavailableError, UpstreamError
from app.domain.models import Filing
from app.domain.news import NewsItem, eight_k_title, filing_news, latest_first
from app.main import create_app
from app.providers.feeds import FEEDS, MAX_BYTES, Feed, FeedProvider, parse_feed
from app.providers.sec import parsers
from app.providers.sec.client import SecProvider
from app.services.companies import CompanyService
from app.services.news import NewsService
from tests.conftest import make_settings
from tests.test_sec_provider import NoWait, Upstream

FIXTURES = Path(__file__).parent / "fixtures"
FED, SEC = FEEDS


def fixture(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def rss(*items: str) -> bytes:
    channel = "".join(items)
    return f"<?xml version='1.0'?><rss version='2.0'><channel>{channel}</channel></rss>".encode()


def item(
    title: str = "A headline",
    link: str = "https://www.federalreserve.gov/newsevents/pressreleases/x.htm",
    pub: str = "Thu, 29 Oct 2026 20:30:00 GMT",
) -> str:
    return f"<item><title>{title}</title><link>{link}</link><pubDate>{pub}</pubDate></item>"


# -- 8-K titles --------------------------------------------------------------------------------


def test_an_earnings_8k_is_named_by_the_secs_own_item_title_and_drops_the_exhibit_item() -> None:
    assert eight_k_title(("2.02", "9.01")) == "Results of Operations and Financial Condition"


def test_several_events_in_one_filing_are_all_listed() -> None:
    title = eight_k_title(("5.02", "8.01"))
    assert title.startswith("Departure of Directors or Certain Officers")
    assert title.endswith("Other Events")


def test_exhibits_alone_and_unknown_numbers_are_never_invented_into_something_else() -> None:
    assert eight_k_title(("9.01",)) == "Financial Statements and Exhibits"
    assert eight_k_title(("9.99",)) == "Item 9.99"
    assert eight_k_title(()) == "Current report"


def filing(form: str, items: tuple[str, ...]) -> Filing:
    return Filing("0001-26-1", form, date(2026, 10, 29), None, form, "https://www.sec.gov/x", items)


def test_only_8ks_are_company_events() -> None:
    assert filing_news(filing("10-Q", ()), "Apple Inc.") is None
    assert filing_news(filing("4", ()), "Apple Inc.") is None
    event = filing_news(filing("8-K", ("2.02", "9.01")), "Apple Inc.")
    assert event is not None
    assert event.source == "Apple Inc. (SEC filing)"
    assert event.kind == "filing"
    assert event.detail == "Items 2.02, 9.01"
    assert event.published == date(2026, 10, 29)


def test_the_sec_submissions_parser_reads_8k_item_numbers() -> None:
    import json

    payload = json.loads(fixture("submissions_aapl.json"))
    eight_ks = parsers.parse_filings(payload, "0000320193", "8-K", 50)
    assert ("2.02", "9.01") in [f.items for f in eight_ks]
    others = parsers.parse_filings(payload, "0000320193", "10-Q", 5)
    assert all(f.items == () for f in others)


def test_newest_first_with_a_stable_order() -> None:
    old = NewsItem("A", "press_release", "old", date(2026, 1, 1), "https://x")
    new = NewsItem("A", "press_release", "new", date(2026, 2, 1), "https://x")
    assert [i.title for i in latest_first([old, new])] == ["new", "old"]


# -- feed parsing: the real feeds --------------------------------------------------------------


def test_the_real_federal_reserve_feed_parses() -> None:
    items = parse_feed(fixture("fed_press_all.xml"), FED)
    assert len(items) >= 10
    assert all(i.source == "Federal Reserve" and i.kind == "press_release" for i in items)
    assert all(i.url.startswith("https://www.federalreserve.gov/") for i in items)
    dates = [i.published for i in items]
    assert dates == sorted(dates, reverse=True)
    assert any("FOMC" in i.title or "Federal Reserve" in i.title for i in items)


def test_the_real_sec_feed_parses_and_headline_whitespace_is_collapsed() -> None:
    items = parse_feed(fixture("sec_press_releases.rss"), SEC)
    assert len(items) >= 10
    assert all(i.url.startswith("https://www.sec.gov/") for i in items)
    assert all(i.title == i.title.strip() and "  " not in i.title for i in items)


def test_the_limit_is_applied_after_sorting() -> None:
    items = parse_feed(fixture("fed_press_all.xml"), FED, limit=3)
    assert len(items) == 3


# -- feed parsing: hostile or broken input -----------------------------------------------------


def test_a_document_with_a_dtd_or_entities_is_refused() -> None:
    bomb = (
        b'<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY a "aaaaaaaaaa">'
        b'<!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;">]><rss version="2.0"><channel>'
        b"<item><title>&b;</title></item></channel></rss>"
    )
    with pytest.raises(ValueError, match="DTD"):
        parse_feed(bomb, FED)
    with pytest.raises(ValueError, match="DTD"):
        parse_feed(b'<!doctype rss><rss version="2.0"></rss>', FED)


def test_an_external_entity_attempt_is_refused() -> None:
    xxe = (
        b'<?xml version="1.0"?><!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]>'
        b'<rss version="2.0"><channel><item><title>&x;</title></item></channel></rss>'
    )
    with pytest.raises(ValueError, match="DTD"):
        parse_feed(xxe, FED)


def test_an_oversized_body_is_refused_without_parsing() -> None:
    with pytest.raises(ValueError, match="large"):
        parse_feed(b"x" * (MAX_BYTES + 1), FED)


@pytest.mark.parametrize(
    "body", [b"", b"not xml at all", b"<rss><channel></rss>", b"<html></html>"]
)
def test_garbage_and_non_rss_are_refused(body: bytes) -> None:
    with pytest.raises(ValueError, match=r"XML|RSS"):
        parse_feed(body, FED)


@pytest.mark.parametrize(
    "link",
    [
        "javascript:alert(1)",
        "http://www.federalreserve.gov/x.htm",  # not https
        "https://evil.example/x.htm",  # not the feed's host
        "https://www.federalreserve.gov.evil.example/x.htm",
        "https://user:pw@www.federalreserve.gov/x.htm",
        "//www.federalreserve.gov/x.htm",
        "",
    ],
)
def test_an_item_that_links_anywhere_else_is_dropped(link: str) -> None:
    assert parse_feed(rss(item(link=link), item(title="kept")), FED)[0].title == "kept"
    assert len(parse_feed(rss(item(link=link)), FED)) == 0


def test_items_without_a_title_or_a_readable_date_are_dropped() -> None:
    body = rss(item(title=""), item(pub="yesterday-ish"), item(pub=""), item(title="fine"))
    assert [i.title for i in parse_feed(body, FED)] == ["fine"]


def test_invisible_unicode_controls_are_removed_and_titles_are_capped() -> None:
    bidi_override, zero_width, tab, newline = chr(0x202E), chr(0x200B), chr(9), chr(10)
    nasty = f"Fed{zero_width} announces{bidi_override}{tab}{newline}{newline}  rates " + "x" * 1000
    (only,) = parse_feed(rss(item(title=nasty)), FED)
    assert bidi_override not in only.title
    assert zero_width not in only.title
    assert only.title.startswith("Fed announces rates")
    assert len(only.title) <= 300


def test_a_nul_or_bell_character_makes_the_document_invalid_and_it_is_refused() -> None:
    for code in (0, 7):
        bad = bytes([code])
        body = rss(item(title="a")).replace(b"a</title>", b"a" + bad + b"</title>")
        with pytest.raises(ValueError, match="XML"):
            parse_feed(body, FED)


def test_markup_in_a_title_stays_text() -> None:
    body = rss(item(title="&lt;script&gt;alert(1)&lt;/script&gt; Fed"))
    assert parse_feed(body, FED)[0].title == "<script>alert(1)</script> Fed"  # escaped on display


def test_a_date_with_an_offset_is_converted_to_utc() -> None:
    late = "Fri, 30 Oct 2026 23:30:00 -0400"  # 03:30 UTC the next day
    assert parse_feed(rss(item(pub=late)), FED)[0].published == date(2026, 10, 31)


# -- downloading -------------------------------------------------------------------------------


def provider(handler: Callable[[httpx.Request], httpx.Response]) -> FeedProvider:
    return FeedProvider(httpx.AsyncClient(transport=httpx.MockTransport(handler)))


async def test_a_good_feed_is_fetched_and_parsed() -> None:
    feeds = provider(lambda r: httpx.Response(200, content=fixture("fed_press_all.xml")))
    assert len(await feeds.fetch(FED)) >= 10


@pytest.mark.parametrize("status", [403, 404, 500, 503])
async def test_an_error_status_is_a_generic_upstream_error(status: int) -> None:
    with pytest.raises(UpstreamError) as caught:
        await provider(lambda r: httpx.Response(status)).fetch(FED)
    assert "federalreserve" not in str(caught.value).lower()


async def test_a_network_failure_is_a_generic_upstream_error() -> None:
    def boom(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("slow", request=request)

    with pytest.raises(UpstreamError):
        await provider(boom).fetch(FED)


async def test_a_hostile_body_is_an_upstream_error_not_a_crash() -> None:
    with pytest.raises(UpstreamError):
        await provider(lambda r: httpx.Response(200, content=b"x" * (MAX_BYTES * 2))).fetch(FED)
    with pytest.raises(UpstreamError):
        await provider(lambda r: httpx.Response(200, content=b"<!DOCTYPE x><rss/>")).fetch(FED)


async def test_the_feed_list_is_fixed_and_https() -> None:
    assert all(f.url.startswith("https://") for f in FEEDS)
    assert all(Feed(f.name, f.url, f.host).host in f.url for f in FEEDS)


# -- the service -------------------------------------------------------------------------------


class Source:
    """Serves one body per feed host, or a failure."""

    def __init__(self, **down: bool) -> None:
        self.down = down
        self.calls = 0

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.calls += 1
        host = request.url.host
        if self.down.get(host, False) or self.down.get("all", False):
            return httpx.Response(503)
        if host == "www.federalreserve.gov":
            return httpx.Response(200, content=fixture("fed_press_all.xml"))
        return httpx.Response(200, content=fixture("sec_press_releases.rss"))


def news_service(source: Source, companies: CompanyService | None = None) -> NewsService:
    return NewsService(provider(source), companies)


async def test_market_news_merges_both_sources_newest_first() -> None:
    news = await news_service(Source()).market_news(50)
    assert {i.source for i in news.items} == {"Federal Reserve", "SEC"}
    dates = [i.published for i in news.items]
    assert dates == sorted(dates, reverse=True)
    assert news.unavailable == ()


async def test_one_source_down_is_reported_and_the_other_still_answers() -> None:
    news = await news_service(Source(**{"www.sec.gov": True})).market_news(50)
    assert {i.source for i in news.items} == {"Federal Reserve"}
    assert news.unavailable == ("SEC",)


async def test_every_source_down_is_unavailable_and_the_failure_is_not_cached() -> None:
    source = Source(all=True)
    service = news_service(source)
    with pytest.raises(UnavailableError):
        await service.market_news(10)
    source.down = {}
    assert len((await service.market_news(10)).items) == 10  # recovered at once


async def test_the_limit_applies_and_results_are_cached() -> None:
    source = Source()
    service = news_service(source)
    assert len((await service.market_news(5)).items) == 5
    calls = source.calls
    assert len((await service.market_news(20)).items) == 20
    assert source.calls == calls  # served from the cache


async def test_a_bug_is_not_swallowed_as_a_source_being_down() -> None:
    class Broken:
        feeds = (FED,)

        async def fetch(self, feed: Feed) -> list[NewsItem]:
            raise KeyError("bug")

    with pytest.raises(KeyError):
        await NewsService(Broken(), None).market_news(5)  # pyright: ignore[reportArgumentType]


def company_service() -> CompanyService:
    from datetime import date as d

    from app.providers.sample_prices import SamplePriceProvider

    sec = SecProvider(
        httpx.AsyncClient(transport=httpx.MockTransport(Upstream())),
        limiter=NoWait(),  # pyright: ignore[reportArgumentType]
        retry_delay=0,
    )
    return CompanyService(sec, sec, sec, SamplePriceProvider(today=lambda: d(2026, 11, 1)))


async def test_company_news_is_the_companys_own_8ks_newest_first() -> None:
    items = await news_service(Source(), company_service()).company_news("AAPL", 10)
    assert items
    assert all(i.kind == "filing" and i.source == "Apple Inc. (SEC filing)" for i in items)
    assert all(i.url.startswith("https://www.sec.gov/Archives/") for i in items)
    assert [i.published for i in items] == sorted((i.published for i in items), reverse=True)
    assert "Results of Operations and Financial Condition" in [i.title for i in items]


async def test_company_news_for_an_unknown_ticker_is_not_found() -> None:
    with pytest.raises(AppError) as caught:
        await news_service(Source(), company_service()).company_news("ZZZZZZ", 10)
    assert caught.value.status_code == 404


async def test_company_news_without_company_data_is_unavailable() -> None:
    with pytest.raises(UnavailableError):
        await news_service(Source(), None).company_news("AAPL", 10)


# -- HTTP --------------------------------------------------------------------------------------


@pytest.fixture
async def api() -> httpx.AsyncClient:
    service = news_service(Source(**{"www.sec.gov": True}), company_service())
    app = create_app(make_settings(), news_service=service)
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    return httpx.AsyncClient(transport=transport, base_url="http://test")


async def test_the_market_endpoint_states_its_basis_and_the_source_that_is_down(
    api: httpx.AsyncClient,
) -> None:
    response = await api.get("/api/v1/news", params={"limit": 3})
    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 3
    assert body["unavailable"] == ["SEC"]
    assert "No opinions" in body["basis"]
    assert response.headers["cache-control"] == "public, max-age=300"
    assert set(body["items"][0]) == {"source", "kind", "title", "published", "url", "detail"}


@pytest.mark.parametrize("limit", [0, 51, "x"])
async def test_the_limit_is_validated(api: httpx.AsyncClient, limit: int | str) -> None:
    response = await api.get("/api/v1/news", params={"limit": limit})
    assert response.status_code == 422


async def test_the_company_endpoint(api: httpx.AsyncClient) -> None:
    response = await api.get("/api/v1/companies/aapl/news")
    assert response.status_code == 200
    body = response.json()
    assert body["ticker"] == "AAPL"
    assert body["items"][0]["kind"] == "filing"


async def test_an_unknown_company_is_a_404_in_the_standard_shape(api: httpx.AsyncClient) -> None:
    response = await api.get("/api/v1/companies/ZZZZZZ/news")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


async def test_without_a_news_service_it_is_a_clean_503() -> None:
    app = create_app(make_settings())
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        assert (await client.get("/api/v1/news")).status_code == 503
