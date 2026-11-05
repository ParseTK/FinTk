"""What the app builds when it starts, and what it closes when it stops.

The lifespan creates only what is configured and not already injected, and closes exactly what it
created. These tests run the real lifespan (no network is used: nothing connects until first use).
"""

from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from pydantic import SecretStr

from app.main import create_app
from tests.conftest import make_settings


@pytest.fixture
def closed(monkeypatch: pytest.MonkeyPatch) -> dict[str, int]:
    """Counts how many HTTP clients get closed, while still closing them."""
    count = {"clients": 0}
    real = httpx.AsyncClient.aclose

    async def counting(self: httpx.AsyncClient) -> None:
        count["clients"] += 1
        await real(self)

    monkeypatch.setattr(httpx.AsyncClient, "aclose", counting)
    return count


async def run(app: FastAPI) -> dict[str, Any]:
    """Start and stop the app, and report what was built while it was running."""
    async with app.router.lifespan_context(app):
        return {
            "companies": app.state.company_service,
            "news": app.state.news_service,
            "crypto": app.state.crypto_service,
            "database": app.state.database,
            "oauth": dict(app.state.oauth_providers),
            "checks": dict(app.state.readiness_checks),
        }


async def test_with_no_configuration_only_the_news_service_is_built(
    closed: dict[str, int],
) -> None:
    built = await run(create_app(make_settings(sec_contact_email=None)))
    assert built["news"] is not None
    assert built["companies"] is None
    assert built["crypto"] is None
    assert built["database"] is None
    assert built["oauth"] == {}
    assert "database" not in built["checks"]
    assert closed["clients"] == 1  # the news feed client


async def test_a_sec_contact_builds_the_company_service_and_closes_its_client(
    closed: dict[str, int],
) -> None:
    built = await run(create_app(make_settings()))  # make_settings has a SEC contact
    assert built["companies"] is not None
    assert closed["clients"] == 2  # SEC client and the news feed client


async def test_a_crypto_key_builds_the_crypto_service_and_closes_its_client(
    closed: dict[str, int],
) -> None:
    built = await run(create_app(make_settings(cmc_api_key=SecretStr("a-key-for-this-test"))))
    assert built["crypto"] is not None
    assert closed["clients"] == 3  # SEC, news feed and crypto


async def test_without_a_crypto_key_there_is_no_crypto_service(closed: dict[str, int]) -> None:
    built = await run(create_app(make_settings()))
    assert built["crypto"] is None


async def test_a_configured_sign_in_provider_is_built_and_its_client_closed(
    closed: dict[str, int],
) -> None:
    settings = make_settings(
        github_client_id="client-id",
        github_client_secret=SecretStr("client-secret-for-this-test"),
        secret_key=SecretStr("k" * 32),
        public_url="http://localhost:3000",
    )
    built = await run(create_app(settings))
    assert sorted(built["oauth"]) == ["github"]
    assert closed["clients"] == 3  # sign-in, SEC and news feed


async def test_services_that_are_injected_are_kept_and_nothing_is_built_for_them(
    closed: dict[str, int],
) -> None:
    companies, news, crypto = object(), object(), object()
    app = create_app(
        make_settings(cmc_api_key=SecretStr("a-key-for-this-test")),
        company_service=companies,  # type: ignore[arg-type]
        news_service=news,  # type: ignore[arg-type]
        crypto_service=crypto,  # type: ignore[arg-type]
    )
    built = await run(app)
    assert (built["companies"], built["news"], built["crypto"]) == (companies, news, crypto)
    assert closed["clients"] == 0


async def test_a_database_url_builds_the_engine_and_registers_its_readiness_check(
    test_database_url: str,
) -> None:
    app = create_app(make_settings(database_url=SecretStr(test_database_url)))
    async with app.router.lifespan_context(app):
        assert app.state.database is not None
        await app.state.readiness_checks["database"]()  # a real round trip
