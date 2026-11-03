from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from app.core.errors import UnavailableError
from app.schemas.markets import MarketOverviewResponse
from app.services.markets import MarketService

router = APIRouter(prefix="/markets", tags=["markets"])


def get_market_service(request: Request) -> MarketService:
    service: MarketService | None = request.app.state.market_service
    if service is None:
        msg = "Market data is not configured on this server."
        raise UnavailableError(msg)
    return service


@router.get("/overview", summary="Index and sector performance from month-end closes")
async def get_overview(
    service: Annotated[MarketService, Depends(get_market_service)], response: Response
) -> MarketOverviewResponse:
    overview = await service.overview()
    # Short while rows are still missing, so they appear soon after the first fetch finishes.
    response.headers["Cache-Control"] = f"public, max-age={1800 if overview.complete else 30}"
    return MarketOverviewResponse.from_domain(overview)
