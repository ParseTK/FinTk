"""Who may do what: anonymous callers, CSRF, other people's data, abuse limits, deletion."""

import uuid
from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest
from sqlalchemy import func, select

from app.db.engine import Database
from app.db.models import HoldingLot, WatchlistItem
from tests.helpers import ORIGIN, World, build_app, make_world

LOTS = "/api/v1/portfolio/lots"
WATCHLIST = "/api/v1/watchlist"
BODY = {"symbol": "AAPL", "shares": "10", "unit_cost": "100"}


@pytest.fixture
async def world(database: Database) -> AsyncIterator[World]:
    w = await make_world(database)
    yield w
    await w.alice.client.aclose()
    await w.bob.client.aclose()


async def alices_lot(world: World) -> dict[str, Any]:
    response = await world.alice.send("POST", LOTS, json=BODY)
    assert response.status_code == 201
    return response.json()


# -- anonymous callers ----------------------------------------------------

READS = [("GET", "/api/v1/portfolio"), ("GET", LOTS), ("GET", WATCHLIST)]
WRITES: list[tuple[str, str, dict[str, Any] | None]] = [
    ("PUT", f"{WATCHLIST}/AAPL", None),
    ("DELETE", f"{WATCHLIST}/AAPL", None),
    ("POST", LOTS, BODY),
    ("PUT", f"{LOTS}/{uuid.uuid4()}", {"shares": "1", "unit_cost": "1"}),
    ("DELETE", f"{LOTS}/{uuid.uuid4()}", None),
]


@pytest.fixture
async def anonymous(world: World) -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=world.app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url=ORIGIN) as client:
        yield client


@pytest.mark.parametrize(("method", "path"), READS)
async def test_reading_needs_a_session(
    anonymous: httpx.AsyncClient, method: str, path: str
) -> None:
    response = await anonymous.request(method, path)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


@pytest.mark.parametrize(("method", "path", "body"), WRITES)
async def test_writing_needs_a_session(
    anonymous: httpx.AsyncClient, method: str, path: str, body: dict[str, Any] | None
) -> None:
    response = await anonymous.request(method, path, json=body, headers={"Origin": ORIGIN})
    assert response.status_code == 401


async def test_a_garbage_or_expired_session_is_the_same_as_none(
    anonymous: httpx.AsyncClient,
) -> None:
    anonymous.cookies.set("virello_session", "not-a-real-token")
    assert (await anonymous.get("/api/v1/portfolio")).status_code == 401


# -- CSRF on every write ----------------------------------------------------


@pytest.mark.parametrize(("method", "path", "body"), WRITES)
@pytest.mark.parametrize(
    ("csrf", "origin"),
    [(False, True), (True, False), (False, False)],
    ids=["no-token", "no-origin", "neither"],
)
async def test_every_write_needs_the_csrf_token_and_a_trusted_origin(
    world: World,
    method: str,
    path: str,
    body: dict[str, Any] | None,
    csrf: bool,
    origin: bool,
) -> None:
    response = await world.alice.send(method, path, json=body, csrf=csrf, origin=origin)
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "csrf_failed"


async def test_a_foreign_origin_is_refused_even_with_a_valid_token(world: World) -> None:
    response = await world.alice.client.post(
        LOTS,
        json=BODY,
        headers={"Origin": "https://evil.example", "X-CSRF-Token": world.alice.csrf},
    )
    assert response.status_code == 403
    assert (await world.alice.get(LOTS)).json() == {"lots": []}


async def test_another_persons_csrf_token_is_refused(world: World) -> None:
    response = await world.alice.client.post(
        LOTS, json=BODY, headers={"Origin": ORIGIN, "X-CSRF-Token": world.bob.csrf}
    )
    assert response.status_code == 403


async def test_reads_need_no_csrf_token(world: World) -> None:
    assert (await world.alice.get(LOTS)).status_code == 200


# -- other people's data (IDOR) --------------------------------------------------------------------


async def test_someone_elses_purchase_looks_exactly_like_one_that_does_not_exist(
    world: World,
) -> None:
    mine = await alices_lot(world)
    nobody = uuid.uuid4()
    change = {"shares": "1", "unit_cost": "1"}

    for method, body in (("PUT", change), ("DELETE", None)):
        foreign = await world.bob.send(method, f"{LOTS}/{mine['id']}", json=body)
        missing = await world.bob.send(method, f"{LOTS}/{nobody}", json=body)

        assert foreign.status_code == missing.status_code == 404
        # Identical, apart from the per-request id: nothing tells Bob that the lot exists.
        foreign_error = foreign.json()["error"]
        missing_error = missing.json()["error"]
        assert {k: v for k, v in foreign_error.items() if k != "request_id"} == {
            k: v for k, v in missing_error.items() if k != "request_id"
        }


async def test_a_failed_attempt_on_someone_elses_purchase_changes_nothing(world: World) -> None:
    mine = await alices_lot(world)

    await world.bob.send("PUT", f"{LOTS}/{mine['id']}", json={"shares": "1", "unit_cost": "1"})
    await world.bob.send("DELETE", f"{LOTS}/{mine['id']}")

    (still,) = (await world.alice.get(LOTS)).json()["lots"]
    assert still == mine


