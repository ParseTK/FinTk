"""Valuing holdings: exact arithmetic, the batched price reads, the bounded refresh, and the API."""

import asyncio
from collections.abc import AsyncIterator
from datetime import UTC, date, datetime
from decimal import Decimal

import pytest

from app.core.errors import UpstreamError
from app.db.engine import Database
from app.domain.models import LatestClose, MonthlyPrice, PriceHistory
from app.domain.months import last_complete_month_end
from app.domain.portfolio import LotTotals, value_holding, value_portfolio
from app.repositories.prices import PriceRepository
from app.services.prices import StoredPriceProvider
from tests.helpers import Person, World, company_service, make_world

PORTFOLIO = "/api/v1/portfolio"


def totals(symbol: str, shares: str, cost: str, lots: int = 1) -> LotTotals:
    return LotTotals(symbol=symbol, shares=Decimal(shares), cost=Decimal(cost), lots=lots)


def close(symbol: str, price: str, month_end: date = date(2026, 10, 31)) -> LatestClose:
    return LatestClose(symbol, month_end, Decimal(price), "Fake Data")


# -- arithmetic ------------------------------------------------------------------------------------


def test_a_holdings_worth_and_gain_are_exact() -> None:
    valuation = value_holding(totals("AAPL", "10", "1000"), close("AAPL", "120.5"))
    assert valuation.market_value == Decimal("1205.00")
    assert valuation.gain == Decimal("205.00")
    assert valuation.gain_percent == Decimal("20.50")
    assert valuation.as_of == date(2026, 10, 31)


def test_a_loss_is_negative() -> None:
    valuation = value_holding(totals("AAPL", "10", "1000"), close("AAPL", "80"))
    assert valuation.gain == Decimal("-200.00")
    assert valuation.gain_percent == Decimal("-20.00")


def test_rounding_happens_once_at_the_end() -> None:
    # 3 shares bought at 1.115 (cost 3.345) now worth 1.115: no gain, whatever the rounding.
    valuation = value_holding(totals("X", "3", "3.345"), close("X", "1.115"))
    assert valuation.gain == Decimal("0.00")
    assert valuation.gain_percent == Decimal("0.00")
    assert valuation.market_value == Decimal("3.34")  # 3.345 to cents, half to even


def test_portfolio_totals_cover_only_the_holdings_that_have_a_price() -> None:
    result = value_portfolio(
        [totals("AAPL", "10", "1000"), totals("MSFT", "5", "500")],
        {"AAPL": close("AAPL", "120")},  # MSFT has no price
    )
    assert result is not None
    assert result.market_value == Decimal("1200.00")
    assert result.gain == Decimal("200.00")  # not 200 - 500: the unpriced cost is left out too
    assert result.gain_percent == Decimal("20.00")
    assert result.holdings_valued == 1


def test_the_portfolio_is_only_as_fresh_as_its_oldest_price() -> None:
    result = value_portfolio(
        [totals("A", "1", "10"), totals("B", "1", "10")],
        {"A": close("A", "11", date(2026, 10, 31)), "B": close("B", "9", date(2026, 8, 31))},
    )
    assert result is not None
    assert result.as_of == date(2026, 8, 31)
    assert result.gain == Decimal("0.00")


def test_no_prices_means_no_valuation_rather_than_zero() -> None:
    assert value_portfolio([totals("AAPL", "10", "1000")], {}) is None
    assert value_portfolio([], {"AAPL": close("AAPL", "1")}) is None


# -- batched reads ---------------------------------------------------------------------------------


def month(year: int, number: int, price: str) -> MonthlyPrice:
    return MonthlyPrice(month_end=date(year, number, 28), close=Decimal(price))


