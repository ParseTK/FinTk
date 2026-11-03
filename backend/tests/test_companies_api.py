from datetime import date

import httpx
import pytest
from fastapi import FastAPI

from app.core.config import Settings
from app.main import create_app
from app.providers.sample_prices import SamplePriceProvider
from app.providers.sec.client import SecProvider
from app.services.companies import CompanyService, is_valid_ticker
from tests.conftest import make_settings
from tests.test_sec_provider import NoWait, Upstream


@pytest.fixture
def upstream() -> Upstream:
    return Upstream()


@pytest.fixture
def company_app(upstream: Upstream, settings: Settings) -> FastAPI:
    sec = SecProvider(
        httpx.AsyncClient(transport=httpx.MockTransport(upstream)),
        limiter=NoWait(),  # pyright: ignore[reportArgumentType]
        retry_delay=0,
    )
    prices = SamplePriceProvider(today=lambda: date(2025, 3, 15))
    return create_app(settings, company_service=CompanyService(sec, sec, sec, prices))


@pytest.fixture
async def api(company_app: FastAPI) -> httpx.AsyncClient:
    transport = httpx.ASGITransport(app=company_app, raise_app_exceptions=False)
    return httpx.AsyncClient(transport=transport, base_url="http://test")


async def test_search_returns_ranked_results_with_cache_headers(api: httpx.AsyncClient) -> None:
    response = await api.get("/api/v1/companies/search", params={"q": "apple", "limit": 2})

    assert response.status_code == 200
    body = response.json()
    assert body["results"][0] == {
        "ticker": "AAPL",
        "name": "Apple Inc.",
        "exchange": "Nasdaq",
        "cik": "0000320193",
    }
    assert len(body["results"]) == 2
    assert response.headers["cache-control"] == "public, max-age=300"


@pytest.mark.parametrize("params", [{}, {"q": ""}, {"q": "x" * 61}, {"q": "a", "limit": 100}])
async def test_search_validates_its_input(
    api: httpx.AsyncClient, params: dict[str, str | int]
) -> None:
    response = await api.get("/api/v1/companies/search", params=params)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


async def test_profile(api: httpx.AsyncClient) -> None:
    response = await api.get("/api/v1/companies/aapl")
    assert response.status_code == 200
    assert response.json()["name"] == "Apple Inc."
    assert response.json()["industry"] == "Electronic Computers"


@pytest.mark.parametrize("ticker", ["ZZZZ", "A1B", "..", "TOOLONGTICKERX"])
async def test_an_unknown_or_malformed_ticker_is_a_clean_404_or_422(
    api: httpx.AsyncClient, ticker: str
) -> None:
    response = await api.get(f"/api/v1/companies/{ticker}")
    assert response.status_code in {404, 422}
    assert response.json()["error"]["code"] in {"not_found", "validation_error"}


async def test_filings_can_be_filtered(api: httpx.AsyncClient) -> None:
    response = await api.get("/api/v1/companies/AAPL/filings", params={"form": "10-K", "limit": 2})
    assert response.status_code == 200
    filings = response.json()["filings"]
    assert len(filings) == 2
    assert {f["form"] for f in filings} == {"10-K"}
    assert filings[0]["url"].startswith("https://www.sec.gov/Archives/edgar/data/320193/")


async def test_filings_reject_a_malformed_form_filter(api: httpx.AsyncClient) -> None:
    response = await api.get("/api/v1/companies/AAPL/filings", params={"form": "10-K; drop"})
    assert response.status_code == 422


async def test_financials_send_money_as_strings(api: httpx.AsyncClient) -> None:
    response = await api.get("/api/v1/companies/AAPL/financials", params={"years": 2})

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "SEC EDGAR"
    revenue = next(m for m in body["metrics"] if m["metric"] == "revenue")
    assert revenue["values"][0]["value"] == "416161000000"
    assert isinstance(revenue["values"][0]["value"], str)
    assert len(revenue["values"]) == 2
    assert response.headers["cache-control"] == "public, max-age=3600"


async def test_sample_prices_are_labelled_and_deterministic(api: httpx.AsyncClient) -> None:
    first = (await api.get("/api/v1/companies/AAPL/prices/monthly")).json()
    second = (await api.get("/api/v1/companies/AAPL/prices/monthly")).json()

    assert first == second
    assert first["source"] == "sample"
    assert first["prices"][0]["month_end"] == "2000-01-31"
    assert first["prices"][-1]["month_end"] == "2025-02-28"  # only completed months
    assert isinstance(first["prices"][0]["close"], str)


async def test_seasonality_is_a_year_by_month_grid_with_exact_string_percentages(
    api: httpx.AsyncClient,
) -> None:
    response = await api.get("/api/v1/companies/AAPL/seasonality")
    body = response.json()

    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=3600"
    assert body["source"] == "sample"  # labelled so the page can say it is not market data
    assert body["start"] == {"year": 2000, "month": 1}
    assert "dividends not included" in body["basis"]
    first_year = body["years"][0]
    assert first_year["year"] == 2000
    assert len(first_year["returns"]) == 12
    assert first_year["returns"][0] is None  # no return for the very first month of data
    assert isinstance(first_year["returns"][1], str)
    assert [m["month"] for m in body["months"]] == list(range(1, 13))
    january = body["months"][0]
    assert isinstance(january["average"], str)
    assert january["count"] == len(body["years"]) - 1  # January 2000 has no return
    assert isinstance(january["best"]["percent"], str)


async def test_seasonality_for_an_unknown_company_is_a_404(api: httpx.AsyncClient) -> None:
    assert (await api.get("/api/v1/companies/NOPE1/seasonality")).status_code == 404


async def test_an_upstream_failure_is_a_502_in_the_standard_error_shape(
    api: httpx.AsyncClient, upstream: Upstream
) -> None:
    upstream.overrides["/submissions/"] = lambda _: httpx.Response(500)

    response = await api.get("/api/v1/companies/AAPL")

    assert response.status_code == 502
    error = response.json()["error"]
    assert error["code"] == "upstream_error"
    assert error["request_id"]
    assert "sec.gov" not in response.text  # no upstream details leak to clients


async def test_company_routes_report_503_when_no_data_source_is_configured(
    client: httpx.AsyncClient,
) -> None:
    response = await client.get("/api/v1/companies/AAPL")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "unavailable"


def test_production_refuses_to_start_without_a_sec_contact() -> None:
    with pytest.raises(ValueError, match="SEC_CONTACT_EMAIL"):
        create_app(make_settings(environment="production", sec_contact_email=None))


@pytest.mark.parametrize(
    ("value", "valid"),
    [("AAPL", True), ("brk-b", True), ("BRK.B", True), ("", False), ("A1", False), ("../x", False)],
)
def test_ticker_validation(value: str, valid: bool) -> None:
    assert is_valid_ticker(value) is valid
