"""API response models for the news endpoints."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict

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


class CompanyNewsResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    ticker: str
    basis: str
    items: list[NewsItemResponse]
