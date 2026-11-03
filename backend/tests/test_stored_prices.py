import asyncio
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest

from app.core.errors import UnavailableError, UpstreamError
from app.db.engine import Database
from app.domain.models import MonthlyPrice, PriceHistory
from app.domain.months import last_complete_month_end, month_end, month_index
from app.repositories.prices import PriceRepository
from app.services.prices import StoredPriceProvider


class FakeUpstream:
    """A provider with a fixed first listing month; records every call it receives."""

    source = "Fake Data"

    def __init__(self, now: "Clock", *, first: tuple[int, int] = (2020, 1)) -> None:
        self.calls: list[tuple[str, date | None]] = []
        self.failure: Exception | None = None
        self.empty = False
        self.delay = 0.0
        self._now = now
        self._first = first

    async def monthly_history(self, symbol: str, *, since: date | None = None) -> PriceHistory:
        self.calls.append((symbol, since))
        if self.delay:
            await asyncio.sleep(self.delay)
        if self.failure is not None:
            raise self.failure
        prices: list[MonthlyPrice] = []
        if not self.empty:
            last = month_index(last_complete_month_end(self._now().date()))
            for index in range(self._first[0] * 12 + self._first[1] - 1, last + 1):
                end = month_end(index // 12, index % 12 + 1)
                if since is None or end >= since:
                    prices.append(MonthlyPrice(month_end=end, close=Decimal(10 + index % 5)))
        return PriceHistory(symbol=symbol, source=self.source, prices=tuple(prices))


class Clock:
    def __init__(self) -> None:
        self.now = datetime.now(UTC)

    def __call__(self) -> datetime:
        return self.now


class Ticker:
    def __init__(self) -> None:
        self.seconds = 1000.0

    def __call__(self) -> float:
        return self.seconds


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def upstream(clock: Clock) -> FakeUpstream:
    return FakeUpstream(clock)


@pytest.fixture
def ticker() -> Ticker:
    return Ticker()


@pytest.fixture
def provider(
    database: Database, upstream: FakeUpstream, clock: Clock, ticker: Ticker
) -> StoredPriceProvider:
    return StoredPriceProvider(upstream, database, now=clock, clock=ticker)


async def test_the_first_request_fetches_everything_and_stores_it(
    provider: StoredPriceProvider, upstream: FakeUpstream, database: Database
) -> None:
    history = await provider.monthly_history("aapl")
    assert upstream.calls == [("AAPL", None)]
    assert history.source == "Fake Data"
    assert history.prices[0].month_end == date(2020, 1, 31)
    async with database.session() as session:
        assert len(await PriceRepository(session).months("AAPL")) == len(history.prices)


async def test_later_requests_are_served_from_the_database_without_calling_the_provider(
    provider: StoredPriceProvider, upstream: FakeUpstream
) -> None:
    first = await provider.monthly_history("AAPL")
    again = await provider.monthly_history("AAPL")
    assert len(upstream.calls) == 1
    assert again.prices == first.prices


async def test_a_new_month_asks_only_for_the_newest_months_and_appends(
    provider: StoredPriceProvider, upstream: FakeUpstream, clock: Clock
) -> None:
    before = await provider.monthly_history("AAPL")
    newest = before.prices[-1].month_end

    clock.now += timedelta(days=40)  # a month later
    after = await provider.monthly_history("AAPL")

    assert upstream.calls[-1] == ("AAPL", newest)  # resumed from the newest stored month
    assert len(after.prices) > len(before.prices)
    assert after.prices[: len(before.prices)] == before.prices  # nothing old was lost or changed
    assert after.prices[-1].month_end > newest


async def test_concurrent_requests_share_one_provider_call(
    provider: StoredPriceProvider, upstream: FakeUpstream
) -> None:
    upstream.delay = 0.05
    results = await asyncio.gather(*(provider.monthly_history("MSFT") for _ in range(10)))
    assert len(upstream.calls) == 1
    assert all(r.prices == results[0].prices for r in results)


async def test_a_provider_failure_with_nothing_stored_is_an_error_and_is_not_retried_at_once(
    provider: StoredPriceProvider, upstream: FakeUpstream
) -> None:
    upstream.failure = UpstreamError("down")
    for _ in range(3):
        with pytest.raises(UpstreamError):
            await provider.monthly_history("AAPL")
    assert len(upstream.calls) == 1  # the cooldown protected the provider


async def test_the_cooldown_ends(
    provider: StoredPriceProvider, upstream: FakeUpstream, ticker: Ticker
) -> None:
    upstream.failure = UpstreamError("down")
    with pytest.raises(UpstreamError):
        await provider.monthly_history("AAPL")
    ticker.seconds += 61
    upstream.failure = None
    history = await provider.monthly_history("AAPL")
    assert len(upstream.calls) == 2
    assert history.prices


async def test_stored_prices_are_served_when_the_refresh_fails(
    provider: StoredPriceProvider, upstream: FakeUpstream, clock: Clock
) -> None:
    before = await provider.monthly_history("AAPL")
    clock.now += timedelta(days=40)
    upstream.failure = UnavailableError("quota")
    during = await provider.monthly_history("AAPL")
    assert during.prices == before.prices


async def test_a_symbol_the_provider_has_nothing_for_is_remembered_not_asked_again(
    provider: StoredPriceProvider, upstream: FakeUpstream
) -> None:
    upstream.empty = True
    assert (await provider.monthly_history("ZZZZ")).prices == ()
    assert (await provider.monthly_history("ZZZZ")).prices == ()
    assert len(upstream.calls) == 1


async def test_data_stored_by_another_source_is_replaced_with_a_full_fetch(
    provider: StoredPriceProvider, upstream: FakeUpstream, database: Database
) -> None:
    async with database.session() as session:
        await PriceRepository(session).save(
            "AAPL", "sample", [MonthlyPrice(month_end=date(2024, 1, 31), close=Decimal(1))]
        )
    history = await provider.monthly_history("AAPL")
    assert upstream.calls == [("AAPL", None)]  # not an incremental fetch on top of unlike data
    assert history.source == "Fake Data"


async def test_symbols_are_stored_in_upper_case(
    provider: StoredPriceProvider, upstream: FakeUpstream
) -> None:
    await provider.monthly_history("aapl")
    await provider.monthly_history("AAPL")
    assert upstream.calls == [("AAPL", None)]


async def test_without_a_database_history_is_kept_in_memory(
    upstream: FakeUpstream, clock: Clock
) -> None:
    provider = StoredPriceProvider(upstream, None, now=clock)
    await asyncio.gather(*(provider.monthly_history("AAPL") for _ in range(5)))
    await provider.monthly_history("AAPL")
    assert len(upstream.calls) == 1
