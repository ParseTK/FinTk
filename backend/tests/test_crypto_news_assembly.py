"""How the crypto news items are chosen and ordered: a pure function, tested without async."""

from datetime import date, timedelta

from app.domain.crypto_news import PER_COMPANY_LIMIT, assemble_crypto_news
from app.domain.news import NewsItem

TODAY = date(2026, 11, 5)
CUTOFF = TODAY - timedelta(days=90)


def item(
    title: str, published: date = TODAY, url: str | None = None, source: str = "SEC"
) -> NewsItem:
    return NewsItem(
        source=source,
        kind="press_release",
        title=title,
        published=published,
        url=url or f"https://example.test/{title.replace(' ', '-')}",
    )


def filing(published: date, n: int = 0) -> NewsItem:
    return NewsItem(
        source="SEC filing",
        kind="filing",
        title="Results of Operations and Financial Condition",
        published=published,
        url=f"https://example.test/8k/{published.isoformat()}/{n}",
    )


def test_announcements_are_kept_only_when_their_headline_mentions_crypto() -> None:
    news, down = assemble_crypto_news(
        [("SEC", [item("SEC charges a crypto exchange"), item("SEC adopts a routine rule")])],
        [],
        CUTOFF,
    )
    assert [n.title for n in news] == ["SEC charges a crypto exchange"]
    assert down == []


def test_company_filings_older_than_the_cutoff_are_dropped() -> None:
    old = filing(CUTOFF - timedelta(days=1))
    edge = filing(CUTOFF)
    news, _ = assemble_crypto_news([], [("COIN", [old, edge])], CUTOFF)
    assert news == [edge]


def test_each_company_is_cut_to_its_newest_few_so_one_cannot_fill_the_page() -> None:
    many = [filing(TODAY - timedelta(days=d)) for d in range(10)]
    news, _ = assemble_crypto_news([], [("MSTR", many)], CUTOFF)
    assert len(news) == PER_COMPANY_LIMIT
    assert [n.published for n in news] == [
        TODAY - timedelta(days=d) for d in range(PER_COMPANY_LIMIT)
    ]


def test_the_cap_applies_to_each_company_separately() -> None:
    a = [filing(TODAY - timedelta(days=d), 1) for d in range(5)]
    b = [filing(TODAY - timedelta(days=d), 2) for d in range(5)]
    news, _ = assemble_crypto_news([], [("COIN", a), ("RIOT", b)], CUTOFF)
    assert len(news) == 2 * PER_COMPANY_LIMIT


def test_an_item_carried_by_two_sources_appears_once() -> None:
    same = "https://example.test/shared-bitcoin-story"
    news, _ = assemble_crypto_news(
        [
            ("CFTC press", [item("CFTC bitcoin order", url=same)]),
            ("CFTC enforcement", [item("CFTC bitcoin order", url=same)]),
        ],
        [],
        CUTOFF,
    )
    assert len(news) == 1


def test_everything_is_newest_first_across_both_kinds_of_source() -> None:
    news, _ = assemble_crypto_news(
        [("SEC", [item("A bitcoin case", TODAY - timedelta(days=3))])],
        [("COIN", [filing(TODAY - timedelta(days=1)), filing(TODAY - timedelta(days=9))])],
        CUTOFF,
    )
    assert [n.published for n in news] == [
        TODAY - timedelta(days=1),
        TODAY - timedelta(days=3),
        TODAY - timedelta(days=9),
    ]


def test_a_source_that_could_not_be_read_is_named_and_the_rest_still_count() -> None:
    news, down = assemble_crypto_news(
        [("SEC", None), ("DOJ", [item("DOJ bitcoin sentencing")])],
        [("COIN", None), ("MARA", [filing(TODAY)])],
        CUTOFF,
    )
    assert down == ["SEC", "COIN"]
    assert len(news) == 2


def test_no_sources_means_no_items_and_nothing_down() -> None:
    assert assemble_crypto_news([], [], CUTOFF) == ([], [])


def test_an_empty_source_is_not_a_down_source() -> None:
    news, down = assemble_crypto_news([("SEC", [])], [("COIN", [])], CUTOFF)
    assert (news, down) == ([], [])
