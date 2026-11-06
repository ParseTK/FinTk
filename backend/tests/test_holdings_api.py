"""The crypto watchlist and portfolio API, against a real Postgres and a fake price provider."""

import asyncio
from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest

from app.api.internal_deps import INTERNAL_TOKEN_HEADER
from app.db.engine import Database
from app.services import holdings as holdings_service
from app.services.crypto import CryptoService
from tests.helpers import Person, World, make_world
from tests.test_crypto_service import FakeProvider

WATCH = "/api/v1/watchlist"
PORTFOLIO = "/api/v1/portfolio"
TOKEN = "t" * 40  # plainly not a real secret
INTERNAL = {INTERNAL_TOKEN_HEADER: TOKEN}


def crypto(rows: int = 3, **fail: Any) -> tuple[CryptoService, FakeProvider]:
    provider = FakeProvider()
    provider.rows = rows
    provider.fail = set(fail)
    return CryptoService(provider), provider


@pytest.fixture
async def world(database: Database) -> AsyncIterator[World]:
    service, _ = crypto()
    w = await make_world(database, crypto=service, internal_api_token=TOKEN)
    yield w
    await w.alice.client.aclose()
    await w.bob.client.aclose()


async def get(person: Person, path: str, *, internal: bool = True) -> Any:
    return await person.get(path, headers=INTERNAL if internal else {})


# -- signed-in, CSRF-protected, internal-only reads ------------------------------------------------


@pytest.mark.parametrize("path", [WATCH, PORTFOLIO])
async def test_reads_need_a_session_and_the_internal_token(world: World, path: str) -> None:
    anonymous = httpx.AsyncClient(
        transport=httpx.ASGITransport(app=world.app, raise_app_exceptions=False),
        base_url="http://localhost:3000",
    )  # the same app, with no session cookie
    try:
        assert (await anonymous.get(path, headers=INTERNAL)).status_code == 401
    finally:
        await anonymous.aclose()
    # Signed in but not our website: the prices are licensed for our own pages only.
    assert (await get(world.alice, path, internal=False)).status_code == 403
    assert (await get(world.alice, path)).status_code == 200


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("PUT", f"{WATCH}/example-1", None),
        ("DELETE", f"{WATCH}/example-1", None),
        ("PUT", f"{PORTFOLIO}/example-1", {"amount": "1"}),
        ("DELETE", f"{PORTFOLIO}/example-1", None),
    ],
)
async def test_writes_need_csrf_and_a_known_origin(
    world: World, method: str, path: str, body: Any
) -> None:
    kwargs: dict[str, Any] = {} if body is None else {"json": body}
    no_token = await world.alice.send(method, path, csrf=False, **kwargs)
    no_origin = await world.alice.send(method, path, origin=False, **kwargs)
    assert no_token.status_code == 403
    assert no_origin.status_code == 403
    assert no_token.json()["error"]["code"] == "csrf_failed"


async def test_writes_do_not_need_the_internal_token_and_return_no_prices(world: World) -> None:
    watched = await world.alice.send("PUT", f"{WATCH}/example-1")
    held = await world.alice.send(
        "PUT", f"{PORTFOLIO}/example-1", json={"amount": "2", "cost": "5"}
    )
    assert watched.status_code == 201
    assert set(watched.json()) == {"slug", "added_at"}
    assert held.status_code == 201
    assert set(held.json()) == {"slug", "amount", "cost", "updated_at"}  # nothing from the provider


async def test_reads_are_never_stored_by_a_shared_cache(world: World) -> None:
    assert (await get(world.alice, WATCH)).headers["cache-control"] == "no-store"
    assert (await get(world.alice, PORTFOLIO)).headers["cache-control"] == "no-store"


# -- watchlist -------------------------------------------------------------------------------------


