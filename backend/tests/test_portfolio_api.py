from collections.abc import AsyncIterator
from typing import Any

import pytest

from app.db.engine import Database
from tests.helpers import Person, World, make_world

LOTS = "/api/v1/portfolio/lots"
PORTFOLIO = "/api/v1/portfolio"


@pytest.fixture
async def world(database: Database) -> AsyncIterator[World]:
    w = await make_world(database)
    yield w
    await w.alice.client.aclose()
    await w.bob.client.aclose()


def lot(
    symbol: Any = "AAPL", shares: Any = "10", unit_cost: Any = "100.00", **extra: Any
) -> dict[str, Any]:
    return {"symbol": symbol, "shares": shares, "unit_cost": unit_cost, **extra}


async def add(person: Person, **kwargs: Any) -> dict[str, Any]:
    response = await person.send("POST", LOTS, json=lot(**kwargs))
    assert response.status_code == 201, response.text
    return response.json()


# -- recording a purchase ------------------------------------------------------------------------


async def test_recording_a_purchase_returns_it_with_exact_money_as_strings(world: World) -> None:
    created = await add(
        world.alice, symbol="aapl", shares="12.5", unit_cost="187.123456", acquired_on="2024-03-15"
    )

    assert created["symbol"] == "AAPL"
    assert created["shares"] == "12.500000"
    assert created["unit_cost"] == "187.123456"
    assert created["cost"] == "2339.04"  # 12.5 x 187.123456 = 2339.0432, to cents
    assert created["acquired_on"] == "2024-03-15"
    assert isinstance(created["shares"], str)
    assert created["id"]


async def test_purchases_are_listed_for_one_company_or_all(world: World) -> None:
    await add(world.alice, symbol="AAPL", shares="1")
    await add(world.alice, symbol="MSFT", shares="2")
    await add(world.alice, symbol="AAPL", shares="3")

    everything = (await world.alice.get(LOTS)).json()["lots"]
    apple = (await world.alice.get(LOTS, params={"symbol": "aapl"})).json()["lots"]

    assert len(everything) == 3
    assert [item["shares"] for item in apple] == ["1.000000", "3.000000"]
    assert (await world.alice.get(LOTS, params={"symbol": "../x"})).json() == {"lots": []}


# -- holdings: computed from purchases, in exact arithmetic -------------------------------------


async def test_average_cost_is_computed_from_the_purchases(world: World) -> None:
    await add(world.alice, symbol="AAPL", shares="10", unit_cost="100.00")
    await add(world.alice, symbol="AAPL", shares="5", unit_cost="130.00")

    body = (await world.alice.get(PORTFOLIO)).json()

    (holding,) = body["holdings"]
    assert holding["symbol"] == "AAPL"
    assert holding["name"] == "Apple Inc."
    assert holding["shares"] == "15.000000"
    assert holding["average_cost"] == "110.000000"  # (10x100 + 5x130) / 15
    assert holding["cost_basis"] == "1650.00"
    assert holding["lots"] == 2
    assert body["total_cost_basis"] == "1650.00"
    assert body["currency"] == "USD"


async def test_money_arithmetic_has_no_floating_point_drift(world: World) -> None:
    # 0.1 + 0.2 is 0.30000000000000004 as a float. Here it must be exactly 0.30.
    await add(world.alice, symbol="KO", shares="1", unit_cost="0.1")
    await add(world.alice, symbol="KO", shares="1", unit_cost="0.2")

    (holding,) = (await world.alice.get(PORTFOLIO)).json()["holdings"]

    assert holding["cost_basis"] == "0.30"
    assert holding["average_cost"] == "0.150000"
    assert holding["shares"] == "2.000000"


async def test_fractional_shares_and_uneven_costs_round_once_not_per_purchase(
    world: World,
) -> None:
    for _ in range(3):
        await add(world.alice, symbol="MSFT", shares="0.333333", unit_cost="3.333333")

    body = (await world.alice.get(PORTFOLIO)).json()

    (holding,) = body["holdings"]
    assert holding["shares"] == "0.999999"
    assert holding["average_cost"] == "3.333333"
    # 3 x (0.333333 x 3.333333) = 3.33333...; summed exactly, rounded to cents once.
    assert holding["cost_basis"] == body["total_cost_basis"] == "3.33"


async def test_the_total_is_summed_exactly_then_rounded_once(world: World) -> None:
    # Each holding costs 0.004 (rounds to 0.00 alone); three together are 0.012 (rounds to 0.01).
    for symbol in ("AAPL", "MSFT", "KO"):
        await add(world.alice, symbol=symbol, shares="0.004", unit_cost="1")

    body = (await world.alice.get(PORTFOLIO)).json()

    assert [h["cost_basis"] for h in body["holdings"]] == ["0.00", "0.00", "0.00"]
    assert body["total_cost_basis"] == "0.01"


