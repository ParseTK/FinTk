"""GET /api/v1/crypto/markets: gate, shape, attribution, and honest gaps."""

from datetime import date

import httpx
from httpx import ASGITransport, AsyncClient

from app.api.internal_deps import INTERNAL_TOKEN_HEADER
from app.core.rate_limit import SlidingWindowBudget
from app.main import create_app
from app.providers.coinmarketcap.client import BASE_URL, CoinMarketCapProvider
from app.services.crypto import CryptoService
from tests.conftest import make_settings
from tests.test_crypto_service import FakeProvider

TOKEN = "t" * 40  # plainly not a real secret
URL = "/api/v1/crypto/markets"
HEADERS = {INTERNAL_TOKEN_HEADER: TOKEN}


def client_for(provider: FakeProvider | None = None, *, configured: bool = True) -> AsyncClient:
    service = CryptoService(provider or FakeProvider()) if configured else None
    app = create_app(make_settings(internal_api_token=TOKEN), crypto_service=service)
    return AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test"
    )


async def test_refuses_anyone_without_the_internal_token() -> None:
    async with client_for() as http:
        assert (await http.get(URL)).status_code == 403
        wrong = await http.get(URL, headers={INTERNAL_TOKEN_HEADER: "u" * 40})
        assert wrong.status_code == 403


async def test_a_refusal_carries_no_data() -> None:
    async with client_for() as http:
        response = await http.get(URL)
    assert "majors" not in response.text
    assert "composition" not in response.text


async def test_returns_the_composition_and_the_majors() -> None:
    async with client_for() as http:
        response = await http.get(URL, headers=HEADERS)
    assert response.status_code == 200
    body = response.json()
    assert [row["key"] for row in body["composition"]["rows"]] == [
        "bitcoin",
        "ethereum",
        "other",
        "stablecoins",
        "defi",
    ]
    assert body["composition"]["rows"][3]["overlaps"] is True
    assert [coin["symbol"] for coin in body["majors"]] == ["E1", "E2", "E3"]
    assert body["unavailable"] == []


async def test_every_response_carries_the_required_attribution() -> None:
    async with client_for() as http:
        body = (await http.get(URL, headers=HEADERS)).json()
    assert body["attribution"] == {
        "text": "Data provided by CoinMarketCap.com",
        "url": "https://coinmarketcap.com/",
    }


async def test_the_response_is_never_stored_by_a_shared_cache() -> None:
    async with client_for() as http:
        response = await http.get(URL, headers=HEADERS)
    assert response.headers["cache-control"] == "no-store"


async def test_amounts_are_exact_decimal_strings_and_days_are_iso_dates() -> None:
    async with client_for() as http:
        body = (await http.get(URL, headers=HEADERS)).json()
    first = body["majors"][0]
    assert first["price"] == "1"
    assert first["change_30d"] == "3.5"
    assert first["change_90d"] == "-7.25"
    # price 1 now against 1 on both anchor days: no change
    assert first["change_year_to_date"] == "0.00"
    assert first["change_past_year"] == "0.00"
    assert body["majors"][1]["change_year_to_date"] == "100.00"  # 2 against 1
    assert body["year_start"] == f"{date.today().year}-01-01"
    assert isinstance(body["past_year_start"], str)
    assert "E" not in body["composition"]["total_market_cap"]


async def test_only_the_documented_fields_leave_the_api() -> None:
    async with client_for() as http:
        body = (await http.get(URL, headers=HEADERS)).json()
    assert set(body) == {
        "attribution",
        "as_of",
        "composition",
        "majors",
        "year_start",
        "past_year_start",
        "unavailable",
    }
    assert set(body["majors"][0]) == {
        "rank",
        "name",
        "symbol",
        "slug",
        "price",
        "change_24h",
        "change_7d",
        "change_30d",
        "change_90d",
        "change_year_to_date",
        "change_past_year",
    }
    assert set(body["composition"]) == {"total_market_cap", "total_change_24h", "rows"}
    assert set(body["composition"]["rows"][0]) == {
        "key",
        "label",
        "share",
        "market_cap",
        "share_change",
        "overlaps",
    }
    assert "cmc_id" not in str(body)  # the provider's ids stay inside


async def test_a_missing_part_is_named_and_the_rest_answers() -> None:
    provider = FakeProvider()
    provider.fail = {"anchor", "totals"}
    async with client_for(provider) as http:
        body = (await http.get(URL, headers=HEADERS)).json()
    assert body["composition"] is None
    assert body["year_start"] is None
    assert body["past_year_start"] is None
    assert body["unavailable"] == ["market totals", "year-to-date change", "past-year change"]
    assert body["majors"][0]["change_30d"] == "3.5"
    assert body["majors"][0]["change_year_to_date"] is None


async def test_not_configured_is_a_clear_503() -> None:
    async with client_for(configured=False) as http:
        response = await http.get(URL, headers=HEADERS)
    assert response.status_code == 503
    assert "not configured" in response.json()["error"]["message"]


async def test_a_vendor_failure_reaches_the_visitor_only_as_a_generic_error() -> None:
    secret = "vendor-text-that-must-not-leak"

    def vendor(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"status": {"error_code": 1002, "error_message": secret}})

    provider = CoinMarketCapProvider(
        httpx.AsyncClient(base_url=BASE_URL, transport=httpx.MockTransport(vendor)),
        per_minute=SlidingWindowBudget(50, 60),
        per_day=SlidingWindowBudget(1000, 86_400),
        retry_delay=0,
    )
    app = create_app(
        make_settings(internal_api_token=TOKEN), crypto_service=CryptoService(provider)
    )
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test"
    ) as http:
        response = await http.get(URL, headers=HEADERS)
    assert response.status_code == 502
    assert secret not in response.text
