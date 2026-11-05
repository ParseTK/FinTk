"""The crypto service: short in-memory caching, single flight, stale-on-error, partial failure."""

import asyncio
from collections.abc import Sequence
from datetime import UTC, date, datetime
from decimal import Decimal

import pytest

from app.core.errors import UnavailableError, UpstreamError
from app.domain.crypto import AnchorPrices, CryptoAsset, CryptoListings, FearGreed, MarketTotals
from app.services.crypto import (
    FEAR_GREED_TTL,
    LISTINGS_TTL,
    STALE,
    TOP_N,
    TOTALS_TTL,
    CryptoService,
)

NOW = datetime(2026, 11, 3, 21, 0, tzinfo=UTC)


def asset(rank: int) -> CryptoAsset:
    return CryptoAsset(
        rank=rank,
        name=f"Example {rank}",
        symbol=f"E{rank}",
        slug=f"example-{rank}",
        price=Decimal(rank),
        change_24h=None,
        change_7d=None,
        market_cap=None,
        volume_24h=None,
        cmc_id=1000 + rank,
        change_30d=Decimal("3.5"),
        change_90d=Decimal("-7.25"),
    )


class FakeProvider:
    source = "fake"

    def __init__(self) -> None:
        self.calls = {"listings": 0, "totals": 0, "fear": 0, "anchor": 0}
        self.anchor_days: list[date] = []
        self.anchor_ids: list[tuple[int, ...]] = []
        self.fail_days: set[date] = set()
        self.anchor_prices_by_id: dict[int, Decimal] | None = None
        self.anchor_by_day: dict[date, dict[int, Decimal]] = {}
        self.fail: set[str] = set()
        self.delay = 0.0
        self.rows = 3

    async def listings(self, limit: int) -> CryptoListings:
        self.calls["listings"] += 1
        await asyncio.sleep(self.delay)
        if "listings" in self.fail:
            raise UpstreamError("listings down")
        return CryptoListings(tuple(asset(i) for i in range(1, self.rows + 1)), NOW)

    async def market_totals(self) -> MarketTotals:
        self.calls["totals"] += 1
        if "totals" in self.fail:
            raise UpstreamError("totals down")
        return MarketTotals(Decimal(1), Decimal(2), Decimal(50), Decimal(18), NOW)

    async def anchor_prices(self, ids: Sequence[int], day: date) -> AnchorPrices:
        self.calls["anchor"] += 1
        self.anchor_days.append(day)
        self.anchor_ids.append(tuple(ids))
        if "anchor" in self.fail or day in self.fail_days:
            raise UpstreamError("anchor down")
        prices = (
            self.anchor_by_day.get(day)
            or self.anchor_prices_by_id
            or {coin: Decimal(1) for coin in ids}
        )
        return AnchorPrices(on=day, prices={coin: prices[coin] for coin in ids if coin in prices})

    async def fear_greed(self) -> FearGreed:
        self.calls["fear"] += 1
        if "fear" in self.fail:
            raise UnavailableError("budget spent")
        return FearGreed(61, "Greed", NOW)


class Clock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def build() -> tuple[CryptoService, FakeProvider, Clock]:
    provider, clock = FakeProvider(), Clock()
    return CryptoService(provider, clock=clock), provider, clock


async def test_returns_the_coins_and_both_summaries() -> None:
    service, _, _ = build()
    overview = await service.overview()
    assert [a.rank for a in overview.assets] == [1, 2, 3]
    assert overview.totals is not None
    assert overview.fear_greed is not None
    assert overview.unavailable == ()
    assert overview.as_of == NOW


async def test_a_second_look_is_served_from_memory() -> None:
    service, provider, _ = build()
    await service.overview()
    await service.overview()
    assert provider.calls == {"listings": 1, "totals": 1, "fear": 1, "anchor": 0}


async def test_many_simultaneous_visitors_cost_one_call_each() -> None:
    service, provider, _ = build()
    provider.delay = 0.05
    await asyncio.gather(*(service.overview() for _ in range(20)))
    assert provider.calls == {"listings": 1, "totals": 1, "fear": 1, "anchor": 0}


async def test_each_part_refreshes_on_its_own_schedule() -> None:
    service, provider, clock = build()
    await service.overview()
    clock.now += LISTINGS_TTL + 1  # listings and totals are due, fear and greed is not
    assert TOTALS_TTL == LISTINGS_TTL < FEAR_GREED_TTL
    await service.overview()
    assert provider.calls == {"listings": 2, "totals": 2, "fear": 1, "anchor": 0}
    clock.now += FEAR_GREED_TTL
    await service.overview()
    assert provider.calls["fear"] == 2


async def test_only_the_top_n_are_kept() -> None:
    service, provider, _ = build()
    provider.rows = TOP_N + 40
    assert len((await service.overview()).assets) == TOP_N


async def test_a_failed_summary_is_named_and_the_rest_still_answers() -> None:
    service, provider, _ = build()
    provider.fail = {"totals", "fear"}
    overview = await service.overview()
    assert overview.assets
    assert overview.totals is None
    assert overview.fear_greed is None
    assert overview.unavailable == ("market totals", "fear and greed")


async def test_without_the_listing_there_is_no_page_and_no_extra_calls_are_spent() -> None:
    service, provider, _ = build()
    provider.fail = {"listings"}
    with pytest.raises(UpstreamError):
        await service.overview()
    assert provider.calls == {"listings": 1, "totals": 0, "fear": 0, "anchor": 0}


async def test_a_failure_is_not_cached() -> None:
    service, provider, _ = build()
    provider.fail = {"listings"}
    with pytest.raises(UpstreamError):
        await service.overview()
    provider.fail = set()
    assert (await service.overview()).assets
    assert provider.calls["listings"] == 2


async def test_an_old_copy_is_served_briefly_when_a_refresh_fails() -> None:
    service, provider, clock = build()
    await service.overview()
    provider.fail = {"listings"}
    clock.now += LISTINGS_TTL + 1
    assert (await service.overview()).assets  # stale, but better than an error page


async def test_the_old_copy_is_not_kept_forever() -> None:
    service, provider, clock = build()
    await service.overview()
    provider.fail = {"listings"}
    clock.now += LISTINGS_TTL + STALE + 1
    with pytest.raises(UpstreamError):
        await service.overview()


async def test_a_bug_is_not_swallowed_as_a_missing_summary() -> None:
    service, provider, _ = build()

    async def broken() -> FearGreed:
        raise RuntimeError("a real bug")

    provider.fear_greed = broken  # type: ignore[method-assign]  # pyright: ignore[reportAttributeAccessIssue]
    with pytest.raises(RuntimeError, match="a real bug"):
        await service.overview()


def test_exposes_the_source_for_attribution() -> None:
    service, _, _ = build()
    assert service.source == "fake"
