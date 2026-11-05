"""The crypto markets view: change since fixed days, from two cheap anchor prices."""

import asyncio
from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.core.errors import UpstreamError
from app.services.crypto import (
    ANCHOR_STALE,
    ANCHOR_TTL,
    MAJORS,
    PAST_YEAR_DAYS,
    CryptoService,
)
from tests.test_crypto_service import Clock, FakeProvider

TODAY = date(2026, 11, 3)
YEAR_START = date(2026, 1, 1)
PAST_YEAR = TODAY - timedelta(days=PAST_YEAR_DAYS)  # 2025-11-10


def build(today: date = TODAY) -> tuple[CryptoService, FakeProvider, Clock]:
    provider, clock = FakeProvider(), Clock()
    return CryptoService(provider, clock=clock, today=lambda: today), provider, clock


async def test_measures_change_since_the_start_of_the_year_and_about_a_year_ago() -> None:
    service, provider, _ = build()
    provider.anchor_by_day = {
        YEAR_START: {1001: Decimal("0.5"), 1002: Decimal(4)},
        PAST_YEAR: {1001: Decimal("0.25"), 1002: Decimal(1)},
    }
    markets = await service.markets()
    first, second, third = markets.majors
    # coin 1 is worth 1 now and coin 2 is worth 2
    assert first.year_to_date == Decimal("100.00")  # 0.5 -> 1
    assert first.past_year == Decimal("300.00")  # 0.25 -> 1
    assert second.year_to_date == Decimal("-50.00")  # 4 -> 2
    assert second.past_year == Decimal("100.00")  # 1 -> 2
    # the 30 and 90 day changes are the listing's own, passed through untouched
    assert (first.asset.change_30d, first.asset.change_90d) == (Decimal("3.5"), Decimal("-7.25"))
    assert third.year_to_date is None  # no price for it on either day: not guessed, never zero
    assert markets.year_start == YEAR_START
    assert markets.past_year_start == PAST_YEAR
    assert markets.unavailable == ()


async def test_asks_for_exactly_two_days_and_only_the_largest_coins() -> None:
    service, provider, _ = build()
    provider.rows = MAJORS + 5
    markets = await service.markets()
    assert len(markets.majors) == MAJORS
    assert sorted(provider.anchor_days) == [PAST_YEAR, YEAR_START]
    expected = tuple(1000 + rank for rank in range(1, MAJORS + 1))
    assert all(ids == expected for ids in provider.anchor_ids)


def test_the_past_year_day_stays_inside_the_plans_twelve_months() -> None:
    assert PAST_YEAR_DAYS < 365
    assert (TODAY - PAST_YEAR).days == PAST_YEAR_DAYS


async def test_the_year_start_follows_the_calendar_year() -> None:
    service, provider, _ = build(date(2027, 2, 10))
    markets = await service.markets()
    assert markets.year_start == date(2027, 1, 1)
    assert markets.past_year_start == date(2026, 2, 17)
    assert date(2027, 1, 1) in provider.anchor_days


async def test_the_two_days_are_fetched_once_and_kept_for_twelve_hours() -> None:
    service, provider, clock = build()
    await service.markets()
    await service.markets()
    assert provider.calls["anchor"] == 2
    clock.now += ANCHOR_TTL + 1
    await service.markets()
    assert provider.calls["anchor"] == 4


async def test_simultaneous_visitors_cost_one_call_per_day() -> None:
    service, provider, _ = build()
    await asyncio.gather(*(service.markets() for _ in range(15)))
    assert provider.calls["anchor"] == 2
    assert provider.calls["listings"] == 1


async def test_markets_and_the_overview_share_the_listing() -> None:
    service, provider, _ = build()
    await service.overview()
    await service.markets()
    assert provider.calls["listings"] == 1
    assert provider.calls["totals"] == 1


async def test_one_missing_day_is_named_and_the_rest_still_answers() -> None:
    service, provider, _ = build()
    provider.fail_days = {YEAR_START}
    markets = await service.markets()
    assert markets.unavailable == ("year-to-date change",)
    assert markets.year_start is None
    assert markets.past_year_start == PAST_YEAR
    assert all(coin.year_to_date is None for coin in markets.majors)
    assert all(coin.past_year is not None for coin in markets.majors)


async def test_both_days_missing_still_shows_the_coins_with_their_30_and_90_day_changes() -> None:
    service, provider, _ = build()
    provider.fail = {"anchor"}
    markets = await service.markets()
    assert markets.unavailable == ("year-to-date change", "past-year change")
    assert len(markets.majors) == 3
    assert markets.majors[0].asset.change_30d == Decimal("3.5")


async def test_missing_totals_mean_no_composition_and_are_named() -> None:
    service, provider, _ = build()
    provider.fail = {"totals"}
    markets = await service.markets()
    assert markets.composition is None
    assert markets.unavailable == ("market totals",)
    assert markets.majors


async def test_composition_is_worked_out_when_the_totals_are_there() -> None:
    service, _, _ = build()
    markets = await service.markets()
    assert markets.composition is not None
    assert [row.key for row in markets.composition.rows] == [
        "bitcoin",
        "ethereum",
        "other",
        "stablecoins",
        "defi",
    ]


async def test_without_the_listing_no_other_call_is_spent() -> None:
    service, provider, _ = build()
    provider.fail = {"listings"}
    with pytest.raises(UpstreamError):
        await service.markets()
    assert provider.calls["anchor"] == 0
    assert provider.calls["totals"] == 0


@pytest.mark.parametrize("anchor_price", ["0", "-5"])
async def test_a_zero_or_negative_old_price_gives_no_change(anchor_price: str) -> None:
    service, provider, _ = build()
    provider.anchor_prices_by_id = {1001: Decimal(anchor_price)}
    markets = await service.markets()
    assert markets.majors[0].year_to_date is None


async def test_an_old_anchor_is_served_briefly_when_a_refresh_fails() -> None:
    service, provider, clock = build()
    await service.markets()
    provider.fail = {"anchor"}
    clock.now += ANCHOR_TTL + 1
    markets = await service.markets()
    assert markets.unavailable == ()  # the old copy answered
    clock.now += ANCHOR_STALE + 1
    markets = await service.markets()
    assert markets.unavailable == ("year-to-date change", "past-year change")
