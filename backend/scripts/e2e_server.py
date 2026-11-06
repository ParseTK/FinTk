"""The real API with a stand-in data vendor, for the browser smoke tests.

Everything is real (routes, services, database, sessions) except the market data provider, which is
answered from the invented fixtures in tests/fixtures. No API key and no network access are needed,
and no real vendor data is involved. Never runs in production.

    uv run python -m scripts.e2e_server     # listens on 127.0.0.1:8000 (E2E_API_PORT changes it)
"""

import json
import os
from pathlib import Path
from typing import Any

import httpx
import uvicorn

from app.core.config import get_settings
from app.core.rate_limit import SlidingWindowBudget
from app.main import create_app
from app.providers.coinmarketcap.client import BASE_URL, CoinMarketCapProvider
from app.services.crypto import CryptoService

FIXTURES = Path(__file__).resolve().parent.parent / "tests" / "fixtures"

# Which fixture answers which vendor path.
ROUTES = {
    "/v1/cryptocurrency/listings/latest": "cmc_listings.json",
    "/v1/global-metrics/quotes/latest": "cmc_global.json",
    "/v3/fear-and-greed/latest": "cmc_fear_greed.json",
    "/v3/cryptocurrency/quotes/historical": "cmc_anchor.json",
}


def vendor(request: httpx.Request) -> httpx.Response:
    name = ROUTES.get(request.url.path)
    if name is None:
        return httpx.Response(404, json={"status": {"error_code": 404}})
    body: dict[str, Any] = json.loads((FIXTURES / name).read_text(encoding="utf-8"))
    return httpx.Response(200, json=body)


def main() -> None:
    settings = get_settings()
    if settings.is_production:
        msg = "The e2e server serves invented data and must never run in production."
        raise SystemExit(msg)
    provider = CoinMarketCapProvider(
        httpx.AsyncClient(base_url=BASE_URL, transport=httpx.MockTransport(vendor)),
        per_minute=SlidingWindowBudget(10_000, 60),
        per_day=SlidingWindowBudget(1_000_000, 86_400),
        retry_delay=0,
    )
    app = create_app(settings, crypto_service=CryptoService(provider))
    port = int(os.environ.get("E2E_API_PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning", server_header=False)


if __name__ == "__main__":
    main()
