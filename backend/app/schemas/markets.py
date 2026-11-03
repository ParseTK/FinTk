"""API response models for the markets endpoint. Decimals serialize as strings, never floats."""

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.domain.markets import MarketRow
from app.schemas.companies import PRICE_RETURN_BASIS
from app.services.markets import MarketOverview


class MarketFiguresResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    as_of_year: int
    as_of_month: int
    last_month: Decimal | None
    year_to_date: Decimal | None
    trailing_12_months: Decimal | None
    annualized: Decimal | None
    since_year: int


class MarketRowResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    symbol: str
    name: str
    group: Literal["index", "sector"]
    # None while there is no data for it yet (it fills in on a later visit).
    figures: MarketFiguresResponse | None

    @classmethod
    def from_domain(cls, row: MarketRow) -> "MarketRowResponse":
        figures = row.figures
        group: Literal["index", "sector"] = "index" if row.instrument.group == "index" else "sector"
        return cls(
            symbol=row.instrument.symbol,
            name=row.instrument.name,
            group=group,
            figures=None
            if figures is None
            else MarketFiguresResponse(
                as_of_year=figures.as_of[0],
                as_of_month=figures.as_of[1],
                last_month=figures.last_month,
                year_to_date=figures.year_to_date,
                trailing_12_months=figures.trailing_12_months,
                annualized=figures.annualized,
                since_year=figures.since_year,
            ),
        )


class MarketOverviewResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    source: str
    basis: str
    rows: list[MarketRowResponse]

    @classmethod
    def from_domain(cls, overview: MarketOverview) -> "MarketOverviewResponse":
        return cls(
            source=overview.source,
            basis=PRICE_RETURN_BASIS,
            rows=[MarketRowResponse.from_domain(row) for row in overview.rows],
        )