async def test_holdings_are_sorted_and_empty_means_zero(world: World) -> None:
    assert (await world.alice.get(PORTFOLIO)).json() == {
        "holdings": [],
        "total_cost_basis": "0.00",
        "valuation": None,  # no prices held: cost figures only, never a guessed value
        "currency": "USD",
    }
    await add(world.alice, symbol="MSFT")
    await add(world.alice, symbol="AAPL")
    holdings = (await world.alice.get(PORTFOLIO)).json()["holdings"]
    assert [h["symbol"] for h in holdings] == ["AAPL", "MSFT"]


# -- strict input ---------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "field_value",
    [
        10.5,  # a JSON number: floats never carry money
        10,
        True,
        None,
        "",
        "0",
        "0.000000",
        "-1",
        "+5",
        "1e3",
        "0x10",
        "1,5",
        " 5",
        "5 ",
        "NaN",
        "Infinity",
        "1.1234567",  # seven decimals
        "123456789012345",  # fifteen digits before the point
        ["5"],
        {"a": 1},
    ],
)
async def test_shares_must_be_a_positive_decimal_string_that_fits(
    world: World, field_value: object
) -> None:
    response = await world.alice.send("POST", LOTS, json={**lot(), "shares": field_value})
    assert response.status_code == 422, field_value
    assert response.json()["error"]["code"] == "validation_error"
    assert (await world.alice.get(LOTS)).json() == {"lots": []}


@pytest.mark.parametrize(
    "value", [187.5, "0", "-3", "1e2", "1234567890123", "1.1234567", "abc", None]
)
async def test_unit_cost_follows_the_same_rules(world: World, value: object) -> None:
    response = await world.alice.send("POST", LOTS, json={**lot(), "unit_cost": value})
    assert response.status_code == 422, value


@pytest.mark.parametrize(
    "symbol", ["", "A1", "AAPL; DROP TABLE", "toolongsymbol", 5, None, "../etc"]
)
async def test_a_malformed_symbol_is_refused(world: World, symbol: object) -> None:
    response = await world.alice.send("POST", LOTS, json={**lot(), "symbol": symbol})
    assert response.status_code == 422


async def test_unknown_fields_are_refused_not_ignored(world: World) -> None:
    for extra in ({"user_id": "someone-else"}, {"id": "x"}, {"cost": "1"}, {"admin": True}):
        response = await world.alice.send("POST", LOTS, json=lot(**extra))
        assert response.status_code == 422, extra


async def test_an_unknown_company_cannot_be_recorded(world: World) -> None:
    response = await world.alice.send("POST", LOTS, json=lot(symbol="ZZZZ"))
    assert response.status_code == 404


@pytest.mark.parametrize(
    "acquired_on",
    ["2024-05-31T10:00:00", "2024-5-31", "yesterday", 1717000000, "31/05/2024", "2024-13-45"],
)
async def test_a_purchase_date_must_be_a_plain_iso_date(world: World, acquired_on: object) -> None:
    response = await world.alice.send("POST", LOTS, json=lot(acquired_on=acquired_on))
    assert response.status_code == 422, acquired_on


async def test_a_purchase_cannot_be_dated_in_the_future(world: World) -> None:
    response = await world.alice.send("POST", LOTS, json=lot(acquired_on="2999-01-01"))
    assert response.status_code == 400


async def test_the_date_is_optional(world: World) -> None:
    created = await add(world.alice)
    assert created["acquired_on"] is None


