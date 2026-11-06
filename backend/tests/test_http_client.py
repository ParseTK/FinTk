import httpx

from app.core.http import DEFAULT_TIMEOUT, build_client
from app.providers.coinmarketcap.client import build_http_client as build_crypto_client
from app.providers.sec.client import build_http_client as build_sec_client


async def test_default_client_has_a_timeout_and_never_follows_redirects() -> None:
    async with build_client() as client:
        assert client.timeout == DEFAULT_TIMEOUT
        assert client.follow_redirects is False


async def test_callers_can_set_headers_base_url_and_timeout() -> None:
    timeout = httpx.Timeout(3.0)
    async with build_client(
        base_url="https://example.test", headers={"Accept": "application/json"}, timeout=timeout
    ) as client:
        assert client.base_url.host == "example.test"
        assert client.headers["Accept"] == "application/json"
        assert client.timeout == timeout


async def test_every_vendor_client_is_built_the_same_safe_way() -> None:
    async with build_crypto_client("key-for-test") as crypto, build_sec_client("a@b.test") as sec:
        for client in (crypto, sec):
            assert client.follow_redirects is False
            assert client.timeout.read is not None