async def test_watching_is_safe_to_repeat_and_the_list_shows_prices(world: World) -> None:
    assert (await world.alice.send("PUT", f"{WATCH}/example-2")).status_code == 201
    assert (await world.alice.send("PUT", f"{WATCH}/example-2")).status_code == 200
    body = (await get(world.alice, WATCH)).json()
    assert body["prices_available"] is True
    assert body["attribution"]["text"] == "Data provided by CoinMarketCap.com"
    assert [item["slug"] for item in body["items"]] == ["example-2"]
    coin = body["items"][0]["coin"]
    assert (coin["name"], coin["symbol"], coin["price"]) == ("Example 2", "E2", "2")


async def test_unwatching_is_safe_to_repeat(world: World) -> None:
    await world.alice.send("PUT", f"{WATCH}/example-1")
    assert (await world.alice.send("DELETE", f"{WATCH}/example-1")).status_code == 204
    assert (await world.alice.send("DELETE", f"{WATCH}/example-1")).status_code == 204
    assert (await get(world.alice, WATCH)).json()["items"] == []


async def test_a_coin_the_site_does_not_cover_cannot_be_saved(world: World) -> None:
    for path in (f"{WATCH}/no-such-coin", f"{PORTFOLIO}/no-such-coin"):
        response = await world.alice.send("PUT", path, json={"amount": "1"})
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "not_found"


async def test_a_malformed_name_is_refused(world: World) -> None:
    for bad in ("UPPER", "-x", "a" * 81, "has space"):
        assert (await world.alice.send("PUT", f"{WATCH}/{bad}")).status_code in {404, 422}


