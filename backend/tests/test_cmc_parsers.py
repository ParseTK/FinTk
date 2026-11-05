"""Reading CoinMarketCap responses: pure functions, tested on synthetic data and hostile input."""

import json
from copy import deepcopy
from datetime import UTC, datetime
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


def row(**overrides: Any) -> dict[str, Any]:
    base = deepcopy(load("cmc_listings.json")["data"][1])  # "Example Gold", rank 1
    base.update(overrides)
    return base


def listing(*rows: dict[str, Any]) -> dict[str, Any]:
    payload = load("cmc_listings.json")
    payload["data"] = list(rows)
    return payload


class TestListings:
    def test_reads_every_row_and_orders_by_rank(self) -> None:
        listings = parsers.parse_listings(load("cmc_listings.json"), NOW)
        assert [a.symbol for a in listings.assets] == ["EXG", "EXS", "EXT"]
        assert [a.rank for a in listings.assets] == [1, 2, 3]

    def test_reads_the_numbers_exactly(self) -> None:
        gold = parsers.parse_listings(load("cmc_listings.json"), NOW).assets[0]
        assert gold.price == Decimal("65000.1234")
        assert gold.change_24h == Decimal("1.23")
        assert gold.change_7d == Decimal("-2.00")
        assert gold.market_cap == Decimal("1280000000000.00")
        assert gold.volume_24h == Decimal("30000000000.00")

    def test_a_tiny_price_keeps_its_digits(self) -> None:
        tiny = parsers.parse_listings(load("cmc_listings.json"), NOW).assets[2]
        assert tiny.price == Decimal("0.0000001234")

    def test_a_missing_figure_is_none_not_zero(self) -> None:
        tiny = parsers.parse_listings(load("cmc_listings.json"), NOW).assets[2]
        assert tiny.change_24h is None
        assert tiny.change_7d is None
        assert tiny.market_cap is None

    def test_uses_the_provider_time_and_falls_back_to_ours(self) -> None:
        assert parsers.parse_listings(load("cmc_listings.json"), NOW).as_of == datetime(
            2026, 11, 3, 20, 1, tzinfo=UTC
        )
        no_time = load("cmc_listings.json")
        del no_time["status"]["timestamp"]
        assert parsers.parse_listings(no_time, NOW).as_of == NOW

    def test_skips_a_bad_row_but_keeps_the_good_ones(self) -> None:
        bad = row(cmc_rank=0, symbol="BAD", slug="bad")
        payload = listing(bad, row())
        assert [a.symbol for a in parsers.parse_listings(payload, NOW).assets] == ["EXG"]

    @pytest.mark.parametrize(
        "overrides",
        [
            {"cmc_rank": None},
            {"cmc_rank": True},
            {"cmc_rank": -3},
            {"cmc_rank": "1"},
            {"symbol": ""},
            {"symbol": None},
            {"name": "​\x00"},
            {"slug": "Has Spaces"},
            {"slug": "../etc/passwd"},
            {"quote": None},
            {"quote": {"USD": {"price": 0}}},
            {"quote": {"USD": {"price": -1}}},
            {"quote": {"USD": {"price": None}}},
            {"quote": {"USD": {"price": True}}},
            {"quote": {"USD": {"price": "NaN"}}},
            {"quote": {"USD": {"price": float("inf")}}},
            {"quote": {"USD": {"price": {"nested": 1}}}},
        ],
    )
    def test_refuses_a_row_without_essentials(self, overrides: dict[str, Any]) -> None:
        with pytest.raises(ValueError, match="no readable rows"):
            parsers.parse_listings(listing(row(**overrides)), NOW)

    @pytest.mark.parametrize("data", [None, {}, "x", 5, []])
    def test_garbage_is_an_error_never_an_empty_market(self, data: object) -> None:
        with pytest.raises(ValueError, match="listings response"):
            parsers.parse_listings({"data": data}, NOW)

    def test_a_non_finite_extra_figure_becomes_none(self) -> None:
        quote = {"USD": {"price": 5, "percent_change_24h": "inf", "market_cap": float("nan")}}
        asset = parsers.parse_listings(listing(row(quote=quote)), NOW).assets[0]
        assert asset.change_24h is None
        assert asset.market_cap is None

    def test_a_negative_market_cap_is_not_trusted(self) -> None:
        quote = {"USD": {"price": 5, "market_cap": -100, "volume_24h": -1}}
        asset = parsers.parse_listings(listing(row(quote=quote)), NOW).assets[0]
        assert asset.market_cap is None
        assert asset.volume_24h is None

    def test_text_is_cleaned_and_capped(self) -> None:
        hostile = "  Coin‮\x00\n\tName  " + "x" * 500
        asset = parsers.parse_listings(listing(row(name=hostile)), NOW).assets[0]
        assert asset.name.startswith("CoinName")
        assert "\x00" not in asset.name
        assert "‮" not in asset.name
        assert len(asset.name) <= parsers.MAX_TEXT

    def test_markup_in_a_name_stays_text(self) -> None:
        asset = parsers.parse_listings(listing(row(name="<img src=x onerror=alert(1)>")), NOW)
        assert asset.assets[0].name == "<img src=x onerror=alert(1)>"  # React escapes it

    def test_caps_the_number_of_rows_read(self) -> None:
        many = [
            row(cmc_rank=i, symbol=f"C{i}", slug=f"coin-{i}")
            for i in range(1, parsers.MAX_ROWS + 50)
        ]
        assert len(parsers.parse_listings(listing(*many), NOW).assets) == parsers.MAX_ROWS