async def test_lists_and_holdings_never_include_another_persons_data(world: World) -> None:
    await alices_lot(world)
    await world.alice.send("PUT", f"{WATCHLIST}/AAPL")

    assert (await world.bob.get(LOTS)).json() == {"lots": []}
    assert (await world.bob.get(LOTS, params={"symbol": "AAPL"})).json() == {"lots": []}
    assert (await world.bob.get("/api/v1/portfolio")).json()["holdings"] == []
    assert (await world.bob.get(WATCHLIST)).json() == {"items": []}


async def test_the_owner_cannot_be_chosen_by_the_client(world: World, database: Database) -> None:
    response = await world.bob.send(
        "POST", LOTS, json={**BODY, "user_id": str(world.alice.user_id)}
    )
    assert response.status_code == 422

    created = await world.bob.send("POST", LOTS, json=BODY)
    async with database.session() as session:
        owner = await session.scalar(
            select(HoldingLot.user_id).where(HoldingLot.id == uuid.UUID(created.json()["id"]))
        )
    assert owner == world.bob.user_id


async def test_the_repository_itself_refuses_to_touch_another_users_rows(
    world: World, database: Database
) -> None:
    """Second layer under the API check: even a caller that forgot to check cannot cross users."""
    from datetime import UTC, datetime
    from decimal import Decimal

    from app.repositories.portfolio import LotRepository

    mine = await alices_lot(world)
    lot_id = uuid.UUID(mine["id"])
    async with database.session() as session:
        repo = LotRepository(session)
        changed = await repo.update(
            world.bob.user_id,
            lot_id,
            shares=Decimal(1),
            unit_cost=Decimal(1),
            acquired_on=None,
            now=datetime.now(UTC),
        )
        deleted = await repo.delete(world.bob.user_id, lot_id)
        assert (changed, deleted) == (None, False)
        assert await repo.for_user(world.bob.user_id) == []
        assert len(await repo.for_user(world.alice.user_id)) == 1


# -- abuse limits ----------------------------------------------------


async def test_writes_are_limited_per_person_and_reads_are_not(database: Database) -> None:
    world = await make_world(database, writes_per_minute=3)
    try:
        codes = [(await world.alice.send("PUT", f"{WATCHLIST}/AAPL")).status_code for _ in range(5)]
        blocked = await world.alice.send("PUT", f"{WATCHLIST}/AAPL")

        assert codes == [201, 200, 200, 429, 429]
        assert blocked.json()["error"]["code"] == "rate_limited"
        assert 1 <= int(blocked.headers["retry-after"]) <= 60
        assert (await world.alice.get(WATCHLIST)).status_code == 200  # reads are never limited
        assert (await world.bob.send("PUT", f"{WATCHLIST}/MSFT")).status_code == 201  # per person
    finally:
        await world.alice.client.aclose()
        await world.bob.client.aclose()


async def test_a_rejected_csrf_check_does_not_use_up_the_write_allowance(
    database: Database,
) -> None:
    world = await make_world(database, writes_per_minute=2)
    try:
        for _ in range(5):
            await world.alice.send("PUT", f"{WATCHLIST}/AAPL", csrf=False)  # all 403
        assert (await world.alice.send("PUT", f"{WATCHLIST}/AAPL")).status_code == 201
    finally:
        await world.alice.client.aclose()
        await world.bob.client.aclose()


# -- deleting the account ----------------------------------------------------


async def test_deleting_an_account_deletes_its_watchlist_and_purchases_and_only_those(
    world: World, database: Database
) -> None:
    await alices_lot(world)
    await world.alice.send("PUT", f"{WATCHLIST}/AAPL")
    await world.bob.send("POST", LOTS, json=BODY)
    await world.bob.send("PUT", f"{WATCHLIST}/MSFT")

    assert (await world.alice.send("DELETE", "/api/v1/me")).status_code == 204

    async with database.session() as session:
        lots = (await session.execute(select(HoldingLot.user_id))).scalars().all()
        watched = (await session.execute(select(WatchlistItem.user_id))).scalars().all()
        total = (await session.execute(select(func.count()).select_from(HoldingLot))).scalar_one()
    assert lots == [world.bob.user_id]
    assert watched == [world.bob.user_id]
    assert total == 1
    assert (await world.alice.get(LOTS)).status_code == 401  # the session went with the account


async def test_a_deleted_account_cannot_keep_writing(world: World) -> None:
    await world.alice.send("DELETE", "/api/v1/me")
    response = await world.alice.send("POST", LOTS, json=BODY)
    assert response.status_code == 401


async def test_without_a_database_these_routes_say_so_instead_of_failing(
    database: Database,
) -> None:
    app = build_app(database)
    app.state.database = None  # as if the database were not configured
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url=ORIGIN) as client:
        client.cookies.set("virello_session", "anything")
        response = await client.get("/api/v1/portfolio")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "unavailable"
