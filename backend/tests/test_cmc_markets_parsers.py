"""Reading the extra figures the markets view needs, from synthetic data and hostile input."""

import json
from copy import deepcopy
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from app.providers.coinmarketcap import parsers

FIXTURES = Path(__file__).parent / "fixtures"
NOW = datetime(2026, 11, 3, 21, 0, tzinfo=UTC)


def load(name: str) -> dict[str, Any]:
    data: dict[str, Any] = json.loads((FIXTURES / name).read_text(encoding="utf-8"))
    return data


def listing_with(**overrides: Any) -> dict[str, Any]:
    payload = load("cmc_listings.json")
    row = deepcopy(payload["data"][1])  # Example Gold, rank 1
    row.update(overrides)
    payload["data"] = [row]
    return payload


class TestListingExtras:
    def test_reads_the_id_and_the_30_and_90_day_changes(self) -> None:
        gold = parsers.parse_listings(load("cmc_listings.json"), NOW).assets[0]
        assert gold.cmc_id == 9001
        assert gold.change_30d == Decimal("12.50")
        assert gold.change_90d == Decimal("-20.25")

    def test_a_missing_change_is_none_not_zero(self) -> None:
        tiny = parsers.parse_listings(load("cmc_listings.json"), NOW).assets[2]
        assert tiny.change_30d is None
        assert tiny.change_90d is None

    @pytest.mark.parametrize("bad", [None, True, False, 0, -4, "9001", 9001.5, [], {}])
    def test_a_bad_id_costs_the_id_not_the_coin(self, bad: object) -> None:
        asset = parsers.parse_listings(listing_with(id=bad), NOW).assets[0]
        assert asset.cmc_id is None
        assert asset.symbol == "EXG"  # the coin itself is still shown

    @pytest.mark.parametrize("bad", ["inf", "NaN", True, {"x": 1}, "abc"])
    def test_a_bad_change_becomes_none(self, bad: object) -> None:
        quote = {"USD": {"price": 5, "percent_change_30d": bad, "percent_change_90d": bad}}
        asset = parsers.parse_listings(listing_with(quote=quote), NOW).assets[0]
        assert asset.change_30d is None
        assert asset.change_90d is None
        assert asset.price == Decimal(5)


class TestGlobalExtras:
    def test_reads_yesterdays_figures_and_the_two_overlapping_groups(self) -> None:
        totals = parsers.parse_global(load("cmc_global.json"), NOW)
        assert totals.total_market_cap_yesterday == Decimal("2400000000000")
        assert totals.btc_dominance_yesterday == Decimal("52.10")
        assert totals.eth_dominance_yesterday == Decimal("17.90")
        assert totals.stablecoin_market_cap == Decimal("245000000000")
        assert totals.defi_market_cap == Decimal("98000000000")

    def test_a_figure_placed_beside_the_quote_is_found_too(self) -> None:
        payload = load("cmc_global.json")
        payload["data"]["defi_market_cap"] = payload["data"]["quote"]["USD"].pop("defi_market_cap")
        assert parsers.parse_global(payload, NOW).defi_market_cap == Decimal("98000000000")

    def test_the_quote_wins_when_both_are_present(self) -> None:
        payload = load("cmc_global.json")
        payload["data"]["stablecoin_market_cap"] = 1
        assert parsers.parse_global(payload, NOW).stablecoin_market_cap == Decimal("245000000000")

    def test_missing_extras_are_none_and_the_rest_still_reads(self) -> None:
        payload = load("cmc_global.json")
        for key in (
            "btc_dominance_yesterday",
            "eth_dominance_yesterday",
        ):
            del payload["data"][key]
        for key in ("total_market_cap_yesterday", "stablecoin_market_cap", "defi_market_cap"):
            del payload["data"]["quote"]["USD"][key]
        totals = parsers.parse_global(payload, NOW)
        assert totals.btc_dominance == Decimal("52.35")
        assert totals.btc_dominance_yesterday is None
        assert totals.stablecoin_market_cap is None

    @pytest.mark.parametrize("bad", ["inf", "NaN", -5, True, "abc", None])
    def test_a_hostile_extra_never_breaks_the_totals(self, bad: object) -> None:
        payload = load("cmc_global.json")
        payload["data"]["quote"]["USD"]["stablecoin_market_cap"] = bad
        totals = parsers.parse_global(payload, NOW)
        assert totals.stablecoin_market_cap is None
        assert totals.total_market_cap == Decimal("2450000000000.50")


