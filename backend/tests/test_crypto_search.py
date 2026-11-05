"""Coin search and the coin page: matching rules, the cached listing, parsing, and the routes."""

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.internal_deps import INTERNAL_TOKEN_HEADER
from app.core.errors import NotFoundError
from app.domain.crypto import CryptoAsset, CryptoListings
from app.domain.crypto_search import normalize, search_assets
from app.main import create_app
from app.providers.coinmarketcap import parsers
from app.services.crypto import FETCH_N, CryptoService
from tests.conftest import make_settings
from tests.test_cmc_parsers import NOW as PARSER_NOW
from tests.test_cmc_parsers import listing, row
from tests.test_crypto_service import NOW, FakeProvider

TOKEN = "t" * 40  # plainly not a real secret
HEADERS = {INTERNAL_TOKEN_HEADER: TOKEN}


def coin(rank: int, name: str, symbol: str, slug: str | None = None) -> CryptoAsset:
    return CryptoAsset(
        rank=rank,
        name=name,
        symbol=symbol,
        slug=slug or name.lower().replace(" ", "-"),
        price=Decimal(1),
        change_24h=None,
        change_7d=None,
        market_cap=None,
        volume_24h=None,
    )


COINS = [
    coin(1, "Bitcoin", "BTC"),
    coin(2, "Ethereum", "ETH"),
    coin(5, "XRP", "XRP"),
    coin(9, "Bitcoin Cash", "BCH"),
    coin(12, "Wrapped Bitcoin", "WBTC"),
    coin(30, "Ethereum Classic", "ETC"),
    coin(40, "Tether USDt", "USDT", "tether"),
]


def symbols(query: str, limit: int = 8) -> list[str]:
    return [a.symbol for a in search_assets(COINS, query, limit)]


class TestSearchRules:
    def test_an_exact_symbol_comes_first(self) -> None:
        assert symbols("btc")[0] == "BTC"
        assert symbols("etc")[0] == "ETC"  # not Ethereum, though it is the bigger coin

    def test_then_exact_names_then_prefixes_then_fragments_then_size(self) -> None:
        assert symbols("bitcoin") == ["BTC", "BCH", "WBTC"]
        assert symbols("ethereum") == ["ETH", "ETC"]

    def test_matching_ignores_case_and_extra_spaces(self) -> None:
        assert symbols("  BITCOIN   cash ") == ["BCH"]

    def test_a_single_letter_only_matches_the_start_of_a_name_or_symbol(self) -> None:
        assert symbols("c") == []  # "Bitcoin" contains one, but no name or symbol starts with it
        assert symbols("w") == ["WBTC"]

    def test_the_slug_is_searchable_too(self) -> None:
        assert symbols("tether") == ["USDT"]

    def test_limit_applies_and_nothing_matches_nothing(self) -> None:
        assert len(symbols("bit", limit=2)) == 2
        assert symbols("zzzz") == []

    @pytest.mark.parametrize("query", ["", "   ", "\t\n"])
    def test_an_empty_query_matches_nothing_never_everything(self, query: str) -> None:
        assert search_assets(COINS, query, 8) == []

    def test_a_zero_limit_matches_nothing(self) -> None:
        assert search_assets(COINS, "btc", 0) == []

    def test_wildcards_are_plain_text(self) -> None:
        assert symbols("%") == []
        assert symbols(".*") == []

    def test_the_query_is_capped(self) -> None:
        assert len(normalize("a" * 500)) == 40


class TestParsingTheExtraFigures:
    def test_reads_supply_and_the_hourly_change(self) -> None:
        quote = {"USD": {"price": 5, "percent_change_1h": -0.256, "fully_diluted_market_cap": 9e9}}
        data = row(
            quote=quote, circulating_supply=19_700_000.5, total_supply=19700000, max_supply=21e6
        )
        asset = parsers.parse_listings(listing(data), PARSER_NOW).assets[0]
        assert asset.change_1h == Decimal("-0.26")
        assert asset.circulating_supply == Decimal("19700000.5000")
        assert asset.max_supply == Decimal("21000000.0000")
        assert asset.fully_diluted_market_cap == Decimal("9000000000.0000000000")

    def test_a_missing_maximum_is_none_not_zero(self) -> None:
        asset = parsers.parse_listings(listing(row(max_supply=None)), PARSER_NOW).assets[0]
        assert asset.max_supply is None

    @pytest.mark.parametrize("bad", [-5, "abc", True, float("nan"), {"a": 1}])
    def test_untrustworthy_supply_becomes_none(self, bad: object) -> None:
        asset = parsers.parse_listings(listing(row(circulating_supply=bad)), PARSER_NOW).assets[0]
        assert asset.circulating_supply is None


