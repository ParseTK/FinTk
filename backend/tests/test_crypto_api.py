"""GET /api/v1/crypto/overview: the internal-only gate, the shape, the attribution and failures."""

from datetime import UTC, datetime
from decimal import Decimal

import httpx
import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.api.internal_deps import INTERNAL_TOKEN_HEADER
from app.core.errors import UnavailableError
from app.core.rate_limit import SlidingWindowBudget
from app.domain.crypto import CryptoAsset, CryptoListings
from app.main import create_app
from app.providers.coinmarketcap.client import BASE_URL, CoinMarketCapProvider
from app.services.crypto import CryptoService
from tests.conftest import make_settings
from tests.test_crypto_service import FakeProvider

TOKEN = "t" * 40  # plainly not a real secret
URL = "/api/v1/crypto/overview"
HEADERS = {INTERNAL_TOKEN_HEADER: TOKEN}


def client_for(
    provider: FakeProvider | None = None, *, configured: bool = True, **settings: object
) -> AsyncClient:
    service = CryptoService(provider or FakeProvider()) if configured else None
    app = create_app(make_settings(internal_api_token=TOKEN, **settings), crypto_service=service)
    return AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test"
    )


async def test_refuses_anyone_without_the_internal_token() -> None:
    """Vendor data must never be a public feed: the open internet gets nothing."""
    async with client_for() as http:
        assert (await http.get(URL)).status_code == 403
        wrong = await http.get(URL, headers={INTERNAL_TOKEN_HEADER: "u" * 40})
        assert wrong.status_code == 403


async def test_a_refusal_carries_no_data() -> None:
    async with client_for() as http:
        response = await http.get(URL)
    assert "assets" not in response.text
    assert response.json()["error"]["code"] == "forbidden"


async def test_closed_in_production_even_when_the_token_was_forgotten() -> None:
    app = create_app(
        make_settings(environment="production"), crypto_service=CryptoService(FakeProvider())
    )
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test"
    ) as http:
        assert (await http.get(URL)).status_code == 403


async def test_returns_the_overview_with_the_token() -> None:
    async with client_for() as http:
        response = await http.get(URL, headers=HEADERS)
    assert response.status_code == 200
    body = response.json()
    assert [a["symbol"] for a in body["assets"]] == ["E1", "E2", "E3"]
    assert body["totals"]["btc_dominance"] == "50"
    assert body["fear_greed"] == {"value": 61, "label": "Greed"}
    assert body["unavailable"] == []
    assert body["as_of"].startswith("2026-11-03T21:00")


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


async def test_only_the_documented_fields_leave_the_api() -> None:
    async with client_for() as http:
        body = (await http.get(URL, headers=HEADERS)).json()
    assert set(body) == {"attribution", "as_of", "assets", "totals", "fear_greed", "unavailable"}
    assert set(body["assets"][0]) == {
        "rank",
        "name",
        "symbol",
        "slug",
        "price",
        "change_24h",
        "change_7d",
        "market_cap",
        "volume_24h",
    }


class TinyCoins(FakeProvider):
    async def listings(self, limit: int) -> CryptoListings:
        coin = CryptoAsset(
            rank=1,
            name="Tiny",
            symbol="TNY",
            slug="tiny",
            price=Decimal("1E-7"),
            change_24h=Decimal("-0.05"),
            change_7d=None,
            market_cap=Decimal("1.5E+12"),
            volume_24h=None,
        )
        return CryptoListings((coin,), datetime(2026, 11, 3, 21, 0, tzinfo=UTC))


async def test_amounts_are_plain_decimal_strings_never_numbers_or_exponents() -> None:
    async with client_for(TinyCoins()) as http:
        coin = (await http.get(URL, headers=HEADERS)).json()["assets"][0]
    assert coin["price"] == "0.0000001"
    assert coin["market_cap"] == "1500000000000"
    assert coin["change_24h"] == "-0.05"
    assert coin["change_7d"] is None
    assert "E" not in coin["price"] + coin["market_cap"]


async def test_says_which_summary_is_missing_instead_of_looking_complete() -> None:
    provider = FakeProvider()
    provider.fail = {"totals"}
    async with client_for(provider) as http:
        body = (await http.get(URL, headers=HEADERS)).json()
    assert body["totals"] is None
    assert body["unavailable"] == ["market totals"]
    assert body["assets"]


async def test_not_configured_is_a_clear_503() -> None:
    async with client_for(configured=False) as http:
        response = await http.get(URL, headers=HEADERS)
    assert response.status_code == 503
    assert "not configured" in response.json()["error"]["message"]


async def test_a_vendor_failure_reaches_the_visitor_only_as_a_generic_error() -> None:
    """The real provider behind the real route: the vendor's own wording must never get through."""
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
    assert response.json()["error"]["message"] == "The crypto data service returned an error."


async def test_our_quota_guard_is_a_503_with_retry_after() -> None:
    class Spent(FakeProvider):
        async def listings(self, limit: int) -> CryptoListings:
            raise UnavailableError("budget spent", headers={"Retry-After": "30"})

    async with client_for(Spent()) as http:
        response = await http.get(URL, headers=HEADERS)
    assert response.status_code == 503
    assert response.headers["retry-after"] == "30"


# -- Settings ----------------------------------------------------------------------------


def test_production_refuses_a_crypto_key_without_the_internal_token() -> None:
    with pytest.raises(ValidationError, match="INTERNAL_API_TOKEN"):
        make_settings(environment="production", cmc_api_key="plainly-not-a-real-key")


def test_production_accepts_a_crypto_key_with_the_internal_token() -> None:
    settings = make_settings(
        environment="production", cmc_api_key="plainly-not-a-real-key", internal_api_token=TOKEN
    )
    assert settings.cmc_api_key is not None


def test_development_may_run_a_key_without_the_token() -> None:
    assert make_settings(cmc_api_key="plainly-not-a-real-key").cmc_api_key is not None


def test_the_crypto_key_is_not_shown_in_the_settings_repr() -> None:
    assert "plainly-not-a-real-key" not in repr(make_settings(cmc_api_key="plainly-not-a-real-key"))


@pytest.mark.parametrize("field", ["cmc_calls_per_minute", "cmc_calls_per_day"])
def test_the_budgets_must_be_positive(field: str) -> None:
    with pytest.raises(ValidationError):
        make_settings(**{field: 0})


def test_the_per_minute_budget_cannot_exceed_the_plan() -> None:
    with pytest.raises(ValidationError):
        make_settings(cmc_calls_per_minute=51)
