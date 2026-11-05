from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Request, Response

from app.api.internal_deps import require_internal_caller
from app.core.errors import UnavailableError
from app.domain.crypto_search import MAX_QUERY
from app.schemas.crypto import (
    CoinDetailResponse,
    CoinSearchResponse,
    CryptoMarketsResponse,
    CryptoOverviewResponse,
)
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


@router.get(
    "/search",
    summary="Find a coin by name or symbol among the largest coins",
    description=(
        "For our own website only: requires the internal token. Matches come from the cached "
        "listing, so a search costs no provider call. The response carries the attribution."
    ),
)
async def search_coins(
    service: Annotated[CryptoService, Depends(get_crypto_service)],
    response: Response,
    q: Annotated[str, Query(min_length=1, max_length=MAX_QUERY)],
    limit: Annotated[int, Query(ge=1, le=20)] = 8,
) -> CoinSearchResponse:
    assets, as_of = await service.search(q, limit)
    response.headers["Cache-Control"] = "no-store"
    return CoinSearchResponse.from_domain(assets, as_of)


@router.get(
    "/coins/{slug}",
    summary="One coin's price, changes, market value and supply",
    description=(
        "For our own website only: requires the internal token. Only coins in the cached listing "
        "of the largest coins are known; anything else is a 404."
    ),
)
async def get_coin(
    service: Annotated[CryptoService, Depends(get_crypto_service)],
    response: Response,
    slug: Annotated[str, Path(pattern=r"^[a-z0-9][a-z0-9._-]{0,79}$")],
) -> CoinDetailResponse:
    asset, as_of = await service.coin(slug)
    response.headers["Cache-Control"] = "no-store"
    return CoinDetailResponse.from_domain(asset, as_of)
