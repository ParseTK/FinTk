import asyncio
from datetime import date
from decimal import Decimal

import httpx
import pytest

from app.core.errors import UpstreamError
from app.domain.markets import INSTRUMENTS, market_figures
from app.domain.models import MonthlyPrice, PriceHistory
from app.main import create_app
from app.services.markets import MarketService
from tests.conftest import make_settings


def price(year: int, month: int, close: str) -> MonthlyPrice:
    return MonthlyPrice(month_end=date(year, month, 28), close=Decimal(close))


def run_of_months(start: tuple[int, int], count: int, first: str = "100") -> list[MonthlyPrice]:
    """A close that rises by one each month, so the arithmetic is easy to follow."""
    prices: list[MonthlyPrice] = []
    year, month = start
    for step in range(count):
        prices.append(price(year, month, str(Decimal(first) + step)))
        month += 1
        if month == 13:
            year, month = year + 1, 1
    return prices


# -- figures ---------------------------------------------------------------------------------


def test_no_prices_means_no_figures() -> None:
    assert market_figures([]) is None


def test_last_month_year_to_date_and_trailing_year() -> None:
    # Closes rise by 1 a month from Jan 2023 = 88, so Jun 2023 = 93, Dec 2023 = 99, May 2024 = 104
    # and Jun 2024 = 105.
    prices = run_of_months((2023, 1), 18, "88")
    figures = market_figures(prices)
    assert figures is not None
    assert figures.as_of == (2024, 6)
    assert figures.last_month == Decimal("0.96")  # 104 -> 105
    assert figures.year_to_date == Decimal("6.06")  # 99 -> 105
    assert figures.trailing_12_months == Decimal("12.90")  # 93 -> 105
    assert figures.since_year == 2023


def test_figures_are_left_out_rather_than_guessed_across_a_gap() -> None:
    # March is missing, so April's one-month return is unknown, and so is a year-to-date that
    # needs the previous December.
    prices = [price(2024, 2, "100"), price(2024, 4, "110")]
    figures = market_figures(prices)
    assert figures is not None
    assert figures.last_month is None
    assert figures.year_to_date is None
    assert figures.trailing_12_months is None
    assert figures.annualized is None  # under a year of data


def test_year_to_date_in_a_december_is_the_whole_year() -> None:
    prices = [price(2023, 12, "100"), price(2024, 12, "110")]
    figures = market_figures(prices)
    assert figures is not None
    assert figures.year_to_date == Decimal("10.00")


def test_january_looks_back_to_the_december_before() -> None:
    figures = market_figures([price(2023, 12, "100"), price(2024, 1, "104")])
    assert figures is not None
    assert figures.last_month == Decimal("4.00")
    assert figures.year_to_date == Decimal("4.00")


def test_annualized_is_the_compound_yearly_rate() -> None:
    # Doubling over exactly 3 years is 2 ** (1/3) - 1 = 25.99% a year.
    figures = market_figures([price(2020, 12, "100"), price(2023, 12, "200")])
    assert figures is not None
    assert figures.annualized == Decimal("25.99")


def test_bad_closes_are_ignored() -> None:
    figures = market_figures([price(2024, 1, "0"), price(2024, 2, "100")])
    assert figures is not None
    assert figures.as_of == (2024, 2)
    assert figures.last_month is None


def test_the_list_is_fixed_and_has_unique_symbols() -> None:
    symbols = [i.symbol for i in INSTRUMENTS]
    assert len(symbols) == len(set(symbols)) == 15
    assert {i.group for i in INSTRUMENTS} == {"index", "sector"}


# -- service ---------------------------------------------------------------------------------


class Prices:
    source = "unit"

    def __init__(self, broken: set[str] | None = None, slow: set[str] | None = None) -> None:
        self.broken = broken or set()
        self.slow = slow or set()
        self.calls: list[str] = []

    async def monthly_history(self, symbol: str, *, since: date | None = None) -> PriceHistory:
        self.calls.append(symbol)
        if symbol in self.slow:
            await asyncio.sleep(0.3)
        if symbol in self.broken:
            msg = "down"
            raise UpstreamError(msg)
        return PriceHistory(symbol, self.source, tuple(run_of_months((2023, 1), 18, "88")))


async def test_every_symbol_gets_a_row() -> None:
    overview = await MarketService(Prices()).overview()
    assert [r.instrument.symbol for r in overview.rows] == [i.symbol for i in INSTRUMENTS]
    assert overview.complete
    assert overview.source == "unit"


async def test_one_failing_symbol_is_a_row_without_figures_not_a_failed_page() -> None:
    overview = await MarketService(Prices(broken={"XLE"})).overview()
    missing = [r.instrument.symbol for r in overview.rows if r.figures is None]
    assert missing == ["XLE"]
    assert not overview.complete


async def test_a_slow_symbol_does_not_hold_the_page_up_and_finishes_in_the_background() -> None:
    service = MarketService(Prices(slow={"XLK"}), wait=0.05, keep_partial=0)
    overview = await service.overview()
    assert [r.instrument.symbol for r in overview.rows if r.figures is None] == ["XLK"]
    await asyncio.sleep(0.5)  # the fetch carries on, so the next visit has it
    assert all(r.figures is not None for r in (await service.overview()).rows)


async def test_a_complete_overview_is_reused_and_does_not_ask_for_prices_again() -> None:
    prices = Prices()
    service = MarketService(prices)
    await service.overview()
    await service.overview()
    assert len(prices.calls) == 15


async def test_a_partial_overview_is_retried_after_a_short_wait() -> None:
    now = [0.0]
    prices = Prices(broken={"XLE"})
    service = MarketService(prices, keep_partial=45, clock=lambda: now[0])
    await service.overview()
    await service.overview()
    assert prices.calls.count("XLE") == 1  # still inside the short wait
    now[0] = 46
    prices.broken.clear()
    assert (await service.overview()).complete


async def test_simultaneous_visitors_share_one_build() -> None:
    prices = Prices()
    service = MarketService(prices)
    await asyncio.gather(*(service.overview() for _ in range(10)))
    assert len(prices.calls) == 15


# -- API -------------------------------------------------------------------------------------


@pytest.fixture
async def api() -> httpx.AsyncClient:
    app = create_app(make_settings(), market_service=MarketService(Prices(broken={"XLE"})))
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    return httpx.AsyncClient(transport=transport, base_url="http://test")


async def test_the_overview_endpoint_returns_strings_for_percentages(
    api: httpx.AsyncClient,
) -> None:
    response = await api.get("/api/v1/markets/overview")
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "unit"
    assert "dividends not included" in body["basis"]
    first = body["rows"][0]
    assert (first["symbol"], first["group"]) == ("SPY", "index")
    assert first["figures"]["year_to_date"] == "6.06"
    assert first["figures"]["as_of_year"] == 2024
    energy = next(r for r in body["rows"] if r["symbol"] == "XLE")
    assert energy["figures"] is None


async def test_a_partial_answer_is_cached_only_briefly(api: httpx.AsyncClient) -> None:
    response = await api.get("/api/v1/markets/overview")
    assert response.headers["cache-control"] == "public, max-age=30"


async def test_without_market_data_configured_it_is_a_clean_503() -> None:
    app = create_app(make_settings())
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/markets/overview")
    assert response.status_code == 503
    assert response.json()["error"]["code"]