async def test_the_newest_close_of_each_symbol_comes_back_in_one_query(database: Database) -> None:
    async with database.session() as session:
        repo = PriceRepository(session)
        await repo.save("AAPL", "Fake Data", [month(2026, 1, "1"), month(2026, 3, "3")])
        await repo.save("MSFT", "Other", [month(2025, 12, "7")])
        await repo.save("EMPTY", "Fake Data", [])
    async with database.session() as session:
        repo = PriceRepository(session)
        latest = await repo.latest_closes(["AAPL", "MSFT", "EMPTY", "NOPE"])
        infos = await repo.infos(["AAPL", "EMPTY", "NOPE"])

    assert {k: (v.close, v.source) for k, v in latest.items()} == {
        "AAPL": (Decimal("3.000000"), "Fake Data"),
        "MSFT": (Decimal("7.000000"), "Other"),
    }
    assert latest["AAPL"].month_end == date(2026, 3, 28)
    assert infos["AAPL"].latest_month == date(2026, 3, 28)
    assert infos["EMPTY"].latest_month is None
    assert "NOPE" not in infos


async def test_asking_for_nothing_costs_nothing(database: Database) -> None:
    async with database.session() as session:
        repo = PriceRepository(session)
        assert await repo.latest_closes([]) == {}
        assert await repo.infos([]) == {}


# -- the stored provider's latest_closes -------------------------------------------------------


class Clock:
    def __call__(self) -> datetime:
        return datetime.now(UTC)


class Upstream:
    """Two completed months per symbol: 100, then ``latest`` (default 125.50)."""

    source = "Fake Data"

    def __init__(self) -> None:
        self.calls: list[str] = []
        self.failing: set[str] = set()
        self.nothing_for: set[str] = set()
        self.delay = 0.0
        self.latest = Decimal("125.50")

    async def monthly_history(self, symbol: str, *, since: date | None = None) -> PriceHistory:
        self.calls.append(symbol)
        if self.delay:
            await asyncio.sleep(self.delay)
        if symbol in self.failing:
            raise UpstreamError("down")
        if symbol in self.nothing_for:
            return PriceHistory(symbol, self.source, ())
        end = last_complete_month_end(datetime.now(UTC).date())
        before = date(end.year - (end.month == 1), 12 if end.month == 1 else end.month - 1, 28)
        return PriceHistory(
            symbol,
            self.source,
            (
                MonthlyPrice(month_end=before, close=Decimal(100)),
                MonthlyPrice(month_end=end, close=self.latest),
            ),
        )


@pytest.fixture
def upstream() -> Upstream:
    return Upstream()


@pytest.fixture
def stored(database: Database, upstream: Upstream) -> StoredPriceProvider:
    return StoredPriceProvider(upstream, database, now=Clock())


async def test_unseen_symbols_are_fetched_once_and_then_served_from_storage(
    stored: StoredPriceProvider, upstream: Upstream
) -> None:
    first = await stored.latest_closes(["aapl", "AAPL", "msft"])
    again = await stored.latest_closes(["AAPL", "MSFT"])

    assert sorted(first) == ["AAPL", "MSFT"]
    assert first == again
    assert first["AAPL"].close == Decimal("125.500000")
    assert sorted(upstream.calls) == ["AAPL", "MSFT"]  # duplicates collapsed, nothing asked twice


async def test_a_page_view_refreshes_at_most_a_few_symbols(
    stored: StoredPriceProvider, upstream: Upstream
) -> None:
    result = await stored.latest_closes(["A", "B", "C", "D", "E"], max_refresh=3)
    assert sorted(upstream.calls) == ["A", "B", "C"]
    assert sorted(result) == ["A", "B", "C"]
    await stored.latest_closes(["A", "B", "C", "D", "E"], max_refresh=3)
    assert sorted(upstream.calls) == ["A", "B", "C", "D", "E"]  # the rest follow on the next view


async def test_a_failing_provider_leaves_the_symbol_out_instead_of_failing(
    stored: StoredPriceProvider, upstream: Upstream
) -> None:
    upstream.failing = {"BAD"}
    result = await stored.latest_closes(["AAPL", "BAD"])
    assert sorted(result) == ["AAPL"]


async def test_a_symbol_the_provider_lacks_is_simply_absent(
    stored: StoredPriceProvider, upstream: Upstream
) -> None:
    upstream.nothing_for = {"ZZZZ"}
    assert sorted(await stored.latest_closes(["AAPL", "ZZZZ"])) == ["AAPL"]


