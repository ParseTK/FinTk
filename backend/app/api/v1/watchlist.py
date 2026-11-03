from typing import Annotated

from fastapi import APIRouter, Path, Response

from app.api.auth_deps import CurrentAuth, WriteAuth
from app.api.portfolio_deps import PortfolioServiceDep
from app.core.errors import ErrorResponse
from app.schemas.portfolio import WatchlistItemResponse, WatchlistResponse

router = APIRouter(
    prefix="/watchlist",
    tags=["watchlist"],
    responses={
        401: {"model": ErrorResponse, "description": "Not signed in."},
        403: {"model": ErrorResponse, "description": "The request failed CSRF verification."},
        429: {"model": ErrorResponse, "description": "Too many requests."},
    },
)

SymbolPath = Annotated[
    str, Path(min_length=1, max_length=10, description="Ticker symbol, e.g. AAPL or BRK-B.")
]


@router.get("", summary="My watchlist")
async def get_watchlist(auth: CurrentAuth, service: PortfolioServiceDep) -> WatchlistResponse:
    watchlist = await service.watchlist(auth.user.id)
    return WatchlistResponse(
        items=[
            WatchlistItemResponse.from_domain(entry, watchlist.names.get(entry.symbol))
            for entry in watchlist.entries
        ]
    )


@router.put(
    "/{symbol}",
    summary="Add a company to my watchlist (safe to repeat)",
    responses={
        404: {"model": ErrorResponse, "description": "No such company."},
        409: {"model": ErrorResponse, "description": "The watchlist is full."},
    },
)
async def add_to_watchlist(
    symbol: SymbolPath, auth: WriteAuth, service: PortfolioServiceDep, response: Response
) -> WatchlistItemResponse:
    entry, created = await service.watch(auth.user.id, symbol)
    response.status_code = 201 if created else 200
    return WatchlistItemResponse.from_domain(entry, await service.name_of(entry.symbol))


@router.delete("/{symbol}", summary="Remove a company from my watchlist", status_code=204)
async def remove_from_watchlist(
    symbol: SymbolPath, auth: WriteAuth, service: PortfolioServiceDep
) -> None:
    await service.unwatch(auth.user.id, symbol)