async def test_the_watchlist_is_full_at_the_cap_but_repeating_an_entry_still_works(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(holdings_service, "MAX_WATCHED", 2)
    await world.alice.send("PUT", f"{WATCH}/example-1")
    await world.alice.send("PUT", f"{WATCH}/example-2")
    full = await world.alice.send("PUT", f"{WATCH}/example-3")
    assert full.status_code == 409
    assert full.json()["error"]["code"] == "limit_reached"
    assert (await world.alice.send("PUT", f"{WATCH}/example-1")).status_code == 200


async def test_the_cap_holds_when_requests_arrive_together(
    database: Database, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(holdings_service, "MAX_WATCHED", 3)
    service, _ = crypto(rows=10)
    w = await make_world(database, crypto=service, writes_per_minute=1000)
    try:
        results = await asyncio.gather(
            *(w.alice.send("PUT", f"{WATCH}/example-{n}") for n in range(1, 9))
        )
        assert sorted(r.status_code for r in results).count(201) == 3
        assert all(r.status_code in {201, 409} for r in results)
    finally:
        await w.alice.client.aclose()
        await w.bob.client.aclose()


# -- one person cannot see or change another's ---------------------------------------------------


async def test_people_only_ever_see_their_own_rows(world: World) -> None:
    await world.alice.send("PUT", f"{WATCH}/example-1")
    await world.alice.send("PUT", f"{PORTFOLIO}/example-1", json={"amount": "9"})
    assert (await get(world.bob, WATCH)).json()["items"] == []
    assert (await get(world.bob, PORTFOLIO)).json()["holdings"] == []


async def test_removing_someone_elses_row_changes_nothing(world: World) -> None:
    await world.alice.send("PUT", f"{WATCH}/example-1")
    await world.alice.send("PUT", f"{PORTFOLIO}/example-1", json={"amount": "9"})
    await world.bob.send("DELETE", f"{WATCH}/example-1")
    await world.bob.send("DELETE", f"{PORTFOLIO}/example-1")
    assert len((await get(world.alice, WATCH)).json()["items"]) == 1
    assert len((await get(world.alice, PORTFOLIO)).json()["holdings"]) == 1


async def test_the_same_coin_can_be_held_by_two_people_independently(world: World) -> None:
    await world.alice.send("PUT", f"{PORTFOLIO}/example-1", json={"amount": "1"})
    await world.bob.send("PUT", f"{PORTFOLIO}/example-1", json={"amount": "7"})
    alice = (await get(world.alice, PORTFOLIO)).json()["holdings"]
    bob = (await get(world.bob, PORTFOLIO)).json()["holdings"]
    assert (alice[0]["amount"], bob[0]["amount"]) == ("1", "7")


# -- the portfolio ---------------------------------------------------------------------------------


async def test_a_holding_is_valued_with_exact_money_as_strings(world: World) -> None:
    await world.alice.send("PUT", f"{PORTFOLIO}/example-2", json={"amount": "3", "cost": "4"})
    body = (await get(world.alice, PORTFOLIO)).json()
    row = body["holdings"][0]
    assert row["amount"] == "3"
    assert row["cost"] == "4.00"
    assert row["value"] == "6.00"  # 3 coins at $2
    assert row["gain"] == "2.00"
    assert row["gain_percent"] == "50.00"
    assert all(isinstance(row[key], str) for key in ("amount", "cost", "value", "gain"))
    assert body["totals"]["total_value"] == "6.00"
    assert body["totals"]["gain"] == "2.00"


async def test_recording_again_replaces_the_earlier_entry(world: World) -> None:
    first = await world.alice.send(
        "PUT", f"{PORTFOLIO}/example-2", json={"amount": "3", "cost": "4"}
    )
    again = await world.alice.send("PUT", f"{PORTFOLIO}/example-2", json={"amount": "5"})
    assert (first.status_code, again.status_code) == (201, 200)
    rows = (await get(world.alice, PORTFOLIO)).json()["holdings"]
    assert len(rows) == 1
    assert rows[0]["amount"] == "5"
    assert rows[0]["cost"] is None  # replaced, not merged: the cost was left out this time
    assert rows[0]["gain"] is None


async def test_a_holding_without_a_cost_has_a_value_and_no_gain(world: World) -> None:
    await world.alice.send("PUT", f"{PORTFOLIO}/example-3", json={"amount": "1.5"})
    body = (await get(world.alice, PORTFOLIO)).json()
    assert body["holdings"][0]["value"] == "4.50"
    assert body["holdings"][0]["gain"] is None
    assert body["totals"]["gain"] is None
    assert body["totals"]["total_value"] == "4.50"


async def test_removing_a_holding(world: World) -> None:
    await world.alice.send("PUT", f"{PORTFOLIO}/example-1", json={"amount": "1"})
    assert (await world.alice.send("DELETE", f"{PORTFOLIO}/example-1")).status_code == 204
    assert (await get(world.alice, PORTFOLIO)).json()["holdings"] == []
    assert (await world.alice.send("DELETE", f"{PORTFOLIO}/example-1")).status_code == 204


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"amount": "0"},
        {"amount": "0.000"},
        {"amount": "-1"},
        {"amount": 1.5},
        {"amount": 1},
        {"amount": "1e5"},
        {"amount": "abc"},
        {"amount": ""},
        {"amount": " 1"},
        {"amount": "1.1234567890123456789"},  # 19 decimals
        {"amount": "1234567890123"},  # 13 digits before the point
        {"amount": "1", "cost": "-1"},
        {"amount": "1", "cost": "1.234"},
        {"amount": "1", "cost": 5},
        {"amount": "1", "cost": "NaN"},
        {"amount": "1", "extra": "x"},
        # Digits from other scripts are not numbers we accept, even though Decimal could read them.
        {"amount": "\u0661\u0662\u0663"},  # Arabic-Indic 123
        {"amount": "1.\u0665"},
        {"amount": "\uff11\uff12"},  # fullwidth 12
        {"amount": "1", "cost": "\u0661\u0660\u0660"},
    ],
)
async def test_bad_input_is_refused_before_anything_is_saved(world: World, body: Any) -> None:
    response = await world.alice.send("PUT", f"{PORTFOLIO}/example-1", json=body)
    assert response.status_code == 422
    assert (await get(world.alice, PORTFOLIO)).json()["holdings"] == []


@pytest.mark.parametrize(
    ("amount", "cost"),
    [
        ("0.000000000000000001", None),
        ("999999999999.999999999999999999", "9999999999999999.99"),
        ("1", "0"),
    ],
)
async def test_the_edges_of_the_allowed_range_are_accepted(
    world: World, amount: str, cost: str | None
) -> None:
    body: dict[str, str] = {"amount": amount}
    if cost is not None:
        body["cost"] = cost
    response = await world.alice.send("PUT", f"{PORTFOLIO}/example-1", json=body)
    assert response.status_code == 201, response.text


