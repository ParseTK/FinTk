from collections.abc import Callable
from datetime import date
from pathlib import Path

import httpx
import pytest

from app.core.errors import UpstreamError
from app.domain.models import Filing
from app.domain.news import NewsItem, eight_k_title, filing_news, latest_first
from app.providers.feeds import CRYPTO_FEEDS, MAX_BYTES, Feed, FeedProvider, parse_feed

FIXTURES = Path(__file__).parent / "fixtures"
# The parser is host-generic: a Federal Reserve style feed is used here only to test it.
FED = Feed(
    "Federal Reserve",
    "https://www.federalreserve.gov/feeds/press_all.xml",
    "www.federalreserve.gov",
)
SEC = CRYPTO_FEEDS[0]


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


def test_newest_first_with_a_stable_order() -> None:
    old = NewsItem("A", "press_release", "old", date(2026, 1, 1), "https://x")
    new = NewsItem("A", "press_release", "new", date(2026, 2, 1), "https://x")
    assert [i.title for i in latest_first([old, new])] == ["new", "old"]


# -- feed parsing: the real feeds --------------------------------------------------------------


def test_the_real_sec_feed_parses_and_headline_whitespace_is_collapsed() -> None:
    items = parse_feed(fixture("sec_press_releases.rss"), SEC)
    assert len(items) >= 10
    assert all(i.url.startswith("https://www.sec.gov/") for i in items)
    assert all(i.title == i.title.strip() and "  " not in i.title for i in items)


def test_the_limit_is_applied_after_sorting() -> None:
    items = parse_feed(fixture("sec_press_releases.rss"), SEC, limit=3)
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
    feeds = provider(lambda r: httpx.Response(200, content=fixture("sec_press_releases.rss")))
    assert len(await feeds.fetch(SEC)) >= 10


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
    assert all(f.url.startswith("https://") for f in CRYPTO_FEEDS)
    assert all(f.host in f.url for f in CRYPTO_FEEDS)