class Counting(FakeProvider):
    def __init__(self) -> None:
        super().__init__()
        self.limits: list[int] = []

    async def listings(self, limit: int) -> CryptoListings:
        self.limits.append(limit)
        return await super().listings(limit)


async def test_search_and_coin_use_the_cached_listing_and_cost_no_extra_calls() -> None:
    provider = Counting()
    service = CryptoService(provider)
    await service.overview()
    hits, as_of = await service.search("example", 5)
    asset, _ = await service.coin("example-2")
    assert [a.rank for a in hits] == [1, 2, 3]
    assert asset.rank == 2
    assert as_of == NOW
    assert provider.calls["listings"] == 1
    assert provider.limits == [FETCH_N]  # one wide request serves overview, search and coin


async def test_the_overview_still_shows_only_the_top_few() -> None:
    provider = Counting()
    provider.rows = 60
    service = CryptoService(provider)
    assert len((await service.overview()).assets) == 25
    assert len((await service.search("example", 20))[0]) == 20
    assert (await service.coin("example-60"))[0].rank == 60


async def test_an_unknown_coin_is_not_found() -> None:
    service = CryptoService(FakeProvider())
    with pytest.raises(NotFoundError):
        await service.coin("no-such-coin")


def client() -> AsyncClient:
    app = create_app(
        make_settings(internal_api_token=TOKEN), crypto_service=CryptoService(FakeProvider())
    )
    return AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test"
    )


@pytest.mark.parametrize(
    "path", ["/api/v1/crypto/search?q=example", "/api/v1/crypto/coins/example-1"]
)
async def test_both_routes_refuse_callers_without_the_internal_token(path: str) -> None:
    async with client() as http:
        assert (await http.get(path)).status_code == 403
        assert (await http.get(path, headers={INTERNAL_TOKEN_HEADER: "u" * 40})).status_code == 403


async def test_search_returns_hits_with_the_attribution_and_no_store() -> None:
    async with client() as http:
        response = await http.get("/api/v1/crypto/search", params={"q": "exam"}, headers=HEADERS)
    assert response.status_code == 200
    body = response.json()
    assert [hit["slug"] for hit in body["results"]] == ["example-1", "example-2", "example-3"]
    assert set(body["results"][0]) == {"rank", "name", "symbol", "slug"}
    assert body["attribution"]["text"] == "Data provided by CoinMarketCap.com"
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize(
    "params", [{}, {"q": ""}, {"q": "x" * 41}, {"q": "a", "limit": 0}, {"q": "a", "limit": 21}]
)
async def test_search_rejects_a_bad_query_with_the_standard_error(
    params: dict[str, str | int],
) -> None:
    async with client() as http:
        response = await http.get("/api/v1/crypto/search", params=params, headers=HEADERS)
    assert response.status_code == 422
    assert "error" in response.json()


async def test_a_coin_page_has_the_documented_fields() -> None:
    async with client() as http:
        response = await http.get("/api/v1/crypto/coins/example-2", headers=HEADERS)
    assert response.status_code == 200
    body = response.json()
    assert body["symbol"] == "E2"
    assert body["price"] == "2"
    assert body["change_30d"] == "3.5"
    assert body["max_supply"] is None  # not sent by the provider: null, never zero
    assert set(body) == {
        "attribution",
        "as_of",
        "rank",
        "name",
        "symbol",
        "slug",
        "price",
        "change_1h",
        "change_24h",
        "change_7d",
        "change_30d",
        "change_90d",
        "market_cap",
        "fully_diluted_market_cap",
        "volume_24h",
        "circulating_supply",
        "total_supply",
        "max_supply",
    }
    assert datetime.fromisoformat(body["as_of"]) == NOW.astimezone(UTC)


@pytest.mark.parametrize("slug", ["no-such-coin", "bitcoin"])
async def test_an_unknown_coin_is_a_404(slug: str) -> None:
    async with client() as http:
        response = await http.get(f"/api/v1/crypto/coins/{slug}", headers=HEADERS)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


@pytest.mark.parametrize("slug", ["Has%20Spaces", "..%2F..%2Fetc", "UPPER", "-start", "a" * 81])
async def test_a_malformed_slug_is_rejected_before_any_lookup(slug: str) -> None:
    async with client() as http:
        response = await http.get(f"/api/v1/crypto/coins/{slug}", headers=HEADERS)
    assert response.status_code in {404, 422}
