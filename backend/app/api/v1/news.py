from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Request, Response

from app.core.errors import ErrorResponse, UnavailableError
from app.schemas.news import (
    NEWS_BASIS,
    CompanyNewsResponse,
    MarketNewsResponse,
    NewsItemResponse,
)
from app.services.news import NewsService

router = APIRouter(tags=["news"])


def get_news_service(request: Request) -> NewsService:
    service: NewsService | None = request.app.state.news_service
    if service is None:
        msg = "News is not configured on this server."
        raise UnavailableError(msg)
    return service


Service = Annotated[NewsService, Depends(get_news_service)]


@router.get("/news", summary="Official market-wide announcements")
async def get_market_news(
    service: Service,
    response: Response,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> MarketNewsResponse:
    response.headers["Cache-Control"] = "public, max-age=300"
    return MarketNewsResponse.from_domain(await service.market_news(limit))


@router.get(
    "/companies/{ticker}/news",
    summary="A company's recent SEC 8-K events",
    responses={404: {"model": ErrorResponse, "description": "No such company."}},
)
async def get_company_news(
    ticker: Annotated[str, Path(min_length=1, max_length=10)],
    service: Service,
    response: Response,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> CompanyNewsResponse:
    response.headers["Cache-Control"] = "public, max-age=300"
    items = await service.company_news(ticker, limit)
    return CompanyNewsResponse(
        ticker=ticker.upper(),
        basis=NEWS_BASIS,
        items=[NewsItemResponse.from_domain(item) for item in items],
    )
