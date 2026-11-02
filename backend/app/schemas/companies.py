"""API response models for the company endpoints. Decimals serialize as strings, never floats."""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.domain.models import (
    CompanyProfile,
    CompanyRef,
    Filing,
    MetricSeries,
    PriceHistory,
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


class FinancialsResponse(ApiModel):
    ticker: str
    source: str
    metrics: list[MetricSeriesResponse]


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
