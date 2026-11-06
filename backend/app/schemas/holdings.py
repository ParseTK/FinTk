"""API models for the crypto watchlist and holdings.

Amounts and money arrive as *strings*, never JSON numbers: 0.1 as a float is not 0.1, and a
portfolio built on that drifts. The patterns also bound the size, so a value always fits its
database column, and requests reject unknown fields. Prices and values leave only through the
read endpoints, which our website server alone may call (see ``require_internal_caller``); the
write endpoints answer with what the person entered and nothing from the data provider.
"""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    StringConstraints,
    field_validator,
)

from app.domain.crypto import CryptoAsset
from app.domain.holdings import Holding, Totals, Valuation, WatchEntry, WatchRow
from app.schemas.crypto import ATTRIBUTION_TEXT, ATTRIBUTION_URL, AttributionResponse, PlainDecimal

# NUMERIC(30, 18): up to 12 digits before the point, 18 after. A cost is NUMERIC(18, 2).
# [0-9], not \d: in a Unicode-aware regex \d also matches the digits of other scripts (Arabic-Indic,
# fullwidth), which Decimal would then read as ordinary numbers. Money is plain ASCII digits only.
Amount = Annotated[str, StringConstraints(pattern=r"^[0-9]{1,12}(\.[0-9]{1,18})?$")]
Cost = Annotated[str, StringConstraints(pattern=r"^[0-9]{1,16}(\.[0-9]{1,2})?$")]

# A coin amount without the trailing zeros the database pads it with ("1.5", not "1.5000...").
Coins = Annotated[
    Decimal,
    PlainSerializer(
        lambda value: format(value.normalize(), "f"), return_type=str, when_used="json"
    ),
]


class HoldInput(BaseModel):
    """What the client sends to record (or replace) how much of a coin is held."""

    model_config = ConfigDict(extra="forbid")

    amount: Amount = Field(description="How many coins are held. Must be greater than zero.")
    cost: Cost | None = Field(
        default=None,
        description="Total US dollars paid for them, if known. Zero is allowed, for a gift.",
    )

    @field_validator("amount")
    @classmethod
    def _positive(cls, value: str) -> str:
        if Decimal(value) <= 0:
            msg = "must be greater than zero"
            raise ValueError(msg)
        return value

    @property
    def amount_value(self) -> Decimal:
        return Decimal(self.amount)

    @property
    def cost_value(self) -> Decimal | None:
        return None if self.cost is None else Decimal(self.cost)


class WatchSavedResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    slug: str
    added_at: datetime

    @classmethod
    def from_domain(cls, entry: WatchEntry) -> Self:
        return cls(slug=entry.slug, added_at=entry.added_at)


class HoldingSavedResponse(BaseModel):
    """A holding as entered. No prices: those come only from the read endpoint."""

    model_config = ConfigDict(frozen=True)

    slug: str
    amount: Coins
    cost: PlainDecimal | None
    updated_at: datetime

    @classmethod
    def from_domain(cls, holding: Holding) -> Self:
        return cls(
            slug=holding.slug,
            amount=holding.amount,
            cost=holding.cost,
            updated_at=holding.updated_at,
        )


class CoinQuoteResponse(BaseModel):
    """The coin's name and today's figures, for a row that could be priced."""

    model_config = ConfigDict(frozen=True)

    name: str
    symbol: str
    rank: int
    price: PlainDecimal  # US dollars
    change_24h: PlainDecimal | None  # percent points
    market_cap: PlainDecimal | None  # US dollars


def _quote(asset: CryptoAsset | None) -> CoinQuoteResponse | None:
    if asset is None:
        return None
    return CoinQuoteResponse(
        name=asset.name,
        symbol=asset.symbol,
        rank=asset.rank,
        price=asset.price,
        change_24h=asset.change_24h,
        market_cap=asset.market_cap,
    )


class WatchlistItemResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    slug: str
    added_at: datetime
    coin: CoinQuoteResponse | None  # None: not priced right now

    @classmethod
    def from_domain(cls, row: WatchRow) -> Self:
        return cls(slug=row.entry.slug, added_at=row.entry.added_at, coin=_quote(row.asset))


class WatchlistResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    attribution: AttributionResponse
    as_of: datetime | None  # when the prices were taken; None when they could not be loaded
    prices_available: bool
    items: list[WatchlistItemResponse]


class HoldingValueResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    slug: str
    amount: Coins
    cost: PlainDecimal | None
    updated_at: datetime
    coin: CoinQuoteResponse | None
    value: PlainDecimal | None  # US dollars, to cents
    gain: PlainDecimal | None  # value minus cost
    gain_percent: PlainDecimal | None

    @classmethod
    def from_domain(cls, valuation: Valuation) -> Self:
        holding = valuation.holding
        return cls(
            slug=holding.slug,
            amount=holding.amount,
            cost=holding.cost,
            updated_at=holding.updated_at,
            coin=_quote(valuation.asset),
            value=valuation.value,
            gain=valuation.gain,
            gain_percent=valuation.gain_percent,
        )


class TotalsResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    total_value: PlainDecimal
    priced: int
    unpriced: int
    # The gain covers only holdings that have a cost: cost and value_with_cost are over those.
    cost: PlainDecimal
    value_with_cost: PlainDecimal
    gain: PlainDecimal | None
    gain_percent: PlainDecimal | None

    @classmethod
    def from_domain(cls, totals: Totals) -> Self:
        return cls(
            total_value=totals.total_value,
            priced=totals.priced,
            unpriced=totals.unpriced,
            cost=totals.cost,
            value_with_cost=totals.value_with_cost,
            gain=totals.gain,
            gain_percent=totals.gain_percent,
        )


class PortfolioResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    attribution: AttributionResponse
    as_of: datetime | None
    prices_available: bool
    totals: TotalsResponse
    holdings: list[HoldingValueResponse]


def attribution() -> AttributionResponse:
    return AttributionResponse(text=ATTRIBUTION_TEXT, url=ATTRIBUTION_URL)
