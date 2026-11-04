"""Composition and change-since arithmetic for the crypto markets view, checked by hand."""

from datetime import UTC, datetime
from decimal import Decimal

import pytest

from app.domain.crypto import MarketTotals
from app.domain.crypto_markets import composition, percent_change

NOW = datetime(2026, 11, 3, 21, 0, tzinfo=UTC)


def totals(**overrides: Decimal | None) -> MarketTotals:
    values: dict[str, Decimal | None] = {
        "total_market_cap": Decimal("2450000000000.50"),
        "total_volume_24h": None,
        "btc_dominance": Decimal("52.35"),
        "eth_dominance": Decimal("17.80"),
        "total_market_cap_yesterday": Decimal("2400000000000"),
        "btc_dominance_yesterday": Decimal("52.10"),
        "eth_dominance_yesterday": Decimal("17.90"),
        "stablecoin_market_cap": Decimal("245000000000"),
        "defi_market_cap": Decimal("98000000000"),
        **overrides,
    }
    return MarketTotals(as_of=NOW, **values)  # pyright: ignore[reportArgumentType]


def row(overrides: dict[str, Decimal | None] | None = None, key: str = "bitcoin"):  # type: ignore[no-untyped-def]
    return next(r for r in composition(totals(**(overrides or {}))).rows if r.key == key)


class TestPercentChange:
    @pytest.mark.parametrize(
        ("now", "before", "expected"),
        [
            ("110", "100", "10.00"),
            ("90", "100", "-10.00"),
            ("100", "100", "0.00"),
            ("1", "3", "-66.67"),  # -66.666...
            ("2", "3", "-33.33"),
            ("100.5", "100", "0.50"),  # 0.5 exactly
            ("0.0000002", "0.0000001", "100.00"),  # a tiny coin doubling
            ("1000000", "1", "99999900.00"),
        ],
    )
    def test_hand_computed(self, now: str, before: str, expected: str) -> None:
        assert percent_change(Decimal(now), Decimal(before)) == Decimal(expected)

    def test_rounds_half_up(self) -> None:
        assert percent_change(Decimal("1.00005"), Decimal(1)) == Decimal("0.01")

    @pytest.mark.parametrize("before", ["0", "-1", "-0.0001"])
    def test_a_start_that_is_not_positive_gives_nothing(self, before: str) -> None:
        assert percent_change(Decimal(5), Decimal(before)) is None

    def test_missing_input_gives_nothing(self) -> None:
        assert percent_change(None, Decimal(1)) is None
        assert percent_change(Decimal(1), None) is None
        assert percent_change(None, None) is None

    def test_stays_exact_decimal(self) -> None:
        result = percent_change(Decimal("0.3"), Decimal("0.1"))
        assert result == Decimal("200.00")
        assert isinstance(result, Decimal)


class TestComposition:
    def test_bitcoin_and_ethereum_shares_and_what_they_are_worth(self) -> None:
        # 2,450,000,000,000.50 * 52.35% and * 17.80%
        btc, eth = row(key="bitcoin"), row(key="ethereum")
        assert (btc.share, btc.market_cap) == (Decimal("52.35"), Decimal("1282575000000.26"))
        assert (eth.share, eth.market_cap) == (Decimal("17.80"), Decimal("436100000000.09"))

    def test_everything_else_is_the_rest(self) -> None:
        other = row(key="other")
        assert other.share == Decimal("29.85")  # 100 - 52.35 - 17.80
        assert other.market_cap == Decimal("731325000000.15")

    def test_the_three_slices_add_up_to_the_whole(self) -> None:
        rows = {r.key: r for r in composition(totals()).rows}
        shares = [rows[key].share for key in ("bitcoin", "ethereum", "other")]
        assert None not in shares
        assert sum(s for s in shares if s is not None) == Decimal(100)

    def test_share_changes_are_points_since_yesterday(self) -> None:
        assert row(key="bitcoin").share_change == Decimal("0.25")  # 52.35 - 52.10
        assert row(key="ethereum").share_change == Decimal("-0.10")  # 17.80 - 17.90
        assert row(key="other").share_change == Decimal("-0.15")  # the rest moves the other way

    def test_the_total_is_compared_with_a_day_ago(self) -> None:
        # (2,450,000,000,000.50 - 2,400,000,000,000) / 2,400,000,000,000
        assert composition(totals()).total_change_24h == Decimal("2.08")

    def test_stablecoins_and_defi_are_shares_of_the_total_and_flagged_as_overlapping(self) -> None:
        stable, defi = row(key="stablecoins"), row(key="defi")
        assert (stable.share, stable.market_cap) == (Decimal("10.00"), Decimal("245000000000"))
        assert (defi.share, defi.market_cap) == (Decimal("4.00"), Decimal("98000000000"))
        assert stable.overlaps
        assert defi.overlaps
        assert stable.share_change is None  # no unambiguous figure for either group
        assert defi.share_change is None

    def test_the_three_slices_are_not_marked_as_overlapping(self) -> None:
        for key in ("bitcoin", "ethereum", "other"):
            assert row(key=key).overlaps is False

    def test_rows_come_in_a_fixed_order(self) -> None:
        assert [r.key for r in composition(totals()).rows] == [
            "bitcoin",
            "ethereum",
            "other",
            "stablecoins",
            "defi",
        ]

    def test_a_missing_dominance_means_no_other_figure_not_a_wrong_one(self) -> None:
        other = row({"btc_dominance": None}, key="other")
        assert other.share is None
        assert other.market_cap is None
        assert other.share_change is None
        assert row({"btc_dominance": None}, key="bitcoin").share is None

    def test_missing_yesterday_figures_mean_no_change(self) -> None:
        assert row({"btc_dominance_yesterday": None}, key="bitcoin").share_change is None
        assert row({"btc_dominance_yesterday": None}, key="other").share_change is None
        assert composition(totals(total_market_cap_yesterday=None)).total_change_24h is None

    def test_without_a_total_nothing_depends_on_it(self) -> None:
        result = composition(totals(total_market_cap=None))
        assert result.total_market_cap is None
        assert result.total_change_24h is None
        assert row({"total_market_cap": None}, key="bitcoin").market_cap is None
        assert row({"total_market_cap": None}, key="bitcoin").share == Decimal("52.35")
        assert row({"total_market_cap": None}, key="stablecoins").share is None

    @pytest.mark.parametrize("total", ["0", "-1"])
    def test_a_total_that_is_not_positive_gives_no_group_shares(self, total: str) -> None:
        result = {r.key: r for r in composition(totals(total_market_cap=Decimal(total))).rows}
        assert result["stablecoins"].share is None
        assert result["defi"].share is None

    def test_a_group_larger_than_the_total_is_shown_not_hidden(self) -> None:
        """Overlapping groups could exceed the total in principle; the number is shown as given."""
        stable = row({"stablecoin_market_cap": Decimal("3000000000000")}, key="stablecoins")
        assert stable.share is not None
        assert stable.share > Decimal(100)
