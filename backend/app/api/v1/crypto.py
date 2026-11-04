from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from app.api.internal_deps import require_internal_caller
from app.core.errors import UnavailableError
from app.schemas.crypto import CryptoMarketsResponse, CryptoOverviewResponse
from app.services.crypto import CryptoService

# Vendor data is licensed only inside our own product, never as a standalone feed, so this router
# answers only calls that carry the internal token (our website server), never the open internet.
router = APIRouter(
    prefix="/crypto",
    tags=["crypto"],
    dependencies=[Depends(require_internal_caller)],
)


def get_crypto_service(request: Request) -> CryptoService:
    service: CryptoService | None = request.app.state.crypto_service
    if service is None:
        msg = "Crypto data is not configured on this server."
        raise UnavailableError(msg)
    return service


@router.get(
    "/overview",
    summary="Top coins by market capitalization, with market totals and Fear and Greed",
    description=(
        "For our own website only: requires the internal token. The response carries the "
        "attribution that must be shown with the data."
    ),
)
async def get_overview(
    service: Annotated[CryptoService, Depends(get_crypto_service)], response: Response
) -> CryptoOverviewResponse:
    overview = await service.overview()
    # Never stored by a shared cache: the vendor allows only temporary storage, and we hold it.
    response.headers["Cache-Control"] = "no-store"
    return CryptoOverviewResponse.from_domain(overview)


@router.get(
    "/markets",
    summary="How the crypto market is made up, and how the largest coins have done",
    description=(
        "For our own website only: requires the internal token. Composition of the market, and "
        "30 day, 90 day, year-to-date and past-year changes for the ten largest coins. The "
        "response carries the attribution that must be shown with the data."
    ),
)
async def get_markets(
    service: Annotated[CryptoService, Depends(get_crypto_service)], response: Response
) -> CryptoMarketsResponse:
    markets = await service.markets()
    # Never stored by a shared cache: the vendor allows only temporary storage, and we hold it.
    response.headers["Cache-Control"] = "no-store"
    return CryptoMarketsResponse.from_domain(markets)
