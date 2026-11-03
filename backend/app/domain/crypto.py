"""Cryptocurrency market data, as provider-independent models.

Money is ``Decimal``, never ``float``. Percentages are percent points (``2.5`` means +2.5%). A
figure a provider did not supply is ``None``: it is never guessed.
"""

from dataclasses import dataclass
from datetime import datetime
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


@dataclass(frozen=True, slots=True)
class FearGreed:
    value: int  # 0 (extreme fear) to 100 (extreme greed)
    label: str  # the provider's own wording, shown as published
    as_of: datetime
