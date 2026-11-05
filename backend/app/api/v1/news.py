from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response

from app.core.errors import UnavailableError
from app.schemas.news import CryptoNewsResponse
from app.services.news import NewsService

router = APIRouter(tags=["news"])


def get_news_service(request: Request) -> NewsService:
    service: NewsService | None = request.app.state.news_service
    if service is None:
        msg = "News is not configured on this server."
        raise UnavailableError(msg)
    return service


Service = Annotated[NewsService, Depends(get_news_service)]


@router.get("/news/crypto", summary="Official crypto-related announcements and filings")
async def get_crypto_news(
    service: Service,
    response: Response,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> CryptoNewsResponse:
    response.headers["Cache-Control"] = "public, max-age=300"
    return CryptoNewsResponse.from_domain(await service.crypto_news(limit))
