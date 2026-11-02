import json
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from app.domain.models import CompanyRef
from app.providers.sec import parsers
from app.providers.sec.client import DirectoryIndex

FIXTURES = Path(__file__).parent / "fixtures"
APPLE = CompanyRef(cik="0000320193", ticker="AAPL", name="Apple Inc.", exchange="Nasdaq")


def load(name: str) -> dict[str, Any]:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def index() -> DirectoryIndex:
    return DirectoryIndex(parsers.parse_directory(load("company_tickers_exchange.json")))


# -- directory ---------------------------------------------------------------------------------


def test_directory_rows_become_padded_company_refs() -> None:
    companies = parsers.parse_directory(load("company_tickers_exchange.json"))
    apple = next(c for c in companies if c.ticker == "AAPL")
    assert apple == APPLE


def test_directory_rejects_an_unexpected_shape() -> None:
    with pytest.raises(ValueError, match="unexpected"):
        parsers.parse_directory({"fields": ["x"], "data": []})


def test_directory_skips_rows_without_a_ticker_or_name() -> None:
    payload = {
        "fields": ["cik", "name", "ticker", "exchange"],
        "data": [[1, "", "AAA", None], [2, "Real Co", " ", None], [3, "Good Co", "gd", None]],
    }
    assert [c.ticker for c in parsers.parse_directory(payload)] == ["GD"]


def test_lookup_is_case_insensitive_and_accepts_a_dot_for_a_share_class(
    index: DirectoryIndex,
) -> None:
    assert index.lookup("aapl") is not None
    brk = index.lookup("brk.b")
    assert brk is not None
    assert brk.ticker == "BRK-B"
    assert index.lookup("ZZZZ") is None


def test_search_ranks_exact_ticker_then_prefix_then_name(index: DirectoryIndex) -> None:
    assert index.search("aapl", 5)[0].ticker == "AAPL"
    names = [c.name for c in index.search("apple", 10)]
    assert names[0] == "Apple Inc."  # name starts with the query
    assert any("Apple Hospitality" in n for n in names)


def test_search_matches_inside_a_name_and_respects_the_limit(index: DirectoryIndex) -> None:
    assert [c.ticker for c in index.search("hathaway", 5)] == ["BRK-B"]
    assert len(index.search("a", 3)) == 3


def test_a_blank_search_returns_nothing(index: DirectoryIndex) -> None:
    assert index.search("   ", 5) == []


# -- profile and filings -----------------------------------------------------------------------


def test_profile_reads_the_company_details() -> None:
    profile = parsers.parse_profile(load("submissions_aapl.json"), APPLE)
    assert profile.name == "Apple Inc."
    assert profile.industry == "Electronic Computers"
    assert profile.fiscal_year_end == "0926"
    assert profile.category == "Large accelerated filer"
    assert profile.website is None  # SEC leaves it blank, and blank must not become ""


def test_filings_are_newest_first_with_a_working_document_url() -> None:
    filings = parsers.parse_filings(load("submissions_aapl.json"), APPLE.cik, None, 50)
    assert filings
    assert [f.filed for f in filings] == sorted((f.filed for f in filings), reverse=True)
    first = filings[0]
    folder = first.accession_number.replace("-", "")
    assert first.url.startswith(f"https://www.sec.gov/Archives/edgar/data/320193/{folder}/")


def test_filings_can_be_filtered_by_form_and_limited() -> None:
    filings = parsers.parse_filings(load("submissions_aapl.json"), APPLE.cik, "10-K", 3)
    assert 0 < len(filings) <= 3
    assert {f.form for f in filings} == {"10-K"}


# -- annual fundamentals -----------------------------------------------------------------------


def by_metric(years: int = 10) -> dict[str, dict[str, Decimal]]:
    series = parsers.parse_annual_metrics(load("companyfacts_aapl.json"), years)
    return {s.metric: {str(v.period_end): v.value for v in s.values} for s in series}


def test_apple_revenue_matches_the_published_annual_figures() -> None:
    revenue = by_metric()["revenue"]
    assert revenue["2025-09-27"] == Decimal(416161000000)
    assert revenue["2024-09-28"] == Decimal(391035000000)
    assert revenue["2023-09-30"] == Decimal(383285000000)
    assert revenue["2022-09-24"] == Decimal(394328000000)
    assert revenue["2021-09-25"] == Decimal(365817000000)


def test_only_full_fiscal_years_are_returned_never_quarters() -> None:
    for series in parsers.parse_annual_metrics(load("companyfacts_aapl.json"), 20):
        if series.metric == "revenue":
            assert all(v.form in {"10-K", "10-K/A"} for v in series.values)
            ends = [v.period_end for v in series.values]
            assert len(ends) == len(set(ends))  # one value per fiscal year


def test_values_are_newest_first_and_limited_to_the_requested_years() -> None:
    series = parsers.parse_annual_metrics(load("companyfacts_aapl.json"), 3)
    revenue = next(s for s in series if s.metric == "revenue")
    assert len(revenue.values) == 3
    ends = [v.period_end for v in revenue.values]
    assert ends == sorted(ends, reverse=True)


def test_instant_items_and_per_share_items_are_read_with_their_units() -> None:
    metrics = by_metric()
    assert "2024-09-28" in metrics["assets"]  # instant item: no start date
    series = {s.metric: s for s in parsers.parse_annual_metrics(load("companyfacts_aapl.json"), 5)}
    assert series["eps_diluted"].unit == "USD/shares"
    assert series["revenue"].unit == "USD"


def test_a_restatement_filed_later_replaces_the_original() -> None:
    def entry(val: int, filed: str) -> dict[str, Any]:
        return {
            "start": "2023-01-01",
            "end": "2023-12-31",
            "val": val,
            "form": "10-K",
            "filed": filed,
        }

    payload = {
        "facts": {
            "us-gaap": {
                "Revenues": {"units": {"USD": [entry(100, "2024-02-01"), entry(110, "2025-02-01")]}}
            }
        }
    }
    (series,) = parsers.parse_annual_metrics(payload, 5)
    assert series.values[0].value == Decimal(110)


def test_a_company_with_no_facts_gives_no_metrics() -> None:
    assert parsers.parse_annual_metrics({}, 5) == []
