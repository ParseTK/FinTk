"""Saving several purchases at once: all or none, with every problem reported by row."""

import asyncio
from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest

from app.db.engine import Database
from tests.helpers import World, make_world

BATCH = "/api/v1/portfolio/lots/batch"
PORTFOLIO = "/api/v1/portfolio"
LOTS = "/api/v1/portfolio/lots"


@pytest.fixture
async def world(database: Database) -> AsyncIterator[World]:
    w = await make_world(database, writes_per_minute=1000)
    yield w
    await w.alice.client.aclose()
    await w.bob.client.aclose()


def row(
    symbol: Any = "AAPL", shares: Any = "10", unit_cost: Any = "100.00", **extra: Any
) -> dict[str, Any]:
    return {"symbol": symbol, "shares": shares, "unit_cost": unit_cost, **extra}


async def purchases(world: World) -> list[dict[str, Any]]:
    return (await world.alice.get(LOTS)).json()["lots"]


def locations(response: httpx.Response) -> list[list[str | int]]:
    return [detail["loc"] for detail in response.json()["error"]["details"]]


# -- the happy path ------------------------------------------------------------------------------


async def test_every_row_is_saved_and_returned_in_the_order_sent(world: World) -> None:
    response = await world.alice.send(
        "POST",
        BATCH,
        json={
            "lots": [
                row("MSFT", "5", "300"),
                row("aapl", "12.5", "187.123456", acquired_on="2024-03-15"),
                row("KO", "20", "55.5"),
            ]
        },
    )

    assert response.status_code == 201
    lots = response.json()["lots"]
    assert [lot["symbol"] for lot in lots] == ["MSFT", "AAPL", "KO"]
    assert lots[1]["cost"] == "2339.04"  # exact decimal, to cents
    assert all(isinstance(lot["shares"], str) for lot in lots)
    assert len(await purchases(world)) == 3


async def test_the_holdings_reflect_the_whole_batch(world: World) -> None:
    await world.alice.send(
        "POST", BATCH, json={"lots": [row("AAPL", "10", "100"), row("AAPL", "10", "200")]}
    )
    holdings = (await world.alice.get(PORTFOLIO)).json()["holdings"]
    assert [(h["symbol"], h["shares"], h["average_cost"], h["lots"]) for h in holdings] == [
        ("AAPL", "20.000000", "150.000000", 2)
    ]


async def test_it_saves_the_most_the_form_offers(world: World) -> None:
    rows = [row("AAPL", str(i + 1), "10") for i in range(10)]
    response = await world.alice.send("POST", BATCH, json={"lots": rows})
    assert response.status_code == 201
    assert len(response.json()["lots"]) == 10


# -- all or none ---------------------------------------------------------------------------------


async def test_one_bad_row_saves_nothing_and_every_problem_is_located(world: World) -> None:
    response = await world.alice.send(
        "POST",
        BATCH,
        json={
            "lots": [
                row("AAPL"),
                row("NOPEX"),  # unknown company
                row("MSFT", acquired_on="2999-01-01"),  # future date
                row("KO"),
            ]
        },
    )

    assert response.status_code == 422
    body = response.json()["error"]
    assert body["code"] == "validation_error"
    assert locations(response) == [
        ["body", "lots", 1, "symbol"],
        ["body", "lots", 2, "acquired_on"],
    ]
    assert {d["type"] for d in body["details"]} == {"unknown_symbol", "future_date"}
    assert await purchases(world) == []  # the good rows were not saved either


async def test_malformed_rows_are_refused_by_validation_and_nothing_is_saved(
    world: World,
) -> None:
    bad_bodies: list[dict[str, Any]] = [
        {"lots": []},  # nothing to save
        {"lots": [row()] * 11},  # one over the limit
        {"lots": [row(shares=10)]},  # a JSON number, never accepted for money
        {"lots": [row(unit_cost="-1")]},
        {"lots": [row(shares="0")]},
        {"lots": [row(symbol="../x")]},
        {"lots": [row(extra_field="x")]},
        {"lots": [row()], "unexpected": True},
        {},
    ]
    for body in bad_bodies:
        response = await world.alice.send("POST", BATCH, json=body)
        assert response.status_code == 422, body
    assert await purchases(world) == []