async def test_a_body_that_is_not_json_is_refused_cleanly(world: World) -> None:
    for content in (b"not json", b"[]", b'"text"', b""):
        response = await world.alice.send(
            "POST", LOTS, content=content, headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422


# -- idempotent creation -----------------------------------------------------------------------


async def test_repeating_a_request_with_the_same_key_returns_the_original(world: World) -> None:
    headers = {"Idempotency-Key": "form-submit-0001"}
    first = await world.alice.send("POST", LOTS, json=lot(), headers=headers)
    second = await world.alice.send("POST", LOTS, json=lot(), headers=headers)

    assert (first.status_code, second.status_code) == (201, 200)
    assert second.json()["id"] == first.json()["id"]
    assert len((await world.alice.get(LOTS)).json()["lots"]) == 1


async def test_reusing_a_key_for_a_different_purchase_is_a_conflict_not_an_overwrite(
    world: World,
) -> None:
    headers = {"Idempotency-Key": "form-submit-0002"}
    await world.alice.send("POST", LOTS, json=lot(shares="10"), headers=headers)

    response = await world.alice.send("POST", LOTS, json=lot(shares="99"), headers=headers)

    assert response.status_code == 409
    lots = (await world.alice.get(LOTS)).json()["lots"]
    assert [item["shares"] for item in lots] == ["10.000000"]


async def test_the_same_key_from_two_people_makes_two_purchases(world: World) -> None:
    headers = {"Idempotency-Key": "shared-looking-key"}
    a = await world.alice.send("POST", LOTS, json=lot(), headers=headers)
    b = await world.bob.send("POST", LOTS, json=lot(), headers=headers)

    assert (a.status_code, b.status_code) == (201, 201)
    assert a.json()["id"] != b.json()["id"]


@pytest.mark.parametrize("key", ["short", "has space in it", "x" * 65, "semi;colon-key"])
async def test_a_malformed_idempotency_key_is_refused(world: World, key: str) -> None:
    response = await world.alice.send("POST", LOTS, json=lot(), headers={"Idempotency-Key": key})
    assert response.status_code == 422


async def test_without_a_key_each_request_is_a_new_purchase(world: World) -> None:
    await add(world.alice)
    await add(world.alice)
    assert len((await world.alice.get(LOTS)).json()["lots"]) == 2


# -- changing and removing -----------------------------------------------------------------------


async def test_replacing_a_purchase_changes_the_holding(world: World) -> None:
    created = await add(world.alice, shares="10", unit_cost="100")

    response = await world.alice.send(
        "PUT",
        f"{LOTS}/{created['id']}",
        json={"shares": "20", "unit_cost": "50", "acquired_on": "2024-01-02"},
    )

    assert response.status_code == 200
    body = response.json()
    assert (body["shares"], body["unit_cost"], body["acquired_on"]) == (
        "20.000000",
        "50.000000",
        "2024-01-02",
    )
    assert body["symbol"] == "AAPL"  # the company cannot be changed: delete and add instead
    assert body["updated_at"] >= created["updated_at"]
    (holding,) = (await world.alice.get(PORTFOLIO)).json()["holdings"]
    assert holding["cost_basis"] == "1000.00"


async def test_replacing_cannot_change_the_company_or_the_owner(world: World) -> None:
    created = await add(world.alice)
    for extra in ({"symbol": "MSFT"}, {"user_id": str(world.bob.user_id)}, {"id": "x"}):
        response = await world.alice.send(
            "PUT", f"{LOTS}/{created['id']}", json={"shares": "1", "unit_cost": "1", **extra}
        )
        assert response.status_code == 422, extra


async def test_replacing_validates_like_creating(world: World) -> None:
    created = await add(world.alice)
    bad_bodies = (
        {"shares": 5.5, "unit_cost": "1"},
        {"shares": "0", "unit_cost": "1"},
        {"shares": "1"},
    )
    for bad in bad_bodies:
        response = await world.alice.send("PUT", f"{LOTS}/{created['id']}", json=bad)
        assert response.status_code == 422


async def test_deleting_a_purchase_removes_it_and_updates_the_holding(world: World) -> None:
    keep = await add(world.alice, shares="10", unit_cost="100")
    drop = await add(world.alice, shares="5", unit_cost="130")

    assert (await world.alice.send("DELETE", f"{LOTS}/{drop['id']}")).status_code == 204

    (holding,) = (await world.alice.get(PORTFOLIO)).json()["holdings"]
    assert (holding["shares"], holding["average_cost"]) == ("10.000000", "100.000000")
    remaining = (await world.alice.get(LOTS)).json()["lots"]
    assert [item["id"] for item in remaining] == [keep["id"]]


async def test_deleting_the_last_purchase_removes_the_holding(world: World) -> None:
    created = await add(world.alice)
    await world.alice.send("DELETE", f"{LOTS}/{created['id']}")
    assert (await world.alice.get(PORTFOLIO)).json()["holdings"] == []


async def test_deleting_twice_is_a_clean_404(world: World) -> None:
    created = await add(world.alice)
    assert (await world.alice.send("DELETE", f"{LOTS}/{created['id']}")).status_code == 204
    assert (await world.alice.send("DELETE", f"{LOTS}/{created['id']}")).status_code == 404


async def test_a_malformed_lot_id_is_a_validation_error(world: World) -> None:
    for bad in ("not-a-uuid", "1", "00000000-0000-0000-0000-00000000000g"):
        assert (await world.alice.send("DELETE", f"{LOTS}/{bad}")).status_code == 422


async def test_the_purchase_limit_applies_per_person(database: Database) -> None:
    world = await make_world(database, portfolio_max_lots=2)
    try:
        await add(world.alice)
        await add(world.alice)
        full = await world.alice.send("POST", LOTS, json=lot())

        assert full.status_code == 409
        assert full.json()["error"]["code"] == "limit_reached"
        assert (await world.bob.send("POST", LOTS, json=lot())).status_code == 201
        # Deleting frees a slot.
        first = (await world.alice.get(LOTS)).json()["lots"][0]["id"]
        await world.alice.send("DELETE", f"{LOTS}/{first}")
        assert (await world.alice.send("POST", LOTS, json=lot())).status_code == 201
    finally:
        await world.alice.client.aclose()
        await world.bob.client.aclose()


async def test_a_repeat_at_the_limit_is_still_answered_not_refused(database: Database) -> None:
    world = await make_world(database, portfolio_max_lots=1)
    try:
        headers = {"Idempotency-Key": "at-the-limit-key"}
        first = await world.alice.send("POST", LOTS, json=lot(), headers=headers)
        again = await world.alice.send("POST", LOTS, json=lot(), headers=headers)
        assert (first.status_code, again.status_code) == (201, 200)
    finally:
        await world.alice.client.aclose()
        await world.bob.client.aclose()
