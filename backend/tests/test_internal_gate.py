"""The shared-secret guard for routes that only our own website server may call."""

import pytest
from fastapi import APIRouter, Depends
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.api.internal_deps import INTERNAL_TOKEN_HEADER, require_internal_caller
from app.main import create_app
from tests.conftest import make_settings

TOKEN = "t" * 40  # plainly not a real secret
OTHER = "u" * 40

gated = APIRouter(prefix="/__gated", dependencies=[Depends(require_internal_caller)])


@gated.get("/ping")
async def ping() -> dict[str, str]:
    return {"ok": "yes"}


def build(**overrides: object) -> AsyncClient:
    app = create_app(make_settings(**overrides), extra_routers=[gated])
    return AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test"
    )


async def test_open_in_development_when_no_secret_is_configured() -> None:
    async with build(environment="development") as http:
        assert (await http.get("/__gated/ping")).status_code == 200


async def test_closed_in_production_when_no_secret_is_configured() -> None:
    """Forgetting to set the secret must never publish the data."""
    async with build(environment="production") as http:
        response = await http.get("/__gated/ping")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


@pytest.mark.parametrize("environment", ["development", "test", "production"])
async def test_requires_the_secret_whenever_one_is_configured(environment: str) -> None:
    async with build(environment=environment, internal_api_token=TOKEN) as http:
        assert (await http.get("/__gated/ping")).status_code == 403
        wrong = await http.get("/__gated/ping", headers={INTERNAL_TOKEN_HEADER: OTHER})
        assert wrong.status_code == 403
        right = await http.get("/__gated/ping", headers={INTERNAL_TOKEN_HEADER: TOKEN})
        assert right.status_code == 200


async def test_rejects_empty_and_oversized_values() -> None:
    async with build(internal_api_token=TOKEN) as http:
        for value in ("", "x" * 5000):
            response = await http.get("/__gated/ping", headers={INTERNAL_TOKEN_HEADER: value})
            assert response.status_code == 403


async def test_a_refusal_never_reveals_the_secret_or_why() -> None:
    async with build(internal_api_token=TOKEN) as http:
        response = await http.get("/__gated/ping", headers={INTERNAL_TOKEN_HEADER: OTHER})
    assert TOKEN not in response.text
    assert OTHER not in response.text
    assert set(response.json()["error"]) <= {"code", "message", "request_id"}


async def test_a_prefix_or_superstring_of_the_secret_is_not_accepted() -> None:
    async with build(internal_api_token=TOKEN) as http:
        for value in (TOKEN[:-1], TOKEN + "x", TOKEN.upper()):
            response = await http.get("/__gated/ping", headers={INTERNAL_TOKEN_HEADER: value})
            assert response.status_code == 403


def test_a_short_secret_is_refused_at_startup() -> None:
    with pytest.raises(ValidationError, match="at least 32 characters"):
        make_settings(internal_api_token="short")


def test_the_secret_is_not_shown_in_the_settings_repr() -> None:
    assert TOKEN not in repr(make_settings(internal_api_token=TOKEN))
