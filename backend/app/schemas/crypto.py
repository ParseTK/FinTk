"""API response models for the crypto endpoint.

Money and percentages are strings of exact decimals, never JSON numbers, and never in scientific
notation (a tiny coin price such as 0.0000001 must not arrive as ``1E-7``). The attribution
CoinMarketCap requires travels in every response so a page cannot forget to show it.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, PlainSerializer

from app.domain.crypto import CryptoAsset, FearGreed, MarketTotals
from app.domain.crypto_markets import Composition, CompositionRow
from app.services.crypto import CryptoMarkets, CryptoOverview, MajorCoin

# A plain fixed-point string: ``format(value, "f")`` never uses an exponent.
PlainDecimal = Annotated[
    Decimal, PlainSerializer(lambda value: format(value, "f"), return_type=str, when_used="json")
]

ATTRIBUTION_TEXT = "Data provided by CoinMarketCap.com"
ATTRIBUTION_URL = "https://coinmarketcap.com/"


class AttributionResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    text: str
    url: str


class CryptoAssetResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    rank: int
    name: str
    symbol: str
    slug: str
    price: PlainDecimal  # US dollars
    change_24h: PlainDecimal | None  # percent points
    change_7d: PlainDecimal | None
    market_cap: PlainDecimal | None  # US dollars
    volume_24h: PlainDecimal | None  # US dollars

    @classmethod
    def from_domain(cls, asset: CryptoAsset) -> "CryptoAssetResponse":
        return cls(
            rank=asset.rank,
            name=asset.name,
            symbol=asset.symbol,
            slug=asset.slug,
            price=asset.price,
            change_24h=asset.change_24h,
            change_7d=asset.change_7d,
            market_cap=asset.market_cap,
            volume_24h=asset.volume_24h,
        )


class MarketTotalsResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    total_market_cap: PlainDecimal | None  # US dollars
    total_volume_24h: PlainDecimal | None  # US dollars
    btc_dominance: PlainDecimal | None  # percent
    eth_dominance: PlainDecimal | None  # percent

    @classmethod
    def from_domain(cls, totals: MarketTotals) -> "MarketTotalsResponse":
        return cls(
            total_market_cap=totals.total_market_cap,
            total_volume_24h=totals.total_volume_24h,
            btc_dominance=totals.btc_dominance,
            eth_dominance=totals.eth_dominance,
        )


class FearGreedResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    value: int  # 0 to 100
    label: str

    @classmethod
    def from_domain(cls, index: FearGreed) -> "FearGreedResponse":
        return cls(value=index.value, label=index.label)


class CryptoOverviewResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    attribution: AttributionResponse
    as_of: datetime
    assets: list[CryptoAssetResponse]
    totals: MarketTotalsResponse | None
    fear_greed: FearGreedResponse | None
    # Summaries that could not be loaded this time, so the page says so instead of looking complete.
    unavailable: list[str]

    @classmethod
    def from_domain(cls, overview: CryptoOverview) -> "CryptoOverviewResponse":
        return cls(
            attribution=AttributionResponse(text=ATTRIBUTION_TEXT, url=ATTRIBUTION_URL),
            as_of=overview.as_of,
            assets=[CryptoAssetResponse.from_domain(asset) for asset in overview.assets],
            totals=MarketTotalsResponse.from_domain(overview.totals) if overview.totals else None,
            fear_greed=(
                FearGreedResponse.from_domain(overview.fear_greed) if overview.fear_greed else None
            ),
            unavailable=list(overview.unavailable),
        )


class CompositionRowResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    key: Literal["bitcoin", "ethereum", "other", "stablecoins", "defi"]
    label: str
    share: PlainDecimal | None  # percent of the total market capitalization
    market_cap: PlainDecimal | None  # US dollars
    share_change: PlainDecimal | None  # percentage points since yesterday, when known
    # True for a group that is also counted among the coins above it (stablecoins, DeFi tokens), so
    # the rows must not be added up.
    overlaps: bool

    @classmethod
    def from_domain(cls, row: CompositionRow) -> "CompositionRowResponse":
        return cls(
            key=row.key,
            label=row.label,
            share=row.share,
            market_cap=row.market_cap,
            share_change=row.share_change,
            overlaps=row.overlaps,
        )


class CompositionResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    total_market_cap: PlainDecimal | None  # US dollars
    total_change_24h: PlainDecimal | None  # percent
    rows: list[CompositionRowResponse]

    @classmethod
    def from_domain(cls, value: Composition) -> "CompositionResponse":
        return cls(
            total_market_cap=value.total_market_cap,
            total_change_24h=value.total_change_24h,
            rows=[CompositionRowResponse.from_domain(row) for row in value.rows],
        )


class MajorCoinResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    rank: int
    name: str
    symbol: str
    slug: str
    price: PlainDecimal  # US dollars
    change_24h: PlainDecimal | None  # percent points, here and below
    change_7d: PlainDecimal | None
    change_30d: PlainDecimal | None
    change_90d: PlainDecimal | None
    change_year_to_date: PlainDecimal | None
    change_past_year: PlainDecimal | None

    @classmethod
    def from_domain(cls, coin: MajorCoin) -> "MajorCoinResponse":
        asset = coin.asset
        return cls(
            rank=asset.rank,
            name=asset.name,
            symbol=asset.symbol,
            slug=asset.slug,
            price=asset.price,
            change_24h=asset.change_24h,
            change_7d=asset.change_7d,
            change_30d=asset.change_30d,
            change_90d=asset.change_90d,
            change_year_to_date=coin.year_to_date,
            change_past_year=coin.past_year,
        )


class CryptoMarketsResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    attribution: AttributionResponse
    as_of: datetime
    composition: CompositionResponse | None
    majors: list[MajorCoinResponse]
    # The days the two long changes are measured from, so the page can say exactly what they mean.
    year_start: date | None
    past_year_start: date | None
    # Parts that could not be loaded this time, so the page says so instead of looking complete.
    unavailable: list[str]

    @classmethod
    def from_domain(cls, markets: CryptoMarkets) -> "CryptoMarketsResponse":
        return cls(
            attribution=AttributionResponse(text=ATTRIBUTION_TEXT, url=ATTRIBUTION_URL),
            as_of=markets.as_of,
            composition=(
                CompositionResponse.from_domain(markets.composition)
                if markets.composition
                else None
            ),
            majors=[MajorCoinResponse.from_domain(coin) for coin in markets.majors],
            year_start=markets.year_start,
            past_year_start=markets.past_year_start,
            unavailable=list(markets.unavailable),
        )


class CoinHitResponse(BaseModel):
    """One search result: just enough to show in a list and link to the coin's page."""

    model_config = ConfigDict(frozen=True)

    rank: int
    name: str
    symbol: str
    slug: str

    @classmethod
    def from_domain(cls, asset: CryptoAsset) -> "CoinHitResponse":
        return cls(rank=asset.rank, name=asset.name, symbol=asset.symbol, slug=asset.slug)


class CoinSearchResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    attribution: AttributionResponse
    as_of: datetime
    results: list[CoinHitResponse]

    @classmethod
    def from_domain(cls, assets: list[CryptoAsset], as_of: datetime) -> "CoinSearchResponse":
        return cls(
            attribution=AttributionResponse(text=ATTRIBUTION_TEXT, url=ATTRIBUTION_URL),
            as_of=as_of,
            results=[CoinHitResponse.from_domain(asset) for asset in assets],
        )


class CoinDetailResponse(BaseModel):
    """Everything the coin page shows. A figure the provider did not send is null, never zero."""

    model_config = ConfigDict(frozen=True)

    attribution: AttributionResponse
    as_of: datetime
    rank: int
    name: str
    symbol: str
    slug: str
    price: PlainDecimal  # US dollars
    change_1h: PlainDecimal | None  # percent points
    change_24h: PlainDecimal | None
    change_7d: PlainDecimal | None
    change_30d: PlainDecimal | None
    change_90d: PlainDecimal | None
    market_cap: PlainDecimal | None  # US dollars
    fully_diluted_market_cap: PlainDecimal | None
    volume_24h: PlainDecimal | None
    circulating_supply: PlainDecimal | None  # coins
    total_supply: PlainDecimal | None
    max_supply: PlainDecimal | None

    @classmethod
    def from_domain(cls, asset: CryptoAsset, as_of: datetime) -> "CoinDetailResponse":
        return cls(
            attribution=AttributionResponse(text=ATTRIBUTION_TEXT, url=ATTRIBUTION_URL),
            as_of=as_of,
            rank=asset.rank,
            name=asset.name,
            symbol=asset.symbol,
            slug=asset.slug,
            price=asset.price,
            change_1h=asset.change_1h,
            change_24h=asset.change_24h,
            change_7d=asset.change_7d,
            change_30d=asset.change_30d,
            change_90d=asset.change_90d,
            market_cap=asset.market_cap,
            fully_diluted_market_cap=asset.fully_diluted_market_cap,
            volume_24h=asset.volume_24h,
            circulating_supply=asset.circulating_supply,
            total_supply=asset.total_supply,
            max_supply=asset.max_supply,
        )
