import asyncio

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.api import health


async def test_healthz_is_ok(client: AsyncClient) -> None:
    response = await client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_readyz_is_ready_with_no_checks(client: AsyncClient) -> None:
    response = await client.get("/readyz")
    assert response.status_code == 200
    assert response.json() == {"status": "ready", "failed": []}


async def test_readyz_reports_failing_checks_by_name_only(
    app: FastAPI, client: AsyncClient
) -> None:
    async def healthy() -> None:
        return None

    async def broken() -> None:
        msg = "connection refused: postgres://user:secret@db/virello"
        raise ConnectionError(msg)

    app.state.readiness_checks = {"cache": healthy, "database": broken}

    response = await client.get("/readyz")

    assert response.status_code == 503
    assert response.json() == {"status": "not_ready", "failed": ["database"]}
    assert "secret" not in response.text


async def test_readyz_treats_a_hanging_check_as_failed(
    app: FastAPI, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(health, "CHECK_TIMEOUT_SECONDS", 0.05)

    async def hangs() -> None:
        await asyncio.sleep(5)

    app.state.readiness_checks = {"database": hangs}

    response = await client.get("/readyz")

    assert response.status_code == 503
    assert response.json()["failed"] == ["database"]


async def test_healthz_ignores_dependencies(app: FastAPI, client: AsyncClient) -> None:
    async def broken() -> None:
        msg = "down"
        raise ConnectionError(msg)

    app.state.readiness_checks = {"database": broken}

    assert (await client.get("/healthz")).status_code == 200
