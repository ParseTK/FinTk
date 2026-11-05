"""The stock endpoints are gone for good: asking for them is an ordinary 404, never a crash."""

import httpx
import pytest

from app.main import create_app
from tests.conftest import make_settings


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/companies/search",
        "/api/v1/companies/AAPL",
        "/api/v1/companies/AAPL/filings",
        "/api/v1/companies/AAPL/financials",
        "/api/v1/companies/AAPL/prices/monthly",
        "/api/v1/companies/AAPL/seasonality",
        "/api/v1/companies/AAPL/news",
        "/api/v1/markets",
        "/api/v1/news",
        "/api/v1/watchlist",
        "/api/v1/portfolio",
        "/api/v1/portfolio/lots",
    ],
)
async def test_a_removed_stock_endpoint_is_a_plain_404(path: str) -> None:
    app = create_app(make_settings())
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(path)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


async def test_the_remaining_api_is_what_the_crypto_product_needs() -> None:
    app = create_app(make_settings())
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        schema = (await client.get("/openapi.json")).json()
    paths = set(schema["paths"])
    assert "/api/v1/crypto/overview" in paths
    assert "/api/v1/crypto/markets" in paths
    assert "/api/v1/news/crypto" in paths
    assert not [path for path in paths if "/companies" in path or "portfolio" in path]
