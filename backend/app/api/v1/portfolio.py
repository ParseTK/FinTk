from typing import Annotated

from fastapi import APIRouter, Depends, Path, Response

from app.api.auth_deps import CurrentAuth, WriteAuth
from app.api.holdings_deps import HoldingsServiceDep
from app.api.internal_deps import require_internal_caller
from app.core.errors import ErrorResponse
from app.schemas.holdings import (
    HoldingSavedResponse,
    HoldingValueResponse,
    HoldInput,
    PortfolioResponse,
    TotalsResponse,
    attribution,
)

router = APIRouter(
    prefix="/portfolio",
    tags=["portfolio"],
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
    summary="My holdings, valued at today's prices",
    description=(
        "For our own website only: requires the internal token (the prices are licensed data) as "
        "well as a signed-in session. The gain counts only holdings that have a cost."
    ),
    dependencies=[Depends(require_internal_caller)],
)
async def get_portfolio(
    auth: CurrentAuth, service: HoldingsServiceDep, response: Response
) -> PortfolioResponse:
    view = await service.portfolio(auth.user.id)
    response.headers["Cache-Control"] = "no-store"
    return PortfolioResponse(
        attribution=attribution(),
        as_of=view.as_of,
        prices_available=view.prices_available,
        totals=TotalsResponse.from_domain(view.totals),
        holdings=[HoldingValueResponse.from_domain(v) for v in view.valuations],
    )


@router.put(
    "/{slug}",
    summary="Record how much of a coin I hold (replaces the earlier entry)",
    responses={
        404: {"model": ErrorResponse, "description": "A coin this site does not cover."},
        409: {"model": ErrorResponse, "description": "The portfolio is full."},
    },
)
async def hold_coin(
    slug: SlugPath,
    body: HoldInput,
    auth: WriteAuth,
    service: HoldingsServiceDep,
    response: Response,
) -> HoldingSavedResponse:
    holding, created = await service.hold(auth.user.id, slug, body.amount_value, body.cost_value)
    response.status_code = 201 if created else 200
    return HoldingSavedResponse.from_domain(holding)


@router.delete("/{slug}", summary="Remove a coin from my holdings", status_code=204)
async def release_coin(slug: SlugPath, auth: WriteAuth, service: HoldingsServiceDep) -> None:
    await service.release(auth.user.id, slug)
