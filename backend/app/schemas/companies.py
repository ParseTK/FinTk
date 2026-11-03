"""API response models for the company endpoints. Decimals serialize as strings, never floats."""

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.domain.models import (
    CompanyProfile,
    CompanyRef,
    Filing,
    MetricSeries,
    PriceHistory,
)
from app.domain.ratios import RatioSeries
from app.domain.seasonality import Seasonality

PRICE_RETURN_BASIS = (
    "Month-to-month change in the closing price, split-adjusted, dividends not included."
)


class ApiModel(BaseModel):
    model_config = ConfigDict(frozen=True)


class CompanySummary(ApiModel):
    ticker: str
    name: str
    exchange: str | None
    cik: str

    @classmethod
    def from_domain(cls, company: CompanyRef) -> "CompanySummary":
        return cls(
            ticker=company.ticker, name=company.name, exchange=company.exchange, cik=company.cik
        )


class SearchResponse(ApiModel):
    results: list[CompanySummary]


class CompanyProfileResponse(ApiModel):
    ticker: str
    name: str
    exchange: str | None
    cik: str
    sic: str | None
    industry: str | None
    fiscal_year_end: str | None
    category: str | None
    website: str | None

    @classmethod
    def from_domain(cls, profile: CompanyProfile) -> "CompanyProfileResponse":
        return cls(
            ticker=profile.ticker,
            name=profile.name,
            exchange=profile.exchange,
            cik=profile.cik,
            sic=profile.sic,
            industry=profile.industry,
            fiscal_year_end=profile.fiscal_year_end,
            category=profile.category,
            website=profile.website,
        )


class FilingResponse(ApiModel):
    accession_number: str
    form: str
    filed: date
    report_date: date | None
    description: str | None
    url: str

    @classmethod
    def from_domain(cls, filing: Filing) -> "FilingResponse":
        return cls(
            accession_number=filing.accession_number,
            form=filing.form,
            filed=filing.filed,
            report_date=filing.report_date,
            description=filing.description,
            url=filing.url,
        )


class FilingsResponse(ApiModel):
    filings: list[FilingResponse]


class AnnualValueResponse(ApiModel):
    period_end: date
    value: Decimal
    filed: date
    form: str


class MetricSeriesResponse(ApiModel):
    metric: str
    unit: str
    values: list[AnnualValueResponse]

    @classmethod
    def from_domain(cls, series: MetricSeries) -> "MetricSeriesResponse":
        return cls(
            metric=series.metric,
            unit=series.unit,
            values=[
                AnnualValueResponse(
                    period_end=v.period_end, value=v.value, filed=v.filed, form=v.form
                )
                for v in series.values
            ],
        )


class RatioValueResponse(ApiModel):
    period_end: date
    value: Decimal | None  # None: not available (missing input, or a divisor that is not positive)


class RatioSeriesResponse(ApiModel):
    ratio: str  # stable key, for example "gross_margin"
    label: str
    formula: str  # plain words, so the number can be checked
    unit: Literal["percent", "times"]  # percent points, or a plain multiple
    values: list[RatioValueResponse]  # newest first, the same fiscal years as the metrics

    @classmethod
    def from_domain(cls, series: RatioSeries) -> "RatioSeriesResponse":
        return cls(
            ratio=series.ratio,
            label=series.label,
            formula=series.formula,
            unit=series.unit,
            values=[
                RatioValueResponse(period_end=v.period_end, value=v.value) for v in series.values
            ],
        )


class FinancialsResponse(ApiModel):
    ticker: str
    source: str
    metrics: list[MetricSeriesResponse]
    # Worked out by us from the figures above. Added without changing anything else in v1.
    ratios: list[RatioSeriesResponse]


class MonthlyPriceResponse(ApiModel):
    month_end: date
    close: Decimal


class MonthlyPricesResponse(ApiModel):
    symbol: str
    source: str
    prices: list[MonthlyPriceResponse]

    @classmethod
    def from_domain(cls, history: PriceHistory) -> "MonthlyPricesResponse":
        return cls(
            symbol=history.symbol,
            source=history.source,
            prices=[
                MonthlyPriceResponse(month_end=p.month_end, close=p.close) for p in history.prices
            ],
        )


class YearMonth(ApiModel):
    year: int
    month: int


class SeasonalityYear(ApiModel):
    year: int
    # Twelve entries, January first. Percent points as strings (for example "-3.84"); null where
    # the month has no return (before the data starts, after it ends, or next to a gap).
    returns: list[Decimal | None]


class SeasonalityBest(ApiModel):
    year: int
    percent: Decimal


class SeasonalityMonth(ApiModel):
    month: int
    count: int
    average: Decimal
    median: Decimal
    positive: int
    win_rate: Decimal
    best: SeasonalityBest
    worst: SeasonalityBest


class SeasonalityResponse(ApiModel):
    symbol: str
    source: str
    basis: str  # what the numbers mean, shown with them
    start: YearMonth | None  # the first month of price data: the first return is the month after
    end: YearMonth | None
    years: list[SeasonalityYear]  # oldest first
    months: list[SeasonalityMonth]  # calendar order, only months with data

    @classmethod
    def from_domain(cls, result: Seasonality) -> "SeasonalityResponse":
        by_year: dict[int, list[Decimal | None]] = {}
        for item in result.returns:
            by_year.setdefault(item.year, [None] * 12)[item.month - 1] = item.percent
        return cls(
            symbol=result.symbol,
            source=result.source,
            basis=PRICE_RETURN_BASIS,
            start=YearMonth(year=result.first_month[0], month=result.first_month[1])
            if result.first_month
            else None,
            end=YearMonth(year=result.last_month[0], month=result.last_month[1])
            if result.last_month
            else None,
            years=[SeasonalityYear(year=y, returns=by_year[y]) for y in sorted(by_year)],
            months=[
                SeasonalityMonth(
                    month=s.month,
                    count=s.count,
                    average=s.average,
                    median=s.median,
                    positive=s.positive,
                    win_rate=s.win_rate,
                    best=SeasonalityBest(year=s.best.year, percent=s.best.percent),
                    worst=SeasonalityBest(year=s.worst.year, percent=s.worst.percent),
                )
                for s in result.stats
            ],
        )
