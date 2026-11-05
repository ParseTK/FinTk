"""Valuing holdings: exact decimal arithmetic, and a gain that skips holdings with no cost."""

from datetime import UTC, datetime
from decimal import Decimal

from app.domain.crypto import CryptoAsset
from app.domain.holdings import Holding, totals_of, value_holding

NOW = datetime(2026, 11, 5, tzinfo=UTC)


def asset(price: str) -> CryptoAsset:
    return CryptoAsset(
        rank=1,
        name="Example",
        symbol="EXA",
        slug="example",
        price=Decimal(price),
        change_24h=None,
        change_7d=None,
        market_cap=None,
        volume_24h=None,
    )


def holding(amount: str, cost: str | None, slug: str = "example") -> Holding:
    return Holding(slug, Decimal(amount), None if cost is None else Decimal(cost), NOW)


def test_value_gain_and_percent_are_worked_out_exactly() -> None:
    result = value_holding(holding("3", "4.00"), asset("2"))
    assert result.value == Decimal("6.00")
    assert result.gain == Decimal("2.00")
    assert result.gain_percent == Decimal("50.00")


def test_floating_point_noise_never_appears() -> None:
    # 0.1 + 0.2 style amounts: a float would give 0.30000000000000004 somewhere.
    result = value_holding(holding("0.3", "0.01"), asset("0.1"))
    assert result.value == Decimal("0.03")


def test_a_tiny_price_times_a_huge_amount_is_exact() -> None:
    result = value_holding(holding("999999999999.123456789012345678", None), asset("0.0000001234"))
    assert result.value == Decimal("123400.00")  # to cents


def test_no_cost_means_no_gain_not_a_gain_of_the_whole_value() -> None:
    result = value_holding(holding("3", None), asset("2"))
    assert result.value == Decimal("6.00")
    assert result.gain is None
    assert result.gain_percent is None


def test_a_zero_cost_has_a_gain_but_no_percentage() -> None:
    result = value_holding(holding("3", "0"), asset("2"))
    assert result.gain == Decimal("6.00")
    assert result.gain_percent is None


def test_a_coin_that_is_not_priced_has_nothing_priced() -> None:
    result = value_holding(holding("3", "4"), None)
    assert (result.asset, result.value, result.gain, result.gain_percent) == (None,) * 4


def test_a_loss_is_negative() -> None:
    result = value_holding(holding("1", "10.00"), asset("5"))
    assert result.gain == Decimal("-5.00")
    assert result.gain_percent == Decimal("-50.00")


class TestTotals:
    def test_the_gain_covers_only_holdings_that_have_a_cost(self) -> None:
        with_cost = value_holding(holding("3", "4.00", "a"), asset("2"))  # worth 6, paid 4
        without_cost = value_holding(holding("100", None, "b"), asset("2"))  # worth 200, paid ?
        totals = totals_of([with_cost, without_cost])
        assert totals.total_value == Decimal("206.00")  # everything priced
        assert totals.cost == Decimal("4.00")
        assert totals.value_with_cost == Decimal("6.00")
        assert totals.gain == Decimal("2.00")  # not 202: the unknown cost is not assumed zero
        assert totals.gain_percent == Decimal("50.00")

    def test_unpriced_holdings_are_counted_not_added(self) -> None:
        priced = value_holding(holding("1", "1"), asset("2"))
        missing = value_holding(holding("5", "50", "gone"), None)
        totals = totals_of([priced, missing])
        assert (totals.priced, totals.unpriced) == (1, 1)
        assert totals.total_value == Decimal("2.00")
        assert totals.cost == Decimal("1.00")  # the unpriced coin's cost is not in a gain either

    def test_without_any_cost_there_is_no_gain(self) -> None:
        totals = totals_of([value_holding(holding("1", None), asset("2"))])
        assert totals.gain is None
        assert totals.gain_percent is None

    def test_nothing_held_is_zero(self) -> None:
        totals = totals_of([])
        assert totals.total_value == Decimal("0.00")
        assert (totals.priced, totals.unpriced) == (0, 0)
        assert totals.gain is None
