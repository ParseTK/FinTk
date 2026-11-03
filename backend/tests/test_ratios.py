"""Ratios from annual SEC figures: arithmetic checked by hand, and every refusal to guess."""

import json
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from app.domain.models import AnnualValue, MetricSeries
from app.domain.ratios import DEFINITIONS, compute_ratios
from app.providers.sec.parsers import parse_annual_metrics

FIXTURES = Path(__file__).parent / "fixtures"
Y2025, Y2024, Y2023 = date(2025, 9, 27), date(2024, 9, 28), date(2023, 9, 30)


def series(metric: str, values: dict[date, str], unit: str = "USD") -> MetricSeries:
    rows = tuple(
        AnnualValue(period_end=period, value=Decimal(amount), filed=period, form="10-K")
        for period, amount in sorted(values.items(), reverse=True)
    )
    return MetricSeries(metric=metric, unit=unit, values=rows)


def by_key(metrics: list[MetricSeries]) -> dict[str, dict[date, Decimal | None]]:
    return {
        ratio.ratio: {value.period_end: value.value for value in ratio.values}
        for ratio in compute_ratios(metrics)
    }


class TestAgainstApplesFilings:
    """Apple's fiscal 2025 figures from the recorded SEC fixture, worked out independently by hand
    with plain arithmetic (not with the code under test)."""

    @pytest.fixture
    def apple(self) -> dict[str, dict[date, Decimal | None]]:
        payload = json.loads((FIXTURES / "companyfacts_aapl.json").read_text(encoding="utf-8"))
        return by_key(parse_annual_metrics(payload, 5))

    @pytest.mark.parametrize(
        ("ratio", "expected"),
        [
            ("gross_margin", "46.91"),  # 195,201 / 416,161
            ("operating_margin", "31.97"),  # 133,050 / 416,161
            ("net_margin", "26.92"),  # 112,010 / 416,161
            ("revenue_growth", "6.43"),  # (416,161 - 391,035) / 391,035
            ("net_income_growth", "19.50"),  # (112,010 - 93,736) / 93,736
            ("eps_growth", "22.70"),  # (7.46 - 6.08) / 6.08
            ("return_on_equity", "151.91"),  # 112,010 / 73,733
            ("return_on_assets", "31.18"),  # 112,010 / 359,241
            ("liabilities_to_equity", "3.87"),  # 285,508 / 73,733
            ("cash_conversion", "1.00"),  # 111,482 / 112,010
            ("cash_share_of_assets", "10.00"),  # 35,934 / 359,241
        ],
    )
    def test_latest_year(
        self, apple: dict[str, dict[date, Decimal | None]], ratio: str, expected: str
    ) -> None:
        assert apple[ratio][Y2025] == Decimal(expected)

    def test_covers_the_same_fiscal_years_newest_first(self) -> None:
        payload = json.loads((FIXTURES / "companyfacts_aapl.json").read_text(encoding="utf-8"))
        ratios = compute_ratios(parse_annual_metrics(payload, 5))
        periods = [value.period_end for value in ratios[0].values]
        assert periods == sorted(periods, reverse=True)
        assert len(periods) == 5

    def test_growth_for_the_oldest_year_is_not_available(
        self, apple: dict[str, dict[date, Decimal | None]]
    ) -> None:
        """There is no earlier year in the data, so there is nothing to grow from."""
        oldest = min(apple["revenue_growth"])
        assert apple["revenue_growth"][oldest] is None


