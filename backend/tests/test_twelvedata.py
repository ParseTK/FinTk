import json
from collections.abc import Callable
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any

import httpx
import pytest

from app.core.errors import UnavailableError, UpstreamError
from app.core.rate_limit import SlidingWindowBudget
from app.providers.twelvedata import parsers
from app.providers.twelvedata.client import TwelveDataProvider, build_http_client

FIXTURES = Path(__file__).parent / "fixtures"
TODAY = date(2026, 11, 2)  # the fixture was recorded on 2026-11-02; November is still partial
Handler = Callable[[httpx.Request], httpx.Response]


def recorded() -> dict[str, Any]:
    return json.loads((FIXTURES / "twelvedata_aapl_monthly.json").read_text())


class Upstream:
    def __init__(self, handler: Handler | None = None) -> None:
        self.requests: list[httpx.Request] = []
        self._handler = handler

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self._handler is not None:
            return self._handler(request)
        # The recorded response is oldest first; the real API is asked for newest first.
        body = recorded()
        body["values"] = list(reversed(body["values"]))
        return httpx.Response(200, json=body)


def make_provider(
    upstream: Upstream,
    *,
    per_minute: int = 100,
    per_day: int = 1000,
    today: date = TODAY,
) -> TwelveDataProvider:
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(upstream),
        base_url="https://api.twelvedata.test",
        headers={"Authorization": "apikey placeholder"},
    )
    return TwelveDataProvider(
        client,
        per_minute=SlidingWindowBudget(per_minute, 60),
        per_day=SlidingWindowBudget(per_day, 86400),
        today=lambda: today,
        retry_delay=0,
    )


# -- parser, on the recorded real response -------------------------------------------------------


def test_the_recorded_history_goes_back_to_apples_first_full_month() -> None:
    prices = parsers.parse_monthly(recorded(), date(2026, 10, 31))
    assert prices[0].month_end == date(1980, 12, 31)
    assert prices[0].close == Decimal("0.152344")  # 0.15234400 stored at six decimals
    assert len(prices) > 540


def test_the_partial_current_month_is_dropped() -> None:
    prices = parsers.parse_monthly(recorded(), date(2026, 10, 31))
    assert prices[-1].month_end == date(2026, 10, 31)
    assert all(p.month_end <= date(2026, 10, 31) for p in prices)


def test_months_come_back_oldest_first_one_per_month_whatever_the_input_order() -> None:
    payload = {"values": [{"datetime": "2020-03-01", "close": "3"}] * 2}
    payload["values"] += [
        {"datetime": "2020-01-01", "close": "1"},
        {"datetime": "2020-02-01", "close": "2"},
    ]
    prices = parsers.parse_monthly(payload, date(2026, 1, 31))
    assert [p.month_end for p in prices] == [
        date(2020, 1, 31),
        date(2020, 2, 29),
        date(2020, 3, 31),
    ]


def test_closes_are_rounded_to_the_stored_precision_and_unusable_ones_skipped() -> None:
    payload = {
        "values": [
            {"datetime": "2020-01-01", "close": "0.096539997"},
            {"datetime": "2020-02-01", "close": None},
            {"datetime": "2020-03-01", "close": "0"},
            {"datetime": "2020-04-01", "close": "0.0000001"},  # rounds to zero at six decimals
            {"datetime": "2020-05-01", "close": "NaN"},
            {"datetime": "2020-06-01", "close": "1e20"},
            {"datetime": "2020-07-01", "close": "5"},
        ]
    }
    prices = parsers.parse_monthly(payload, date(2026, 1, 31))
    assert [(p.month_end, p.close) for p in prices] == [
        (date(2020, 1, 31), Decimal("0.096540")),
        (date(2020, 7, 31), Decimal("5.000000")),
    ]


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"values": "nope"},
        {"values": ["nope"]},
        {"values": [{"close": "1"}]},
        {"values": [{"datetime": "not a date", "close": "1"}]},
        {"values": [{"datetime": "2020-01-01", "close": "abc"}]},
        {"values": [{"datetime": "2020-01-01", "close": "1"}] * 1201},
    ],
)
def test_malformed_responses_are_rejected(payload: dict[str, Any]) -> None:
    with pytest.raises((ValueError, KeyError, TypeError)):
        parsers.parse_monthly(payload, date(2026, 1, 31))


def test_error_codes_are_read_from_the_body() -> None:
    assert parsers.error_code({"status": "ok", "values": []}) is None
    assert parsers.error_code({"status": "error", "code": 429}) == 429
    assert parsers.error_code({"status": "error"}) == 0


# -- client --------------------------------------------------------------------------------------


