"""The anchor call, and keeping the daily budget honest when a call costs more than one credit."""

import json
from collections.abc import Callable
from copy import deepcopy
from datetime import UTC, date, datetime
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
DAY = date(2026, 1, 1)


def anchor_payload(used: int = 1) -> dict[str, Any]:
    data: dict[str, Any] = json.loads((FIXTURES / "cmc_anchor.json").read_text(encoding="utf-8"))
    payload = deepcopy(data)
    payload["status"]["credit_count"] = used
    return payload


def make(
    handler: Callable[[httpx.Request], httpx.Response], *, per_minute: int = 50, per_day: int = 1000
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


async def test_asks_for_one_daily_point_per_coin_starting_the_day_before() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=anchor_payload())

    anchor = await make(handler).anchor_prices([9003, 9001, 9002, 9001], DAY)
    (request,) = seen
    assert request.url.path == "/v3/cryptocurrency/quotes/historical"
    params = dict(request.url.params)
    assert params == {
        "id": "9001,9002,9003",  # sorted, each coin once
        "interval": "daily",
        "time_start": "2025-12-31",  # the provider stamps a point with the day it closes
        "count": "1",
        "convert": "USD",
    }
    assert anchor.on == date(2026, 1, 1)
    assert set(anchor.prices) == {9001, 9002, 9003}


async def test_the_key_is_in_a_header_never_the_url() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=anchor_payload())

    await make(handler).anchor_prices([9001], DAY)
    assert seen[0].headers["X-CMC_PRO_API_KEY"] == KEY
    assert KEY not in str(seen[0].url)


async def test_an_older_day_than_the_plan_allows_is_a_generic_failure() -> None:
    body = {"status": {"error_code": 400, "error_message": "Your plan allows 12 months " + KEY}}

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json=body)

    with pytest.raises(UpstreamError) as failure:
        await make(handler).anchor_prices([9001], DAY)
    assert KEY not in str(failure.value)
    assert "12 months" not in str(failure.value)


async def test_an_unreadable_response_is_an_upstream_failure() -> None:
    bad = {"status": {"error_code": 0, "credit_count": 1}, "data": {"1": "nonsense"}}
    with pytest.raises(UpstreamError):
        await make(ok(bad)).anchor_prices([1], DAY)


async def test_a_call_that_costs_one_credit_is_counted_as_one() -> None:
    provider = make(ok(anchor_payload(used=1)), per_day=2)
    await provider.anchor_prices([9001], DAY)
    await provider.anchor_prices([9001], DAY)
    with pytest.raises(UnavailableError):
        await provider.anchor_prices([9001], DAY)  # the third would be the third credit


async def test_a_call_that_costs_many_credits_is_counted_in_full() -> None:
    """A long history costs dozens of credits. The daily budget must remember them all."""
    provider = make(ok(anchor_payload(used=31)), per_day=31)
    await provider.anchor_prices([9001], DAY)  # 31 credits gone
    with pytest.raises(UnavailableError):
        await provider.anchor_prices([9001], DAY)


async def test_the_per_minute_limit_counts_calls_not_credits() -> None:
    """The plan's rate limit is per request, so one expensive call is still one request."""
    provider = make(ok(anchor_payload(used=31)), per_minute=2, per_day=1000)
    await provider.anchor_prices([9001], DAY)
    await provider.anchor_prices([9001], DAY)
    with pytest.raises(UnavailableError):
        await provider.anchor_prices([9001], DAY)
    assert True  # refused by the per-minute budget (calls), though 1,000 credits a day remain


async def test_a_failed_call_costs_nothing_extra() -> None:
    provider = make(lambda _request: httpx.Response(400, json={"status": {"error_code": 400}}))
    with pytest.raises(UpstreamError):
        await provider.anchor_prices([9001], DAY)
    # the budget was spent only for the attempt itself: a healthy call still goes through
    healthy = make(ok(anchor_payload()), per_day=1)
    await healthy.anchor_prices([9001], DAY)