async def test_a_slow_provider_cannot_hold_the_request_beyond_the_budget(
    stored: StoredPriceProvider, upstream: Upstream
) -> None:
    upstream.delay = 0.4
    started = asyncio.get_running_loop().time()
    result = await stored.latest_closes(["AAPL"], refresh_timeout=0.05)
    waited = asyncio.get_running_loop().time() - started

    assert result == {}
    assert waited < 0.3
    await asyncio.sleep(0.6)  # the refresh was not cancelled: it finishes for the next caller
    assert sorted(await stored.latest_closes(["AAPL"])) == ["AAPL"]
    assert upstream.calls == ["AAPL"]


async def test_without_a_database_there_is_nothing_to_value_with(upstream: Upstream) -> None:
    assert await StoredPriceProvider(upstream, None).latest_closes(["AAPL"]) == {}
    assert upstream.calls == []


# -- the portfolio API -----------------------------------------------------------------------------


@pytest.fixture
async def world(database: Database, upstream: Upstream) -> AsyncIterator[World]:
    provider = StoredPriceProvider(upstream, database, now=Clock())
    w = await make_world(database, companies=company_service(provider, provider))
    yield w
    await w.alice.client.aclose()
    await w.bob.client.aclose()


async def buy(person: Person, symbol: str, shares: str, unit_cost: str) -> None:
    response = await person.send(
        "POST",
        f"{PORTFOLIO}/lots",
        json={"symbol": symbol, "shares": shares, "unit_cost": unit_cost},
    )
    assert response.status_code == 201, response.text


async def test_holdings_carry_their_worth_and_the_portfolio_its_totals(world: World) -> None:
    await buy(world.alice, "AAPL", "10", "100")

    body = (await world.alice.get(PORTFOLIO)).json()

    (holding,) = body["holdings"]
    assert holding["valuation"]["price"] == "125.500000"
    assert holding["valuation"]["market_value"] == "1255.00"
    assert holding["valuation"]["gain"] == "255.00"
    assert holding["valuation"]["gain_percent"] == "25.50"
    assert body["valuation"]["market_value"] == "1255.00"
    assert body["valuation"]["holdings_valued"] == 1
    assert body["valuation"]["source"] == "Fake Data"
    assert body["total_cost_basis"] == "1000.00"  # the cost figures are unchanged
    assert all(
        isinstance(body["valuation"][k], str) for k in ("market_value", "gain", "gain_percent")
    )


async def test_a_holding_without_a_price_has_no_valuation_and_is_not_in_the_totals(
    world: World, upstream: Upstream
) -> None:
    upstream.nothing_for = {"MSFT"}
    await buy(world.alice, "AAPL", "10", "100")
    await buy(world.alice, "MSFT", "5", "300")

    body = (await world.alice.get(PORTFOLIO)).json()

    by_symbol = {h["symbol"]: h for h in body["holdings"]}
    assert by_symbol["MSFT"]["valuation"] is None
    assert by_symbol["AAPL"]["valuation"] is not None
    assert body["valuation"]["holdings_valued"] == 1
    assert body["valuation"]["market_value"] == "1255.00"
    assert body["total_cost_basis"] == "2500.00"


async def test_a_price_provider_failure_never_breaks_the_portfolio(
    world: World, upstream: Upstream
) -> None:
    upstream.failing = {"AAPL"}
    await buy(world.alice, "AAPL", "10", "100")

    response = await world.alice.get(PORTFOLIO)

    assert response.status_code == 200
    body = response.json()
    assert body["valuation"] is None
    assert body["holdings"][0]["valuation"] is None
    assert body["total_cost_basis"] == "1000.00"


async def test_one_persons_holdings_never_value_another_persons_portfolio(world: World) -> None:
    await buy(world.alice, "AAPL", "10", "100")
    assert (await world.alice.get(PORTFOLIO)).json()["valuation"] is not None

    body = (await world.bob.get(PORTFOLIO)).json()

    assert body["holdings"] == []
    assert body["valuation"] is None