async def test_the_portfolio_is_full_at_the_cap(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(holdings_service, "MAX_HOLDINGS", 1)
    await world.alice.send("PUT", f"{PORTFOLIO}/example-1", json={"amount": "1"})
    full = await world.alice.send("PUT", f"{PORTFOLIO}/example-2", json={"amount": "1"})
    assert full.status_code == 409
    # Changing a coin already held is not adding one, so it is still allowed at the cap.
    assert (
        await world.alice.send("PUT", f"{PORTFOLIO}/example-1", json={"amount": "2"})
    ).status_code == 200


# -- when prices cannot be had ---------------------------------------------------------------------


async def test_reads_still_list_what_the_person_saved_when_prices_are_down(
    database: Database,
) -> None:
    service, provider = crypto()
    w = await make_world(database, crypto=service, internal_api_token=TOKEN)
    try:
        await w.alice.send("PUT", f"{WATCH}/example-1")
        await w.alice.send("PUT", f"{PORTFOLIO}/example-2", json={"amount": "3", "cost": "4"})
        provider.fail = {"listings"}
        # A fresh service has nothing cached, so the failure is real.
        w.app.state.crypto_service = CryptoService(provider)
        watch = (await get(w.alice, WATCH)).json()
        folio = (await get(w.alice, PORTFOLIO)).json()
        assert watch["prices_available"] is False
        assert watch["items"][0]["slug"] == "example-1"
        assert watch["items"][0]["coin"] is None
        assert folio["prices_available"] is False
        row = folio["holdings"][0]
        assert (row["amount"], row["cost"], row["value"], row["gain"]) == ("3", "4.00", None, None)
        assert folio["totals"]["unpriced"] == 1
        assert folio["totals"]["gain"] is None
    finally:
        await w.alice.client.aclose()
        await w.bob.client.aclose()


async def test_a_write_cannot_be_checked_without_prices_so_it_is_refused_cleanly(
    database: Database,
) -> None:
    service, provider = crypto()
    provider.fail = {"listings"}
    w = await make_world(database, crypto=service, internal_api_token=TOKEN)
    try:
        response = await w.alice.send("PUT", f"{WATCH}/example-1")
        assert response.status_code >= 500
        assert response.status_code != 500  # an upstream/unavailable error, not a crash
        assert (await get(w.alice, WATCH)).json()["items"] == []
    finally:
        await w.alice.client.aclose()
        await w.bob.client.aclose()


async def test_a_saved_coin_that_leaves_the_list_stays_but_is_not_priced(
    database: Database,
) -> None:
    service, provider = crypto(rows=3)
    w = await make_world(database, crypto=service, internal_api_token=TOKEN)
    try:
        await w.alice.send("PUT", f"{PORTFOLIO}/example-3", json={"amount": "2", "cost": "1"})
        provider.rows = 2  # example-3 drops out of the listing
        w.app.state.crypto_service = CryptoService(provider)
        row = (await get(w.alice, PORTFOLIO)).json()["holdings"][0]
        assert row["slug"] == "example-3"
        assert row["coin"] is None
        assert row["value"] is None
    finally:
        await w.alice.client.aclose()
        await w.bob.client.aclose()


# -- deleting an account ---------------------------------------------------------------------------


async def test_deleting_an_account_deletes_its_watchlist_and_holdings(
    world: World, database: Database
) -> None:
    from sqlalchemy import text

    await world.alice.send("PUT", f"{WATCH}/example-1")
    await world.alice.send("PUT", f"{PORTFOLIO}/example-1", json={"amount": "1"})
    assert (await world.alice.send("DELETE", "/api/v1/me")).status_code == 204
    async with database.session() as session:
        for table in ("crypto_watch", "crypto_holding"):
            count = await session.scalar(
                text(f"SELECT count(*) FROM {table} WHERE user_id = :u"),  # noqa: S608
                {"u": world.alice.user_id},
            )
            assert count == 0
