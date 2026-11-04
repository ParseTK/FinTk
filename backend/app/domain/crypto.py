"""Cryptocurrency market data, as provider-independent models.

Money is ``Decimal``, never ``float``. Percentages are percent points (``2.5`` means +2.5%). A
figure a provider did not supply is ``None``: it is never guessed.
"""

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal


@dataclass(frozen=True, slots=True)
class CryptoAsset:
    rank: int  # by market capitalization, 1 is the largest
    name: str
    symbol: str
    slug: str  # the provider's URL-safe name, handy as a stable key
    price: Decimal  # US dollars
    change_24h: Decimal | None
    change_7d: Decimal | None
    market_cap: Decimal | None  # US dollars
    volume_24h: Decimal | None  # US dollars
    # Added for the markets view, optional so nothing built earlier needs to know about them.
    cmc_id: int | None = None  # the provider's numeric id: unambiguous, unlike a symbol
    change_30d: Decimal | None = None
    change_90d: Decimal | None = None


@dataclass(frozen=True, slots=True)
class CryptoListings:
    assets: tuple[CryptoAsset, ...]  # ordered by rank
    as_of: datetime


@dataclass(frozen=True, slots=True)
class MarketTotals:
    total_market_cap: Decimal | None  # US dollars
    total_volume_24h: Decimal | None  # US dollars
    btc_dominance: Decimal | None  # percent of the total market capitalization
    eth_dominance: Decimal | None
    as_of: datetime
    # For the composition view: where the shares stood yesterday, and two groups that overlap the
    # coins above (stablecoins and DeFi tokens are also counted among them).
    total_market_cap_yesterday: Decimal | None = None
    btc_dominance_yesterday: Decimal | None = None
    eth_dominance_yesterday: Decimal | None = None
    stablecoin_market_cap: Decimal | None = None
    defi_market_cap: Decimal | None = None


@dataclass(frozen=True, slots=True)
class FearGreed:
    value: int  # 0 (extreme fear) to 100 (extreme greed)
    label: str  # the provider's own wording, shown as published
    as_of: datetime


@dataclass(frozen=True, slots=True)
class AnchorPrices:
    """The price of several coins at one past moment (00:00 UTC on ``on``), by the provider's id.

    Used to measure change since a fixed date: two of these (the start of the year and about a year
    ago) are all the history the markets view needs, which keeps the provider's credit cost tiny.
    """

    on: date
    prices: dict[int, Decimal]
