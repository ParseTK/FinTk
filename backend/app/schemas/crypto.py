"""API response models for the crypto endpoint.

Money and percentages are strings of exact decimals, never JSON numbers, and never in scientific
notation (a tiny coin price such as 0.0000001 must not arrive as ``1E-7``). The attribution
CoinMarketCap requires travels in every response so a page cannot forget to show it.
"""

from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, PlainSerializer

from app.domain.crypto import CryptoAsset, FearGreed, MarketTotals
from app.services.crypto import CryptoOverview

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
