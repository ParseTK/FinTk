"""The caps and the idempotency key under truly simultaneous requests.

A limit checked as "count, then insert" lets two requests both pass. These tests fire the requests
at the same instant and assert the limit still holds exactly.
"""

import asyncio
import uuid
from collections import Counter

import pytest
from sqlalchemy import func, select

from app.db.engine import Database
from app.db.models import HoldingLot, WatchlistItem
from app.domain.portfolio import Lot
from app.repositories.portfolio import LotRepository
from tests.helpers import make_world

LOTS = "/api/v1/portfolio/lots"
SYMBOLS = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "TSLA", "KO", "JPM"]


async def test_simultaneous_watchlist_adds_cannot_exceed_the_cap(database: Database) -> None:
    world = await make_world(database, watchlist_max_items=3, writes_per_minute=1000)
    try:
        responses = await asyncio.gather(
            *(world.alice.send("PUT", f"/api/v1/watchlist/{symbol}") for symbol in SYMBOLS)
        )

        assert Counter(r.status_code for r in responses) == Counter({201: 3, 409: 5})
        async with database.session() as session:
            stored = (
                await session.execute(select(func.count()).select_from(WatchlistItem))
            ).scalar_one()
        assert stored == 3
    finally:
        await world.alice.client.aclose()
        await world.bob.client.aclose()


async def test_simultaneous_purchases_cannot_exceed_the_cap(database: Database) -> None:
    world = await make_world(database, portfolio_max_lots=3, writes_per_minute=1000)
    try:
        body = {"symbol": "AAPL", "shares": "1", "unit_cost": "1"}
        responses = await asyncio.gather(
            *(world.alice.send("POST", LOTS, json=body) for _ in range(10))
        )

        assert Counter(r.status_code for r in responses) == Counter({201: 3, 409: 7})
        async with database.session() as session:
            stored = (
                await session.execute(select(func.count()).select_from(HoldingLot))
            ).scalar_one()
        assert stored == 3
    finally:
        await world.alice.client.aclose()
        await world.bob.client.aclose()


async def test_one_person_hitting_the_cap_does_not_block_another(database: Database) -> None:
    world = await make_world(database, portfolio_max_lots=2, writes_per_minute=1000)
    try:
        body = {"symbol": "AAPL", "shares": "1", "unit_cost": "1"}
        results = await asyncio.gather(
            *(world.alice.send("POST", LOTS, json=body) for _ in range(6)),
            *(world.bob.send("POST", LOTS, json=body) for _ in range(6)),
        )
        alice, bob = results[:6], results[6:]

        assert Counter(r.status_code for r in alice) == Counter({201: 2, 409: 4})
        assert Counter(r.status_code for r in bob) == Counter({201: 2, 409: 4})
    finally:
        await world.alice.client.aclose()
        await world.bob.client.aclose()


async def test_ten_simultaneous_submits_with_one_key_make_exactly_one_purchase(
    database: Database, monkeypatch: pytest.MonkeyPatch
) -> None:
    # A double click, a flaky network retrying, a user mashing the button: all at once. The pause
    # after each lookup widens the check-then-insert window so every request really is inside it.
    real = LotRepository.by_client_key

    async def slow_lookup(self: LotRepository, user_id: uuid.UUID, key: str) -> Lot | None:
        found = await real(self, user_id, key)
        await asyncio.sleep(0.05)
        return found

    monkeypatch.setattr(LotRepository, "by_client_key", slow_lookup)
    world = await make_world(database, writes_per_minute=1000)
    try:
        body = {"symbol": "AAPL", "shares": "5", "unit_cost": "100"}
        headers = {"Idempotency-Key": "double-click-key"}
        responses = await asyncio.gather(
            *(world.alice.send("POST", LOTS, json=body, headers=headers) for _ in range(10))
        )

        assert Counter(r.status_code for r in responses) == Counter({201: 1, 200: 9})
        assert len({r.json()["id"] for r in responses}) == 1
        async with database.session() as session:
            stored = (
                await session.execute(select(func.count()).select_from(HoldingLot))
            ).scalar_one()
        assert stored == 1
    finally:
        await world.alice.client.aclose()
        await world.bob.client.aclose()


async def test_simultaneous_adds_of_the_same_company_make_one_item(database: Database) -> None:
    world = await make_world(database, writes_per_minute=1000)
    try:
        responses = await asyncio.gather(
            *(world.alice.send("PUT", "/api/v1/watchlist/AAPL") for _ in range(10))
        )

        assert Counter(r.status_code for r in responses) == Counter({201: 1, 200: 9})
        assert len((await world.alice.get("/api/v1/watchlist")).json()["items"]) == 1
    finally:
        await world.alice.client.aclose()
        await world.bob.client.aclose()


async def test_a_purchase_deleted_while_being_edited_is_a_clean_404_not_a_crash(
    database: Database,
) -> None:
    world = await make_world(database, writes_per_minute=1000)
    try:
        created = (
            await world.alice.send(
                "POST", LOTS, json={"symbol": "AAPL", "shares": "5", "unit_cost": "100"}
            )
        ).json()
        change = {"shares": "9", "unit_cost": "9"}

        results = await asyncio.gather(
            world.alice.send("DELETE", f"{LOTS}/{created['id']}"),
            world.alice.send("PUT", f"{LOTS}/{created['id']}", json=change),
            world.alice.send("PUT", f"{LOTS}/{created['id']}", json=change),
        )

        assert {r.status_code for r in results} <= {200, 204, 404}  # never a 500
        # Whatever the order, the delete ran and nothing can bring the purchase back.
        assert (await world.alice.get(LOTS)).json() == {"lots": []}
    finally:
        await world.alice.client.aclose()
        await world.bob.client.aclose()
