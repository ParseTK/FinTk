from collections.abc import Callable
from pathlib import Path

import httpx
import pytest

from app.core.errors import UpstreamError
from app.domain.models import CompanyRef
from app.providers.sec.client import SecProvider, build_http_client, build_user_agent

FIXTURES = Path(__file__).parent / "fixtures"
APPLE = CompanyRef(cik="0000320193", ticker="AAPL", name="Apple Inc.", exchange="Nasdaq")
Handler = Callable[[httpx.Request], httpx.Response]


def fixture_bytes(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


class Upstream:
    """Fake SEC: serves the recorded fixtures and records every request it receives."""

    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []
        self.overrides: dict[str, Handler] = {}

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        url = str(request.url)
        for fragment, handler in self.overrides.items():
            if fragment in url:
                return handler(request)
        if url.endswith("company_tickers_exchange.json"):
            return httpx.Response(200, content=fixture_bytes("company_tickers_exchange.json"))
        if "/submissions/" in url:
            return httpx.Response(200, content=fixture_bytes("submissions_aapl.json"))
        return httpx.Response(404)


class NoWait:
    async def acquire(self) -> None:
        return None


def make_provider(upstream: Upstream) -> SecProvider:
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(upstream),
        headers={"User-Agent": build_user_agent("ops@example.test")},
    )
    return SecProvider(client, limiter=NoWait(), retry_delay=0)  # pyright: ignore[reportArgumentType]


def test_the_user_agent_identifies_the_app_with_a_contact() -> None:
    assert build_user_agent("ops@example.test") == "FinTk/0.1 (ops@example.test)"
    client = build_http_client("ops@example.test")
    assert client.headers["User-Agent"] == "FinTk/0.1 (ops@example.test)"


async def test_lookups_use_one_directory_download() -> None:
    upstream = Upstream()
    provider = make_provider(upstream)

    assert (await provider.lookup("aapl")) == APPLE
    assert (await provider.lookup("msft")) is not None
    assert await provider.lookup("NOPE") is None

    assert len(upstream.requests) == 1


async def test_requests_carry_the_identifying_user_agent() -> None:
    upstream = Upstream()
    provider = make_provider(upstream)
    await provider.lookup("AAPL")
    assert upstream.requests[0].headers["user-agent"] == "FinTk/0.1 (ops@example.test)"


async def test_repeated_filing_lists_share_one_submissions_download() -> None:
    upstream = Upstream()
    provider = make_provider(upstream)

    tenks = await provider.filings(APPLE, "10-K", 2)
    eightks = await provider.filings(APPLE, "8-K", 5)

    assert len(tenks) == 2
    assert eightks
    urls = [str(r.url) for r in upstream.requests]
    assert urls == ["https://data.sec.gov/submissions/CIK0000320193.json"]


async def test_a_transient_failure_is_retried_once() -> None:
    upstream = Upstream()
    attempts = 0

    def flaky(_: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(503)
        return httpx.Response(200, content=fixture_bytes("submissions_aapl.json"))

    upstream.overrides["/submissions/"] = flaky
    filings = await make_provider(upstream).filings(APPLE, None, 1)

    assert attempts == 2
    assert len(filings) == 1


async def test_a_dropped_connection_is_retried_then_reported_as_an_upstream_error() -> None:
    upstream = Upstream()

    def broken(_: httpx.Request) -> httpx.Response:
        msg = "connection reset"
        raise httpx.ConnectError(msg)

    upstream.overrides["/submissions/"] = broken
    with pytest.raises(UpstreamError):
        await make_provider(upstream).filings(APPLE, None, 1)
    assert len(upstream.requests) == 2


@pytest.mark.parametrize("status", [403, 404])
async def test_a_client_error_is_not_retried(status: int) -> None:
    upstream = Upstream()
    upstream.overrides["/submissions/"] = lambda _: httpx.Response(status)

    with pytest.raises(UpstreamError):
        await make_provider(upstream).filings(APPLE, None, 1)
    assert len(upstream.requests) == 1


async def test_a_persistent_server_error_gives_up_after_two_attempts() -> None:
    upstream = Upstream()
    upstream.overrides["/submissions/"] = lambda _: httpx.Response(500)

    with pytest.raises(UpstreamError):
        await make_provider(upstream).filings(APPLE, None, 1)
    assert len(upstream.requests) == 2


@pytest.mark.parametrize("body", [b"<html>blocked</html>", b"[1, 2, 3]"])
async def test_an_unreadable_or_unexpected_body_is_an_upstream_error(body: bytes) -> None:
    upstream = Upstream()
    upstream.overrides["/submissions/"] = lambda _: httpx.Response(200, content=body)

    with pytest.raises(UpstreamError):
        await make_provider(upstream).filings(APPLE, None, 1)


async def test_a_malformed_directory_is_an_upstream_error() -> None:
    upstream = Upstream()
    upstream.overrides["company_tickers"] = lambda _: httpx.Response(
        200, json={"fields": ["nope"], "data": []}
    )
    with pytest.raises(UpstreamError):
        await make_provider(upstream).lookup("AAPL")
