"""The CoinMarketCap provider: request shape, key handling, quota budgets, retries and failures."""

import json
import logging
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
import pytest

from app.core.errors import UnavailableError, UpstreamError
from app.core.rate_limit import SlidingWindowBudget
from app.providers.coinmarketcap.client import BASE_URL, CoinMarketCapProvider

FIXTURES = Path(__file__).parent / "fixtures"
KEY = "plainly-not-a-real-key-plainly-not-a-real-key"
NOW = datetime(2026, 11, 3, 21, 0, tzinfo=UTC)


def fixture(name: str) -> dict[str, Any]:
    data: dict[str, Any] = json.loads((FIXTURES / name).read_text(encoding="utf-8"))
    return data


def make(
    handler: Callable[[httpx.Request], httpx.Response],
    *,
    per_minute: int = 50,
    per_day: int = 1000,
) -> CoinMarketCapProvider:
    client = httpx.AsyncClient(
        base_url=BASE_URL,
        headers={"X-CMC_PRO_API_KEY": KEY},
        transport=httpx.MockTransport(handler),
    )
    return CoinMarketCapProvider(
        client,
        per_minute=SlidingWindowBudget(per_minute, 60),
        per_day=SlidingWindowBudget(per_day, 86_400),
        now=lambda: NOW,
        retry_delay=0,
    )


def ok(payload: dict[str, Any]) -> Callable[[httpx.Request], httpx.Response]:
    return lambda _request: httpx.Response(200, json=payload)


async def test_listings_asks_for_the_top_coins_by_market_cap() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=fixture("cmc_listings.json"))

    listings = await make(handler).listings(25)
    assert [a.symbol for a in listings.assets] == ["EXG", "EXS", "EXT"]
    (request,) = seen
    assert request.url.path == "/v1/cryptocurrency/listings/latest"
    assert dict(request.url.params) == {
        "start": "1",
        "limit": "25",
        "convert": "USD",
        "sort": "market_cap",
    }


async def test_the_key_is_sent_in_a_header_and_never_in_the_url() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=fixture("cmc_global.json"))

    await make(handler).market_totals()
    (request,) = seen
    assert request.headers["X-CMC_PRO_API_KEY"] == KEY
    assert KEY not in str(request.url)


async def test_reads_market_totals_and_fear_and_greed() -> None:
    totals = await make(ok(fixture("cmc_global.json"))).market_totals()
    assert totals.btc_dominance is not None
    index = await make(ok(fixture("cmc_fear_greed.json"))).fear_greed()
    assert index.value == 61


async def test_the_fear_and_greed_call_uses_its_own_endpoint() -> None:
    seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.url.path)
        return httpx.Response(200, json=fixture("cmc_fear_greed.json"))

    await make(handler).fear_greed()
    assert seen == ["/v3/fear-and-greed/latest"]


async def test_our_own_per_minute_budget_refuses_before_the_provider_is_called() -> None:
    calls = 0

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json=fixture("cmc_fear_greed.json"))

    provider = make(handler, per_minute=2)
    await provider.fear_greed()
    await provider.fear_greed()
    with pytest.raises(UnavailableError) as refused:
        await provider.fear_greed()
    assert calls == 2
    assert refused.value.headers is not None
    assert int(refused.value.headers["Retry-After"]) >= 1


async def test_the_daily_budget_is_enforced_too() -> None:
    provider = make(ok(fixture("cmc_fear_greed.json")), per_day=1)
    await provider.fear_greed()
    with pytest.raises(UnavailableError):
        await provider.fear_greed()


async def test_retries_once_on_a_server_error() -> None:
    answers = [httpx.Response(503), httpx.Response(200, json=fixture("cmc_fear_greed.json"))]
    calls = 0

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return answers.pop(0)

    assert (await make(handler).fear_greed()).value == 61
    assert calls == 2


async def test_each_attempt_spends_the_budget() -> None:
    """A retry is a real call against the plan, so it must be counted."""
    provider = make(lambda _request: httpx.Response(503), per_minute=2)
    with pytest.raises(UpstreamError):
        await provider.fear_greed()  # attempt 1 and its retry use the two calls
    with pytest.raises(UnavailableError):
        await provider.fear_greed()


async def test_a_second_server_error_is_a_generic_upstream_failure() -> None:
    with pytest.raises(UpstreamError) as failure:
        await make(lambda _request: httpx.Response(502)).listings(25)
    assert "502" not in str(failure.value)
    assert KEY not in str(failure.value)


async def test_a_transport_failure_is_a_generic_upstream_failure() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("dns failure for pro-api.example", request=None)  # pyright: ignore[reportArgumentType]

    with pytest.raises(UpstreamError) as failure:
        await make(handler).listings(25)
    assert "dns" not in str(failure.value)


@pytest.mark.parametrize("status", [400, 401, 403, 429])
async def test_http_errors_never_leak_the_providers_wording(status: int) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, json={"status": {"error_code": status, "error_message": KEY}})

    with pytest.raises(UpstreamError) as failure:
        await make(handler).listings(25)
    assert KEY not in str(failure.value)


async def test_an_error_code_inside_a_200_response_is_an_error() -> None:
    body = {"status": {"error_code": 1008, "error_message": "You've exceeded your rate limit"}}
    with pytest.raises(UpstreamError):
        await make(ok(body)).market_totals()


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(200, text="<html>not json</html>"),
        httpx.Response(200, json=["a", "list"]),
        httpx.Response(200, json={"status": {"error_code": 0}, "data": "nonsense"}),
        httpx.Response(200, content=b"x" * 2_100_000),
    ],
)
async def test_unreadable_responses_are_an_upstream_failure(response: httpx.Response) -> None:
    with pytest.raises(UpstreamError):
        await make(lambda _request: response).listings(25)


async def test_logs_the_credits_used_and_never_the_key_or_body(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.DEBUG)
    await make(ok(fixture("cmc_listings.json"))).listings(25)
    text = " ".join(record.getMessage() for record in caplog.records)
    assert "1 credit" in text
    assert KEY not in text
    assert "Example Gold" not in text  # response bodies are never logged
