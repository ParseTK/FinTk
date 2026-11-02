from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError

from app.db.engine import Database
from app.domain.models import MonthlyPrice
from app.repositories.prices import BATCH_SIZE, PriceRepository


def month(year: int, number: int, close: str) -> MonthlyPrice:
    # Day 28 exists in every month, which is all these tests need.
    return MonthlyPrice(month_end=date(year, number, 28), close=Decimal(close))


async def test_an_unknown_symbol_has_no_data(database: Database) -> None:
    async with database.session() as session:
        repo = PriceRepository(session)
        assert await repo.months("AAPL") == []
        assert await repo.latest_month("AAPL") is None
        assert await repo.refreshed_at("AAPL") is None
        assert await repo.source("AAPL") is None


async def test_saved_months_come_back_in_date_order_with_exact_decimals(
    database: Database,
) -> None:
    async with database.session() as session:
        await PriceRepository(session).save(
            "AAPL",
            "twelvedata",
            [month(2024, 3, "10.123456"), month(2024, 1, "9.5"), month(2024, 2, "9.999999")],
        )

    async with database.session() as session:
        stored = await PriceRepository(session).months("AAPL")

    assert [p.month_end.month for p in stored] == [1, 2, 3]
    assert stored[2].close == Decimal("10.123456")  # six decimals survive: no float rounding
    assert stored[0].close == Decimal("9.500000")


async def test_a_date_range_returns_only_those_months(database: Database) -> None:
    async with database.session() as session:
        repo = PriceRepository(session)
        await repo.save("KO", "sample", [month(2024, m, "50") for m in range(1, 7)])
        window = await repo.months("KO", start=date(2024, 2, 1), end=date(2024, 4, 30))
    assert [p.month_end.month for p in window] == [2, 3, 4]


async def test_symbols_do_not_see_each_others_data(database: Database) -> None:
    async with database.session() as session:
        repo = PriceRepository(session)
        await repo.save("AAPL", "sample", [month(2024, 1, "1")])
        await repo.save("MSFT", "sample", [month(2024, 1, "2"), month(2024, 2, "3")])
        assert len(await repo.months("AAPL")) == 1
        assert len(await repo.months("MSFT")) == 2


async def test_saving_twice_is_idempotent(database: Database) -> None:
    data = [month(2024, 1, "10"), month(2024, 2, "11")]
    async with database.session() as session:
        repo = PriceRepository(session)
        await repo.save("AAPL", "sample", data)
        await repo.save("AAPL", "sample", data)
        assert len(await repo.months("AAPL")) == 2


async def test_a_restated_month_replaces_the_stored_value(database: Database) -> None:
    async with database.session() as session:
        repo = PriceRepository(session)
        await repo.save("AAPL", "sample", [month(2024, 1, "10")])
        await repo.save("AAPL", "sample", [month(2024, 1, "10.5")])
        assert (await repo.months("AAPL"))[0].close == Decimal("10.5")


async def test_appending_the_newest_month_keeps_the_history(database: Database) -> None:
    async with database.session() as session:
        repo = PriceRepository(session)
        await repo.save("AAPL", "sample", [month(2024, 1, "10"), month(2024, 2, "11")])
        assert await repo.latest_month("AAPL") == date(2024, 2, 28)
        await repo.save("AAPL", "sample", [month(2024, 3, "12")])
        assert await repo.latest_month("AAPL") == date(2024, 3, 28)
        assert len(await repo.months("AAPL")) == 3


async def test_the_source_and_refresh_time_are_recorded_and_updated(database: Database) -> None:
    async with database.session() as session:
        repo = PriceRepository(session)
        await repo.save("AAPL", "sample", [month(2024, 1, "10")])
        first = await repo.refreshed_at("AAPL")
        await repo.save("AAPL", "twelvedata", [])
        assert await repo.source("AAPL") == "twelvedata"
        second = await repo.refreshed_at("AAPL")
    assert first is not None
    assert second is not None
    assert second >= first


async def test_a_long_history_is_written_in_bounded_batches(database: Database) -> None:
    # More rows than one batch holds, so the batching path is exercised.
    count = BATCH_SIZE * 2 + 500
    rows = [
        MonthlyPrice(month_end=date(1900 + i // 12, i % 12 + 1, 1), close=Decimal(i + 1))
        for i in range(count)
    ]
    async with database.session() as session:
        repo = PriceRepository(session)
        assert await repo.save("LONG", "sample", rows) == count
        assert len(await repo.months("LONG")) == count


async def test_a_non_positive_price_is_rejected_by_the_database(database: Database) -> None:
    with pytest.raises(IntegrityError):
        async with database.session() as session:
            await PriceRepository(session).save("BAD", "sample", [month(2024, 1, "0")])


async def test_a_failed_unit_of_work_leaves_nothing_behind(database: Database) -> None:
    async def save_good_then_bad() -> None:
        async with database.session() as session:
            repo = PriceRepository(session)
            await repo.save("GOOD", "sample", [month(2024, 1, "5")])
            await repo.save("BAD", "sample", [month(2024, 1, "-1")])  # fails, rolls back both

    with pytest.raises(IntegrityError):
        await save_good_then_bad()

    async with database.session() as session:
        assert await PriceRepository(session).months("GOOD") == []