async def test_a_database_failure_part_way_leaves_nothing_behind(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.repositories.portfolio import LotRepository

    original = LotRepository.create
    calls = 0

    async def flaky(self: LotRepository, user_id: Any, new: Any) -> Any:
        nonlocal calls
        calls += 1
        if calls == 3:
            raise RuntimeError("disk on fire")
        return await original(self, user_id, new)

    monkeypatch.setattr(LotRepository, "create", flaky)
    response = await world.alice.send(
        "POST", BATCH, json={"lots": [row("AAPL"), row("MSFT"), row("KO")]}
    )

    assert response.status_code == 500
    assert "disk on fire" not in response.text
    monkeypatch.undo()
    assert await purchases(world) == []  # the first two inserts were rolled back


# -- limits ---------------------------------------------------------------------------------------


async def test_a_batch_that_would_pass_the_limit_is_refused_whole(database: Database) -> None:
    world = await make_world(database, portfolio_max_lots=3, writes_per_minute=1000)
    try:
        await world.alice.send("POST", LOTS, json=row("AAPL"))
        response = await world.alice.send(
            "POST", BATCH, json={"lots": [row("MSFT"), row("KO"), row("AAPL")]}
        )

        assert response.status_code == 409
        assert response.json()["error"]["code"] == "limit_reached"
        assert len(await purchases(world)) == 1  # not even the two that would have fit
        ok = await world.alice.send("POST", BATCH, json={"lots": [row("MSFT"), row("KO")]})
        assert ok.status_code == 201  # exactly filling the allowance is fine
    finally:
        await world.alice.client.aclose()
        await world.bob.client.aclose()


async def test_two_simultaneous_batches_cannot_both_slip_under_the_limit(
    database: Database,
) -> None:
    world = await make_world(database, portfolio_max_lots=4, writes_per_minute=1000)
    try:
        trio = {"lots": [row("AAPL"), row("MSFT"), row("KO")]}
        results = await asyncio.gather(
            *(world.alice.send("POST", BATCH, json=trio) for _ in range(4))
        )
        assert sorted(r.status_code for r in results) == [201, 409, 409, 409]
        assert len(await purchases(world)) == 3
    finally:
        await world.alice.client.aclose()
        await world.bob.client.aclose()


# -- retries --------------------------------------------------------------------------------------


async def test_repeating_a_batch_with_its_key_returns_the_original_not_duplicates(
    world: World,
) -> None:
    body = {"lots": [row("AAPL"), row("MSFT", "5", "300")]}
    headers = {"Idempotency-Key": "batch-key-0001"}

    first = await world.alice.send("POST", BATCH, json=body, headers=headers)
    again = await world.alice.send("POST", BATCH, json=body, headers=headers)

    assert (first.status_code, again.status_code) == (201, 200)
    assert [lot["id"] for lot in again.json()["lots"]] == [
        lot["id"] for lot in first.json()["lots"]
    ]
    assert len(await purchases(world)) == 2


async def test_simultaneous_repeats_of_one_batch_save_it_once(world: World) -> None:
    body = {"lots": [row("AAPL"), row("MSFT"), row("KO")]}
    headers = {"Idempotency-Key": "double-click-key"}
    results = await asyncio.gather(
        *(world.alice.send("POST", BATCH, json=body, headers=headers) for _ in range(5))
    )
    assert sorted(r.status_code for r in results) == [200, 200, 200, 200, 201]
    assert len(await purchases(world)) == 3


async def test_a_key_reused_for_a_different_batch_is_a_conflict_not_an_overwrite(
    world: World,
) -> None:
    headers = {"Idempotency-Key": "reused-key-01"}
    await world.alice.send("POST", BATCH, json={"lots": [row("AAPL")]}, headers=headers)

    changed = await world.alice.send(
        "POST", BATCH, json={"lots": [row("AAPL", "99")]}, headers=headers
    )
    longer = await world.alice.send(
        "POST", BATCH, json={"lots": [row("AAPL"), row("KO")]}, headers=headers
    )

    assert changed.status_code == 409
    assert longer.status_code == 409
    assert len(await purchases(world)) == 1


async def test_the_longest_allowed_key_still_fits(world: World) -> None:
    headers = {"Idempotency-Key": "k" * 64}
    response = await world.alice.send("POST", BATCH, json={"lots": [row()]}, headers=headers)
    assert response.status_code == 201


async def test_a_batch_key_never_clashes_with_a_single_purchase_key(world: World) -> None:
    key = {"Idempotency-Key": "shared-key-01"}
    single = await world.alice.send("POST", LOTS, json=row("AAPL"), headers=key)
    batch = await world.alice.send("POST", BATCH, json={"lots": [row("AAPL")]}, headers=key)
    assert single.status_code == 201
    assert batch.status_code == 201
    assert len(await purchases(world)) == 2


# -- who may do it --------------------------------------------------------------------------------


async def test_it_needs_a_session_and_the_csrf_token(world: World) -> None:
    anonymous = httpx.AsyncClient(
        transport=httpx.ASGITransport(app=world.app, raise_app_exceptions=False),
        base_url="http://localhost:3000",
    )
    async with anonymous:
        assert (await anonymous.post(BATCH, json={"lots": [row()]})).status_code == 401
    assert (
        await world.alice.send("POST", BATCH, json={"lots": [row()]}, csrf=False)
    ).status_code == 403
    assert (
        await world.alice.send("POST", BATCH, json={"lots": [row()]}, origin=False)
    ).status_code == 403
    assert await purchases(world) == []


async def test_a_batch_only_ever_lands_in_the_senders_portfolio(world: World) -> None:
    await world.alice.send("POST", BATCH, json={"lots": [row("AAPL"), row("MSFT")]})
    assert (await world.bob.get(LOTS)).json() == {"lots": []}
    assert (await world.bob.get(PORTFOLIO)).json()["holdings"] == []
