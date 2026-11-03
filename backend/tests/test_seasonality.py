from datetime import date
from decimal import Decimal

from app.domain.models import MonthlyPrice, PriceHistory
from app.domain.seasonality import build_seasonality, monthly_returns


def price(year: int, month: int, close: str) -> MonthlyPrice:
    return MonthlyPrice(month_end=date(year, month, 28), close=Decimal(close))


def history(*prices: MonthlyPrice) -> PriceHistory:
    return PriceHistory(symbol="TEST", source="unit", prices=tuple(prices))


def test_return_is_the_percent_change_from_the_previous_months_close() -> None:
    result = build_seasonality(history(price(1970, 7, "100"), price(1970, 8, "96.16")))
    assert [(r.year, r.month, r.percent) for r in result.returns] == [(1970, 8, Decimal("-3.84"))]


def test_the_first_month_has_no_return_and_is_the_start_of_the_data() -> None:
    result = build_seasonality(history(price(1999, 12, "10"), price(2000, 1, "11")))
    assert result.first_month == (1999, 12)
    assert result.last_month == (2000, 1)
    assert [(r.year, r.month) for r in result.returns] == [(2000, 1)]


def test_a_gap_never_produces_a_return_that_spans_several_months() -> None:
    # March is missing, so April cannot be scored; May can (April is present).
    result = build_seasonality(
        history(price(2020, 2, "10"), price(2020, 4, "20"), price(2020, 5, "21"))
    )
    assert [(r.year, r.month) for r in result.returns] == [(2020, 5)]


def test_returns_cross_a_year_boundary() -> None:
    result = build_seasonality(history(price(2019, 12, "100"), price(2020, 1, "105")))
    assert [(r.year, r.month, r.percent) for r in result.returns] == [(2020, 1, Decimal("5.00"))]


def test_input_order_and_duplicates_do_not_matter_and_a_later_duplicate_wins() -> None:
    shuffled = history(price(2020, 2, "110"), price(2020, 1, "100"), price(2020, 2, "121"))
    assert [r.percent for r in build_seasonality(shuffled).returns] == [Decimal("21.00")]


def test_labels_do_not_have_to_be_month_ends() -> None:
    first_of_month = history(
        MonthlyPrice(month_end=date(2020, 1, 1), close=Decimal("100")),
        MonthlyPrice(month_end=date(2020, 2, 1), close=Decimal("110")),
    )
    assert [r.percent for r in build_seasonality(first_of_month).returns] == [Decimal("10.00")]


def test_zero_negative_and_missing_closes_are_ignored_not_divided_by() -> None:
    result = build_seasonality(
        history(
            price(2020, 1, "0"), price(2020, 2, "10"), price(2020, 3, "-5"), price(2020, 4, "9")
        )
    )
    # January and March are unusable, so February has no previous month and April's previous
    # month (March) is gone: nothing can be scored, and nothing crashes.
    assert result.returns == ()
    assert result.stats == ()


def test_empty_history_is_valid() -> None:
    result = build_seasonality(history())
    assert result.first_month is None
    assert result.last_month is None
    assert result.returns == ()


def test_one_price_has_a_start_but_no_returns() -> None:
    result = build_seasonality(history(price(2020, 1, "10")))
    assert result.first_month == (2020, 1)
    assert result.returns == ()


def test_statistics_per_calendar_month() -> None:
    # Three Februaries: +10%, -20%, +5% (each preceded by a January close of 100).
    result = build_seasonality(
        history(
            price(2018, 1, "100"),
            price(2018, 2, "110"),
            price(2019, 1, "100"),
            price(2019, 2, "80"),
            price(2020, 1, "100"),
            price(2020, 2, "105"),
        )
    )
    (february,) = [s for s in result.stats if s.month == 2]
    assert february.count == 3
    assert february.average == Decimal("-1.67")
    assert february.median == Decimal("5.00")
    assert february.positive == 2
    assert february.win_rate == Decimal("66.67")
    assert (february.best.year, february.best.percent) == (2018, Decimal("10.00"))
    assert (february.worst.year, february.worst.percent) == (2019, Decimal("-20.00"))


def test_the_median_of_an_even_count_is_the_mean_of_the_middle_two() -> None:
    result = build_seasonality(
        history(
            price(2018, 1, "100"),
            price(2018, 2, "110"),  # +10
            price(2019, 1, "100"),
            price(2019, 2, "102"),  # +2
        )
    )
    (february,) = [s for s in result.stats if s.month == 2]
    assert february.median == Decimal("6.00")


def test_ties_report_the_earliest_year() -> None:
    result = build_seasonality(
        history(
            price(2018, 1, "100"),
            price(2018, 2, "110"),
            price(2019, 1, "100"),
            price(2019, 2, "110"),
        )
    )
    (february,) = [s for s in result.stats if s.month == 2]
    assert february.best.year == 2018
    assert february.worst.year == 2018


def test_stats_only_cover_months_that_have_a_return_and_are_in_calendar_order() -> None:
    result = build_seasonality(
        history(price(2020, 1, "10"), price(2020, 2, "11"), price(2020, 3, "12"))
    )
    assert [s.month for s in result.stats] == [2, 3]


def test_returns_are_ordered_by_year_then_month() -> None:
    result = build_seasonality(
        history(price(2019, 12, "10"), price(2020, 1, "11"), price(2020, 2, "12"))
    )
    keys = [(r.year, r.month) for r in result.returns]
    assert keys == sorted(keys)


def test_rounding_is_half_even_and_computed_from_unrounded_values() -> None:
    # +0.125% and +0.375% round to 0.12 and 0.38 (half to even), their average is 0.25 exactly.
    result = build_seasonality(
        history(
            price(2018, 1, "1000"),
            price(2018, 2, "1001.25"),
            price(2019, 1, "1000"),
            price(2019, 2, "1003.75"),
        )
    )
    assert [r.percent for r in result.returns if r.month == 2] == [
        Decimal("0.12"),
        Decimal("0.38"),
    ]
    (february,) = [s for s in result.stats if s.month == 2]
    assert february.average == Decimal("0.25")


def test_monthly_returns_are_exact_decimals_not_floats() -> None:
    (only,) = monthly_returns([price(2020, 1, "3"), price(2020, 2, "4")])
    assert isinstance(only[2], Decimal)
    assert abs(only[2] - Decimal(100) / 3) < Decimal("1e-20")  # carried at Decimal precision


def test_a_long_history_scales_linearly() -> None:
    prices = [price(1900 + i // 12, i % 12 + 1, str(10 + i % 7)) for i in range(12 * 100)]
    result = build_seasonality(history(*prices))
    assert len(result.returns) == len(prices) - 1
    assert len(result.stats) == 12