class TestGlobalMetrics:
    def test_reads_the_totals(self) -> None:
        totals = parsers.parse_global(load("cmc_global.json"), NOW)
        assert totals.total_market_cap == Decimal("2450000000000.50")
        assert totals.total_volume_24h == Decimal("98000000000.00")
        assert totals.btc_dominance == Decimal("52.35")
        assert totals.eth_dominance == Decimal("17.80")
        assert totals.as_of == datetime(2026, 11, 3, 20, 0, tzinfo=UTC)

    def test_a_partly_empty_response_is_kept_with_nones(self) -> None:
        payload = load("cmc_global.json")
        payload["data"]["quote"]["USD"]["total_volume_24h"] = None
        assert parsers.parse_global(payload, NOW).total_volume_24h is None

    @pytest.mark.parametrize("data", [None, {}, [], {"quote": {}}, {"btc_dominance": "abc"}])
    def test_nothing_readable_is_an_error(self, data: object) -> None:
        with pytest.raises(ValueError, match="global metrics"):
            parsers.parse_global({"data": data}, NOW)


class TestFearGreed:
    def test_reads_the_index(self) -> None:
        index = parsers.parse_fear_greed(load("cmc_fear_greed.json"), NOW)
        assert (index.value, index.label) == (61, "Greed")
        assert index.as_of == datetime(2026, 11, 3, 19, 30, tzinfo=UTC)

    @pytest.mark.parametrize("value", [-1, 101, "abc", None, True, [], {}, float("nan")])
    def test_a_value_outside_zero_to_hundred_is_an_error(self, value: object) -> None:
        payload = load("cmc_fear_greed.json")
        payload["data"]["value"] = value
        with pytest.raises(ValueError, match="fear and greed"):
            parsers.parse_fear_greed(payload, NOW)

    def test_a_missing_label_is_an_error(self) -> None:
        payload = load("cmc_fear_greed.json")
        payload["data"]["value_classification"] = ""
        with pytest.raises(ValueError, match="fear and greed"):
            parsers.parse_fear_greed(payload, NOW)


class TestStatus:
    @pytest.mark.parametrize(
        ("status", "expected"),
        [
            ({"error_code": 0}, None),
            ({"error_code": 1002}, 1002),
            ({"error_code": "1008"}, 1008),
            ({"error_code": True}, None),
            ({"error_code": "oops"}, None),
            ({}, None),
        ],
    )
    def test_error_code(self, status: dict[str, Any], expected: int | None) -> None:
        assert parsers.error_code({"status": status}) == expected

    def test_error_code_with_no_status_at_all(self) -> None:
        assert parsers.error_code({}) is None
        assert parsers.error_code({"status": "weird"}) is None

    def test_credit_count(self) -> None:
        assert parsers.credit_count(load("cmc_listings.json")) == 1
        assert parsers.credit_count({"status": {"credit_count": True}}) is None
        assert parsers.credit_count({}) is None
