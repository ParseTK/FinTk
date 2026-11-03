"""API models for the watchlist and portfolio.

Money and quantities arrive as *strings*, never JSON numbers: 0.1 as a float is not 0.1, and a
portfolio built on that drifts. The pattern also bounds the size, so the value always fits the
database column, and requests reject unknown fields.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.domain.portfolio import (
    Holding,
    Lot,
    PortfolioValuation,
    Valuation,
    WatchlistEntry,
)

Symbol = Annotated[str, StringConstraints(pattern=r"^[A-Za-z]{1,6}([.-][A-Za-z]{1,2})?$")]
# NUMERIC(20, 6): up to 14 digits before the point, 6 after. A purchase price is NUMERIC(18, 6).
Shares = Annotated[str, StringConstraints(pattern=r"^\d{1,14}(\.\d{1,6})?$")]
UnitCost = Annotated[str, StringConstraints(pattern=r"^\d{1,12}(\.\d{1,6})?$")]
IdempotencyKey = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_-]{8,64}$")]


def _positive(value: str) -> Decimal:
    number = Decimal(value)
    if number <= 0:
        msg = "must be greater than zero"
        raise ValueError(msg)
    return number


class LotInput(BaseModel):
    """What the client sends to record or replace a purchase."""

    model_config = ConfigDict(extra="forbid")

    shares: Shares
    unit_cost: UnitCost = Field(description="Price paid per share, in US dollars.")
    acquired_on: date | None = None

    @field_validator("shares", "unit_cost")
    @classmethod
    def _must_be_positive(cls, value: str) -> str:
        _positive(value)
        return value

    @field_validator("acquired_on", mode="before")
    @classmethod
    def _iso_date_only(cls, value: object) -> object:
        # Lax date parsing also accepts timestamps and datetimes; a purchase date is a date.
        if value is not None and not (isinstance(value, str) and len(value) == 10):
            msg = "use a date like 2024-05-31"
            raise ValueError(msg)
        return value

    @property
    def shares_amount(self) -> Decimal:
        return Decimal(self.shares)

    @property
    def unit_cost_amount(self) -> Decimal:
        return Decimal(self.unit_cost)


class NewLotInput(LotInput):
    symbol: Symbol


class LotResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: uuid.UUID
    symbol: str
    shares: Decimal
    unit_cost: Decimal
    cost: Decimal = Field(description="Shares times price per share, to cents.")
    acquired_on: date | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_domain(cls, lot: Lot) -> Self:
        return cls(
            id=lot.id,
            symbol=lot.symbol,
            shares=lot.shares,
            unit_cost=lot.unit_cost,
            cost=lot.cost.quantize(Decimal("0.01")),
            acquired_on=lot.acquired_on,
            created_at=lot.created_at,
            updated_at=lot.updated_at,
        )


class LotsResponse(BaseModel):
    lots: list[LotResponse]


class HoldingValuationResponse(BaseModel):
    """Worth at the latest month-end close held, not a live quote."""

    model_config = ConfigDict(frozen=True)

    price: Decimal = Field(description="Closing price of the latest month held.")
    as_of: date = Field(description="Last day of that month.")
    market_value: Decimal = Field(description="Shares times price, to cents.")
    gain: Decimal = Field(description="Market value minus total paid, to cents.")
    gain_percent: Decimal = Field(description="Gain as a percentage of total paid.")

    @classmethod
    def from_domain(cls, valuation: Valuation) -> Self:
        return cls(
            price=valuation.price,
            as_of=valuation.as_of,
            market_value=valuation.market_value,
            gain=valuation.gain,
            gain_percent=valuation.gain_percent,
        )


class HoldingResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    symbol: str
    name: str | None
    shares: Decimal
    average_cost: Decimal = Field(description="Total paid divided by shares, six decimals.")
    cost_basis: Decimal = Field(description="Total paid, to cents.")
    lots: int
    valuation: HoldingValuationResponse | None = Field(
        default=None, description="Null when no price is held for this company yet."
    )

    @classmethod
    def from_domain(cls, holding: Holding, name: str | None) -> Self:
        return cls(
            symbol=holding.symbol,
            name=name,
            shares=holding.shares,
            average_cost=holding.average_cost,
            cost_basis=holding.cost_basis,
            lots=holding.lots,
            valuation=HoldingValuationResponse.from_domain(holding.valuation)
            if holding.valuation
            else None,
        )


class PortfolioValuationResponse(BaseModel):
    """Totals over the holdings that have a price. Others are left out and not guessed."""

    model_config = ConfigDict(frozen=True)

    market_value: Decimal
    gain: Decimal
    gain_percent: Decimal
    holdings_valued: int
    as_of: date = Field(description="Oldest month-end among the valued holdings.")
    source: str

    @classmethod
    def from_domain(cls, valuation: PortfolioValuation) -> Self:
        return cls(
            market_value=valuation.market_value,
            gain=valuation.gain,
            gain_percent=valuation.gain_percent,
            holdings_valued=valuation.holdings_valued,
            as_of=valuation.as_of,
            source=valuation.source,
        )


class PortfolioResponse(BaseModel):
    holdings: list[HoldingResponse]
    total_cost_basis: Decimal
    valuation: PortfolioValuationResponse | None = Field(
        default=None, description="Null until at least one holding has a price."
    )
    currency: str = "USD"


class WatchlistItemResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    symbol: str
    name: str | None
    added_at: datetime

    @classmethod
    def from_domain(cls, entry: WatchlistEntry, name: str | None) -> Self:
        return cls(symbol=entry.symbol, name=name, added_at=entry.added_at)


class WatchlistResponse(BaseModel):
    items: list[WatchlistItemResponse]