class TestRefusingToGuess:
    def base(self) -> list[MetricSeries]:
        return [
            series("revenue", {Y2025: "200", Y2024: "100"}),
            series("gross_profit", {Y2025: "50", Y2024: "40"}),
            series("net_income", {Y2025: "20", Y2024: "10"}),
            series("assets", {Y2025: "400", Y2024: "300"}),
            series("equity", {Y2025: "100", Y2024: "80"}),
            series("liabilities", {Y2025: "300", Y2024: "220"}),
            series("operating_cash_flow", {Y2025: "30", Y2024: "12"}),
            series("cash", {Y2025: "40", Y2024: "30"}),
            series("eps_diluted", {Y2025: "2", Y2024: "1"}, "USD/shares"),
        ]

    def test_hand_computed_baseline(self) -> None:
        got = by_key(self.base())
        assert got["gross_margin"][Y2025] == Decimal("25.00")
        assert got["net_margin"][Y2025] == Decimal("10.00")
        assert got["revenue_growth"][Y2025] == Decimal("100.00")
        assert got["return_on_equity"][Y2025] == Decimal("20.00")
        assert got["liabilities_to_equity"][Y2025] == Decimal("3.00")
        assert got["cash_conversion"][Y2025] == Decimal("1.50")
        assert got["cash_share_of_assets"][Y2025] == Decimal("10.00")

    def test_a_loss_still_gives_a_margin(self) -> None:
        metrics = [series("revenue", {Y2025: "100"}), series("net_income", {Y2025: "-25"})]
        assert by_key(metrics)["net_margin"][Y2025] == Decimal("-25.00")

    @pytest.mark.parametrize("revenue", ["0", "-5"])
    def test_a_margin_needs_positive_revenue(self, revenue: str) -> None:
        metrics = [series("revenue", {Y2025: revenue}), series("net_income", {Y2025: "10"})]
        assert "net_margin" not in by_key(metrics)

    @pytest.mark.parametrize("equity", ["0", "-50"])
    def test_equity_ratios_need_positive_equity(self, equity: str) -> None:
        metrics = [
            series("equity", {Y2025: equity}),
            series("net_income", {Y2025: "10"}),
            series("liabilities", {Y2025: "100"}),
        ]
        got = by_key(metrics)
        assert "return_on_equity" not in got
        assert "liabilities_to_equity" not in got

    def test_growth_from_a_loss_is_not_meaningful(self) -> None:
        metrics = [series("net_income", {Y2025: "50", Y2024: "-10"})]
        assert "net_income_growth" not in by_key(metrics)

    def test_growth_from_zero_is_not_defined(self) -> None:
        metrics = [series("revenue", {Y2025: "50", Y2024: "0"})]
        assert "revenue_growth" not in by_key(metrics)

    def test_a_fall_into_a_loss_is_still_growth(self) -> None:
        metrics = [series("net_income", {Y2025: "-50", Y2024: "100"})]
        assert by_key(metrics)["net_income_growth"][Y2025] == Decimal("-150.00")

    def test_a_skipped_year_gives_no_growth(self) -> None:
        """2025 against 2023 is two years, not one: never presented as annual growth."""
        metrics = [series("revenue", {Y2025: "200", Y2023: "100"})]
        assert "revenue_growth" not in by_key(metrics)

    def test_a_short_period_is_not_the_year_before(self) -> None:
        """A six-month transition period must never be compared as if it were last year."""
        metrics = [series("revenue", {Y2025: "200", date(2025, 3, 31): "100"})]
        assert "revenue_growth" not in by_key(metrics)

    def test_a_52_or_53_week_year_still_counts_as_the_year_before(self) -> None:
        metrics = [series("revenue", {date(2025, 12, 28): "110", date(2024, 12, 29): "100"})]
        assert by_key(metrics)["revenue_growth"][date(2025, 12, 28)] == Decimal("10.00")

    def test_cash_conversion_needs_positive_net_income(self) -> None:
        metrics = [
            series("operating_cash_flow", {Y2025: "30"}),
            series("net_income", {Y2025: "-5"}),
        ]
        assert "cash_conversion" not in by_key(metrics)

    def test_a_missing_input_gives_none_for_that_year_only(self) -> None:
        metrics = [
            series("revenue", {Y2025: "200", Y2024: "100"}),
            series("gross_profit", {Y2025: "50"}),  # none for 2024
        ]
        margin = by_key(metrics)["gross_margin"]
        assert margin[Y2025] == Decimal("25.00")
        assert margin[Y2024] is None

    def test_a_company_that_never_reports_a_figure_has_no_row_for_it(self) -> None:
        metrics = [series("revenue", {Y2025: "200"}), series("net_income", {Y2025: "20"})]
        got = by_key(metrics)
        assert "net_margin" in got
        assert "gross_margin" not in got
        assert "return_on_assets" not in got

    def test_no_metrics_means_no_ratios(self) -> None:
        assert compute_ratios([]) == []


class TestShape:
    def test_rounds_half_up_to_two_places(self) -> None:
        metrics = [series("revenue", {Y2025: "3"}), series("net_income", {Y2025: "1"})]
        assert by_key(metrics)["net_margin"][Y2025] == Decimal("33.33")
        metrics = [series("revenue", {Y2025: "8"}), series("net_income", {Y2025: "1"})]
        assert by_key(metrics)["net_margin"][Y2025] == Decimal("12.50")
        metrics = [series("revenue", {Y2025: "200"}), series("net_income", {Y2025: "1.005"})]
        assert by_key(metrics)["net_margin"][Y2025] == Decimal("0.50")

    def test_money_stays_exact_decimal_never_float(self) -> None:
        got = by_key([series("revenue", {Y2025: "0.3"}), series("net_income", {Y2025: "0.1"})])
        assert got["net_margin"][Y2025] == Decimal("33.33")
        assert isinstance(got["net_margin"][Y2025], Decimal)

    def test_every_definition_has_a_label_formula_and_a_unit(self) -> None:
        keys = [definition.key for definition in DEFINITIONS]
        assert len(keys) == len(set(keys)) == 11
        for definition in DEFINITIONS:
            assert definition.label
            assert "/" in definition.formula
            assert definition.unit in {"percent", "times"}

    def test_no_definition_scores_or_judges(self) -> None:
        """Ratios are arithmetic. Nothing may call a company good, bad, cheap or risky."""
        words = ("good", "bad", "cheap", "expensive", "risky", "strong", "weak", "buy", "sell")
        for definition in DEFINITIONS:
            text = f"{definition.label} {definition.formula}".lower()
            assert not any(word in text.split() for word in words)
