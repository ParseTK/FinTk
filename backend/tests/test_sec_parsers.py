import json
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


# -- filings --------------------------------------------------------------------------------


def test_filings_are_newest_first_with_a_working_document_url() -> None:
    filings = parsers.parse_recent_filings(load("submissions_aapl.json"), APPLE.cik)
    assert filings
    assert [f.filed for f in filings] == sorted((f.filed for f in filings), reverse=True)
    first = filings[0]
    folder = first.accession_number.replace("-", "")
    assert first.url.startswith(f"https://www.sec.gov/Archives/edgar/data/320193/{folder}/")


def test_at_most_a_bounded_number_of_each_form_is_kept() -> None:
    filings = parsers.parse_recent_filings(load("submissions_aapl.json"), APPLE.cik)
    per_form: dict[str, int] = {}
    for filing in filings:
        per_form[filing.form] = per_form.get(filing.form, 0) + 1
    assert max(per_form.values()) <= parsers.MAX_FILINGS_PER_FORM
    assert "8-K" in per_form


def test_form_8k_item_numbers_are_read() -> None:
    filings = parsers.parse_recent_filings(load("submissions_aapl.json"), APPLE.cik)
    assert ("2.02", "9.01") in [f.items for f in filings if f.form == "8-K"]
    assert all(f.items == () for f in filings if f.form == "10-Q")