async def test_the_whole_history_is_one_call_and_excludes_the_partial_month() -> None:
    upstream = Upstream()
    history = await make_provider(upstream).monthly_history("aapl")
    assert len(upstream.requests) == 1
    params = upstream.requests[0].url.params
    assert (params["symbol"], params["interval"], params["order"]) == ("AAPL", "1month", "DESC")
    assert params["outputsize"] == "5000"
    assert history.source == "Twelve Data"
    assert history.symbol == "AAPL"
    assert history.prices[0].month_end == date(1980, 12, 31)
    assert history.prices[-1].month_end == date(2026, 10, 31)


async def test_the_key_is_sent_in_a_header_never_in_the_url() -> None:
    upstream = Upstream()
    client = build_http_client("placeholder")
    assert client.headers["Authorization"] == "apikey placeholder"
    await make_provider(upstream).monthly_history("AAPL")
    assert "apikey" not in str(upstream.requests[0].url).lower()


async def test_an_incremental_request_asks_only_for_the_newest_months() -> None:
    upstream = Upstream()
    await make_provider(upstream).monthly_history("AAPL", since=date(2026, 8, 31))
    # Aug (restated), Sep, Oct and the partial Nov.
    assert upstream.requests[0].url.params["outputsize"] == "4"


async def test_an_incremental_request_never_asks_for_fewer_than_two_rows() -> None:
    upstream = Upstream()
    await make_provider(upstream).monthly_history("AAPL", since=date(2026, 11, 30))
    assert upstream.requests[0].url.params["outputsize"] == "2"


async def test_share_classes_use_the_providers_spelling() -> None:
    upstream = Upstream()
    await make_provider(upstream).monthly_history("BRK-B")
    assert upstream.requests[0].url.params["symbol"] == "BRK.B"


@pytest.mark.parametrize("code", [400, 404])
async def test_a_symbol_the_provider_does_not_know_is_an_empty_history_not_an_error(
    code: int,
) -> None:
    upstream = Upstream(
        lambda _: httpx.Response(200, json={"status": "error", "code": code, "message": "x"})
    )
    history = await make_provider(upstream).monthly_history("ZZZZ")
    assert history.prices == ()
    assert history.source == "Twelve Data"


@pytest.mark.parametrize("code", [401, 403, 429, 500])
async def test_other_provider_errors_are_a_generic_upstream_failure(code: int) -> None:
    secretish = "do-not-leak-this-text"
    upstream = Upstream(
        lambda _: httpx.Response(200, json={"status": "error", "code": code, "message": secretish})
    )
    with pytest.raises(UpstreamError) as caught:
        await make_provider(upstream).monthly_history("AAPL")
    assert secretish not in caught.value.message


async def test_a_transient_server_error_is_retried_once() -> None:
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls == 1:
            return httpx.Response(503)
        return httpx.Response(200, json={"values": [{"datetime": "2020-01-01", "close": "1"}]})

    history = await make_provider(Upstream(handler)).monthly_history("AAPL")
    assert calls == 2
    assert len(history.prices) == 1


async def test_a_persistent_server_error_and_a_dead_connection_fail_cleanly() -> None:
    with pytest.raises(UpstreamError):
        await make_provider(Upstream(lambda _: httpx.Response(503))).monthly_history("AAPL")

    def refuse(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("boom", request=request)

    with pytest.raises(UpstreamError):
        await make_provider(Upstream(refuse)).monthly_history("AAPL")


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(200, content=b"<html>"),
        httpx.Response(200, json=[1, 2]),
        httpx.Response(200, json={}),
    ],
)
async def test_unreadable_responses_are_a_generic_upstream_failure(
    response: httpx.Response,
) -> None:
    with pytest.raises(UpstreamError):
        await make_provider(Upstream(lambda _: response)).monthly_history("AAPL")


async def test_our_own_quota_guard_refuses_before_the_provider_can_block_us() -> None:
    upstream = Upstream()
    provider = make_provider(upstream, per_minute=2)
    await provider.monthly_history("AAPL")
    await provider.monthly_history("MSFT")
    with pytest.raises(UnavailableError) as caught:
        await provider.monthly_history("NVDA")
    assert len(upstream.requests) == 2  # the third never left the building
    assert caught.value.headers is not None
    assert int(caught.value.headers["Retry-After"]) >= 1


async def test_the_daily_budget_is_enforced_too() -> None:
    provider = make_provider(Upstream(), per_day=1)
    await provider.monthly_history("AAPL")
    with pytest.raises(UnavailableError):
        await provider.monthly_history("MSFT")


async def test_a_retry_spends_budget_too() -> None:
    calls = 0

    def flaky(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(503)

    provider = make_provider(Upstream(flaky), per_minute=1)
    with pytest.raises(UnavailableError):
        await provider.monthly_history("AAPL")
    assert calls == 1  # the retry was refused by the budget, not sent
