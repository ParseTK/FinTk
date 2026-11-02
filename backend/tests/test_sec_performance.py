# pyright: reportPrivateUsage=false
# White-box on purpose: these tests inspect cache internals to prove memory stays bounded.
"""Guards for the SEC provider memory and CPU behaviour (see client.py module docstring)."""

import asyncio
import threading
import time
from datetime import date
from typing import Any

import pytest

from app.domain.models import CompanyRef
from app.providers.sec import parsers
from app.providers.sec.client import MAX_YEARS, DirectoryIndex, SecProvider
from tests.test_sec_provider import APPLE, Upstream, make_provider


def refs(count: int) -> list[CompanyRef]:
    return [
        CompanyRef(
            cik=str(i).zfill(10), ticker=f"T{i}", name=f"Company Number {i} Inc", exchange=None
        )
        for i in range(count)
    ]


# -- parsing never runs on the event loop ---------------------------------------------------------


async def test_documents_are_decoded_and_reduced_off_the_event_loop(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: list[str] = []
    real = parsers.parse_annual_metrics

    def spy(payload: Any, years: int) -> Any:
        seen.append(threading.current_thread().name)
        return real(payload, years)

    monkeypatch.setattr(parsers, "parse_annual_metrics", spy)
    await make_provider(Upstream()).annual_metrics(APPLE, 3)

    assert seen
    assert threading.current_thread().name not in seen  # the main (event loop) thread stayed free


async def test_awaiting_a_slow_parse_does_not_block_other_tasks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # time.sleep releases the GIL, so this proves the work is awaited from a thread rather than run
    # inline on the loop. The real C JSON decoder holds the GIL, so in production a cold company
    # still costs other requests a brief hiccup (see the module docstring of client.py).
    def slow(payload: Any, years: int) -> Any:
        time.sleep(0.4)
        return []

    monkeypatch.setattr(parsers, "parse_annual_metrics", slow)
    ticks = 0

    async def heartbeat() -> None:
        nonlocal ticks
        while True:
            await asyncio.sleep(0.01)
            ticks += 1

    beat = asyncio.create_task(heartbeat())
    try:
        await make_provider(Upstream()).annual_metrics(APPLE, 3)
    finally:
        beat.cancel()

    # Blocking the loop for the 0.4 s would allow about one tick. A free loop ticks dozens of times.
    assert ticks >= 20


# -- what stays in memory -------------------------------------------------------------------------


async def test_only_the_small_derived_result_is_cached_never_the_raw_document() -> None:
    upstream = Upstream()
    provider = make_provider(upstream)
    await provider.annual_metrics(APPLE, 3)

    cached = next(iter(provider._facts._entries.values())).value
    assert isinstance(cached, tuple)
    assert all(type(item).__name__ == "MetricSeries" for item in cached)
    # No attribute of the provider holds the downloaded JSON.
    assert not any(isinstance(v, dict) and "facts" in v for v in vars(provider).values())


async def test_different_year_counts_share_one_download_and_one_cache_entry() -> None:
    upstream = Upstream()
    provider = make_provider(upstream)

    one = await provider.annual_metrics(APPLE, 1)
    five = await provider.annual_metrics(APPLE, 5)

    assert len(next(s for s in one if s.metric == "revenue").values) == 1
    assert len(next(s for s in five if s.metric == "revenue").values) == 5
    assert sum("/companyfacts/" in str(r.url) for r in upstream.requests) == 1


def test_the_largest_year_count_the_api_allows_is_what_is_cached() -> None:
    assert MAX_YEARS == 20  # the route's `years` limit must never exceed what is kept


def test_the_cache_sizes_bound_worst_case_memory() -> None:
    provider = SecProvider.__new__(SecProvider)
    SecProvider.__init__(provider, None)  # type: ignore[arg-type]
    assert provider._facts._max_entries <= 256
    assert provider._submissions._max_entries <= 256


# -- recent filings are capped per form ----------------------------------------------------------


def submissions_payload(rows: list[tuple[str, str]]) -> dict[str, Any]:
    forms = [form for form, _ in rows]
    dates = [filed for _, filed in rows]
    n = len(rows)
    return {
        "filings": {
            "recent": {
                "accessionNumber": [f"0000000000-26-{i:06d}" for i in range(n)],
                "form": forms,
                "filingDate": dates,
                "reportDate": [""] * n,
                "primaryDocument": ["doc.htm"] * n,
                "primaryDocDescription": [""] * n,
            }
        }
    }


def test_a_flood_of_one_form_cannot_crowd_out_the_others() -> None:
    rows = [("4", "2026-05-01")] * 300 + [("10-K", "2025-11-01"), ("10-K", "2024-11-01")]
    kept = parsers.parse_recent_filings(submissions_payload(rows), "0000320193")

    assert sum(f.form == "4" for f in kept) == parsers.MAX_FILINGS_PER_FORM
    assert [f.form for f in kept if f.form == "10-K"] == ["10-K", "10-K"]  # both survive
    assert len(kept) == parsers.MAX_FILINGS_PER_FORM + 2


def test_rows_without_a_date_or_document_are_skipped() -> None:
    payload = submissions_payload([("10-K", "not-a-date"), ("10-Q", "2026-05-01")])
    assert [f.form for f in parsers.parse_recent_filings(payload, "0000320193")] == ["10-Q"]
    assert parsers.parse_recent_filings({}, "0000320193") == ()
    assert date(2026, 5, 1) == parsers.parse_recent_filings(payload, "0000320193")[0].filed


# -- directory search ------------------------------------------------------------------------------


def test_repeating_a_search_does_not_rescan_the_directory(monkeypatch: pytest.MonkeyPatch) -> None:
    index = DirectoryIndex(refs(500))
    scans = 0
    real = index._rank_all

    def counting(needle: str) -> Any:
        nonlocal scans
        scans += 1
        return real(needle)

    monkeypatch.setattr(index, "_rank_all", counting)

    first = index.search("company number 4", 5)
    second = index.search("  COMPANY number 4 ", 5)  # same query after normalising

    assert first == second
    assert scans == 1


def test_the_remembered_searches_are_bounded() -> None:
    index = DirectoryIndex(refs(50))
    for i in range(DirectoryIndex.SEARCH_CACHE_SIZE + 100):
        index.search(f"query {i}", 5)
    assert len(index._recent) <= DirectoryIndex.SEARCH_CACHE_SIZE


def test_search_results_do_not_depend_on_the_limit_that_filled_the_cache() -> None:
    index = DirectoryIndex(refs(100))
    assert len(index.search("company", 3)) == 3
    assert len(index.search("company", 50)) == 50  # a bigger limit later is not truncated
