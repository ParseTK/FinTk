"""API response models for the news endpoints."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.domain.crypto_news import CRYPTO_COMPANIES, CRYPTO_TERMS, FILING_DAYS, PER_COMPANY_LIMIT
from app.domain.news import NewsItem
from app.services.news import MarketNews

NEWS_BASIS = (
    "Only what official sources published themselves: Federal Reserve and SEC announcements, and "
    "the SEC filings companies make. No opinions, summaries or forecasts."
)


class NewsItemResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    source: str
    kind: Literal["filing", "press_release"]
    title: str
    published: date
    url: str
    detail: str | None

    @classmethod
    def from_domain(cls, item: NewsItem) -> "NewsItemResponse":
        return cls(
            source=item.source,
            kind=item.kind,
            title=item.title,
            published=item.published,
            url=item.url,
            detail=item.detail,
        )


class MarketNewsResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    basis: str
    items: list[NewsItemResponse]
    # Sources that could not be read this time, so the page can say so rather than look complete.
    unavailable: list[str]

    @classmethod
    def from_domain(cls, news: MarketNews) -> "MarketNewsResponse":
        return cls(
            basis=NEWS_BASIS,
            items=[NewsItemResponse.from_domain(item) for item in news.items],
            unavailable=list(news.unavailable),
        )


CRYPTO_NEWS_BASIS = (
    "Only what official sources published themselves: SEC, CFTC and Department of Justice "
    "announcements whose headline contains one of the listed crypto terms, and the SEC filings "
    "(Form 8-K) of the listed crypto companies from the last "
    f"{FILING_DAYS} days, newest {PER_COMPANY_LIMIT} per company. "
    "No opinions, summaries or forecasts."
)


class CryptoNewsResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    basis: str
    # The two rules that decide what appears here, so the page can print them.
    terms: list[str]
    companies: list[str]
    filing_days: int
    per_company_limit: int
    items: list[NewsItemResponse]
    unavailable: list[str]

    @classmethod
    def from_domain(cls, news: MarketNews) -> "CryptoNewsResponse":
        return cls(
            basis=CRYPTO_NEWS_BASIS,
            terms=list(CRYPTO_TERMS),
            companies=list(CRYPTO_COMPANIES),
            filing_days=FILING_DAYS,
            per_company_limit=PER_COMPANY_LIMIT,
            items=[NewsItemResponse.from_domain(item) for item in news.items],
            unavailable=list(news.unavailable),
        )


class CompanyNewsResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    ticker: str
    basis: str
    items: list[NewsItemResponse]
