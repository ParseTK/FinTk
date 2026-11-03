from collections.abc import AsyncIterator

import pytest

from app.db.engine import Database
from tests.helpers import World, make_world

PATH = "/api/v1/watchlist"


@pytest.fixture
async def world(database: Database) -> AsyncIterator[World]:
    w = await make_world(database)
    yield w
    await w.alice.client.aclose()
    await w.bob.client.aclose()


async def test_an_empty_watchlist_is_an_empty_list(world: World) -> None:
    response = await world.alice.get(PATH)
    assert response.status_code == 200
    assert response.json() == {"items": []}


async def test_adding_a_company_creates_it_with_its_name(world: World) -> None:
    response = await world.alice.send("PUT", f"{PATH}/AAPL")

    assert response.status_code == 201
    body = response.json()
    assert body["symbol"] == "AAPL"
    assert body["name"] == "Apple Inc."
    assert body["added_at"]


async def test_adding_twice_is_safe_and_keeps_the_original_time(world: World) -> None:
    first = await world.alice.send("PUT", f"{PATH}/AAPL")
    second = await world.alice.send("PUT", f"{PATH}/AAPL")

    assert (first.status_code, second.status_code) == (201, 200)
    assert second.json()["added_at"] == first.json()["added_at"]
    assert len((await world.alice.get(PATH)).json()["items"]) == 1


async def test_the_list_is_sorted_and_carries_names(world: World) -> None:
    for symbol in ("MSFT", "AAPL", "KO"):
        await world.alice.send("PUT", f"{PATH}/{symbol}")

    items = (await world.alice.get(PATH)).json()["items"]

    assert [i["symbol"] for i in items] == ["AAPL", "KO", "MSFT"]
    assert items[0]["name"] == "Apple Inc."


@pytest.mark.parametrize("typed", ["aapl", "AAPL", " aapl"])
async def test_the_symbol_is_normalised(world: World, typed: str) -> None:
    response = await world.alice.send("PUT", f"{PATH}/{typed.strip()}")
    assert response.json()["symbol"] == "AAPL"


async def test_a_dot_in_a_share_class_is_accepted_and_stored_the_way_sec_writes_it(
    world: World,
) -> None:
    response = await world.alice.send("PUT", f"{PATH}/brk.b")
    assert response.status_code == 201
    assert response.json()["symbol"] == "BRK-B"


async def test_an_unknown_company_cannot_be_added(world: World) -> None:
    response = await world.alice.send("PUT", f"{PATH}/ZZZZ")
    assert response.status_code == 404
    assert (await world.alice.get(PATH)).json() == {"items": []}


@pytest.mark.parametrize("symbol", ["A1", "AAPL%3Bdrop", "WAYTOOLONGNAME", "AA..PL", "%20"])
async def test_a_malformed_symbol_is_refused(world: World, symbol: str) -> None:
    response = await world.alice.send("PUT", f"{PATH}/{symbol}")
    assert response.status_code in {404, 422}
    assert (await world.alice.get(PATH)).json() == {"items": []}


async def test_removing_works_and_removing_again_is_fine(world: World) -> None:
    await world.alice.send("PUT", f"{PATH}/AAPL")

    first = await world.alice.send("DELETE", f"{PATH}/AAPL")
    second = await world.alice.send("DELETE", f"{PATH}/AAPL")

    assert (first.status_code, second.status_code) == (204, 204)
    assert (await world.alice.get(PATH)).json() == {"items": []}


async def test_a_symbol_that_left_the_directory_can_still_be_removed(
    world: World, database: Database
) -> None:
    from sqlalchemy import text

    async with database.session() as session:  # a row for a ticker no longer in the directory
        await session.execute(
            text("INSERT INTO watchlist_item (user_id, symbol) VALUES (:u, 'GONE')"),
            {"u": world.alice.user_id},
        )
    assert (await world.alice.send("DELETE", f"{PATH}/GONE")).status_code == 204
    assert (await world.alice.get(PATH)).json() == {"items": []}


async def test_each_person_has_their_own_watchlist(world: World) -> None:
    await world.alice.send("PUT", f"{PATH}/AAPL")
    await world.bob.send("PUT", f"{PATH}/MSFT")

    alice = [i["symbol"] for i in (await world.alice.get(PATH)).json()["items"]]
    bob = [i["symbol"] for i in (await world.bob.get(PATH)).json()["items"]]
    assert (alice, bob) == (["AAPL"], ["MSFT"])

    await world.bob.send("DELETE", f"{PATH}/AAPL")  # removing "their" AAPL touches nothing of Alice
    assert [i["symbol"] for i in (await world.alice.get(PATH)).json()["items"]] == ["AAPL"]


async def test_the_list_has_a_hard_cap_and_a_repeat_at_the_cap_still_works(
    database: Database,
) -> None:
    world = await make_world(database, watchlist_max_items=2)
    try:
        assert (await world.alice.send("PUT", f"{PATH}/AAPL")).status_code == 201
        assert (await world.alice.send("PUT", f"{PATH}/MSFT")).status_code == 201

        full = await world.alice.send("PUT", f"{PATH}/KO")
        repeat = await world.alice.send("PUT", f"{PATH}/AAPL")

        assert full.status_code == 409
        assert full.json()["error"]["code"] == "limit_reached"
        assert repeat.status_code == 200  # already there: not a new item
        assert (await world.bob.send("PUT", f"{PATH}/KO")).status_code == 201  # per person
    finally:
        await world.alice.client.aclose()
        await world.bob.client.aclose()


async def test_names_are_skipped_not_fatal_when_company_data_is_not_configured(
    database: Database,
) -> None:
    from sqlalchemy import text

    from tests.helpers import build_app, sign_in_person

    app = build_app(database, with_companies=False)
    person = await sign_in_person(app, database, "nocompany@example.com")
    try:
        async with database.session() as session:
            await session.execute(
                text("INSERT INTO watchlist_item (user_id, symbol) VALUES (:u, 'AAPL')"),
                {"u": person.user_id},
            )
        listed = await person.get(PATH)
        assert listed.status_code == 200
        assert listed.json()["items"][0]["name"] is None
        # Adding needs the directory to validate the symbol, so it says so plainly.
        assert (await person.send("PUT", f"{PATH}/MSFT")).status_code == 503
        # Removing never needs it.
        assert (await person.send("DELETE", f"{PATH}/AAPL")).status_code == 204
    finally:
        await person.client.aclose()