class TestAnchorPrices:
    def test_reads_every_coin_and_the_day(self) -> None:
        anchor = parsers.parse_anchor_prices(load("cmc_anchor.json"))
        assert anchor.on == date(2026, 1, 1)
        assert anchor.prices == {
            9001: Decimal("50000.5"),
            9002: Decimal(2000),
            9003: Decimal("0.00000008"),
        }

    def test_a_tiny_price_keeps_its_digits(self) -> None:
        assert parsers.parse_anchor_prices(load("cmc_anchor.json")).prices[9003] > 0

    def test_a_single_object_per_coin_works_as_well_as_a_list(self) -> None:
        payload = load("cmc_anchor.json")
        payload["data"] = {key: value[0] for key, value in payload["data"].items()}
        assert len(parsers.parse_anchor_prices(payload).prices) == 3

    def test_the_id_may_come_from_the_key_alone(self) -> None:
        payload = load("cmc_anchor.json")
        for value in payload["data"].values():
            del value[0]["id"]
        assert set(parsers.parse_anchor_prices(payload).prices) == {9001, 9002, 9003}

    def test_a_coin_with_no_usable_price_is_skipped_not_zeroed(self) -> None:
        payload = load("cmc_anchor.json")
        payload["data"]["9002"][0]["quotes"][0]["quote"]["USD"]["price"] = 0
        payload["data"]["9003"][0]["quotes"] = []
        assert set(parsers.parse_anchor_prices(payload).prices) == {9001}

    @pytest.mark.parametrize("bad", [None, True, "inf", "NaN", -1, {"x": 1}, []])
    def test_a_hostile_price_is_skipped(self, bad: object) -> None:
        payload = load("cmc_anchor.json")
        payload["data"]["9001"][0]["quotes"][0]["quote"]["USD"]["price"] = bad
        assert 9001 not in parsers.parse_anchor_prices(payload).prices

    def test_a_coin_stamped_on_another_day_is_left_out(self) -> None:
        """All coins must describe the same day; a stray one is dropped, never mixed in."""
        payload = load("cmc_anchor.json")
        payload["data"]["9003"][0]["quotes"][0]["timestamp"] = "2026-03-09T00:00:00.000Z"
        anchor = parsers.parse_anchor_prices(payload)
        assert anchor.on == date(2026, 1, 1)
        assert 9003 not in anchor.prices

    @pytest.mark.parametrize("bad_id", [None, "x", True, -1, 0])
    def test_a_coin_without_a_usable_id_is_skipped(self, bad_id: object) -> None:
        payload = load("cmc_anchor.json")
        payload["data"]["not-an-id"] = deepcopy(payload["data"]["9001"])
        payload["data"]["not-an-id"][0]["id"] = bad_id
        assert set(parsers.parse_anchor_prices(payload).prices) == {9001, 9002, 9003}

    @pytest.mark.parametrize("data", [None, [], "x", 5, {}])
    def test_garbage_is_an_error_never_no_change(self, data: object) -> None:
        with pytest.raises(ValueError, match="anchor response"):
            parsers.parse_anchor_prices({"data": data})

    def test_nothing_readable_is_an_error(self) -> None:
        payload = load("cmc_anchor.json")
        for value in payload["data"].values():
            value[0]["quotes"][0]["quote"]["USD"]["price"] = None
        with pytest.raises(ValueError, match="no readable prices"):
            parsers.parse_anchor_prices(payload)

    def test_a_bad_timestamp_skips_the_coin(self) -> None:
        payload = load("cmc_anchor.json")
        payload["data"]["9001"][0]["quotes"][0]["timestamp"] = "yesterday"
        assert 9001 not in parsers.parse_anchor_prices(payload).prices
