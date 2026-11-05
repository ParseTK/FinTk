from typing import Annotated

from fastapi import APIRouter, Depends, Path, Response

from app.api.auth_deps import CurrentAuth, WriteAuth
from app.api.holdings_deps import HoldingsServiceDep
from app.api.internal_deps import require_internal_caller
from app.core.errors import ErrorResponse
from app.schemas.holdings import (
    WatchlistItemResponse,
    WatchlistResponse,
    WatchSavedResponse,
    attribution,
)

router = APIRouter(
    prefix="/watchlist",
    tags=["watchlist"],
    responses={
        401: {"model": ErrorResponse, "description": "Not signed in."},
        403: {"model": ErrorResponse, "description": "The request failed CSRF verification."},
        429: {"model": ErrorResponse, "description": "Too many requests."},
    },
)

SlugPath = Annotated[
    str,
    Path(pattern=r"^[a-z0-9][a-z0-9._-]{0,79}$", description="The name of the coin in addresses."),
]


@router.get(
    "",
    summary="My watched coins, with today's prices",
    description=(
        "For our own website only: requires the internal token (the prices are licensed data) as "
        "well as a signed-in session. The response carries the attribution to show with them."
    ),
    dependencies=[Depends(require_internal_caller)],
)
async def get_watchlist(
    auth: CurrentAuth, service: HoldingsServiceDep, response: Response
) -> WatchlistResponse:
    view = await service.watchlist(auth.user.id)
    response.headers["Cache-Control"] = "no-store"
    return WatchlistResponse(
        attribution=attribution(),
        as_of=view.as_of,
        prices_available=view.prices_available,
        items=[WatchlistItemResponse.from_domain(row) for row in view.rows],
    )


@router.put(
    "/{slug}",
    summary="Watch a coin (safe to repeat)",
    responses={
        404: {"model": ErrorResponse, "description": "A coin this site does not cover."},
        409: {"model": ErrorResponse, "description": "The watchlist is full."},
    },
)
async def add_to_watchlist(
    slug: SlugPath, auth: WriteAuth, service: HoldingsServiceDep, response: Response
) -> WatchSavedResponse:
    entry, created = await service.watch(auth.user.id, slug)
    response.status_code = 201 if created else 200
    return WatchSavedResponse.from_domain(entry)


@router.delete("/{slug}", summary="Stop watching a coin", status_code=204)
async def remove_from_watchlist(
    slug: SlugPath, auth: WriteAuth, service: HoldingsServiceDep
) -> None:
    await service.unwatch(auth.user.id, slug)
