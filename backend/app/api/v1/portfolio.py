from typing import Annotated, Any

from fastapi import APIRouter, Header, Query, Response

from app.api.auth_deps import CurrentAuth, WriteAuth
from app.api.portfolio_deps import OwnedLot, PortfolioServiceDep
from app.core.errors import ErrorResponse
from app.schemas.portfolio import (
    HoldingResponse,
    IdempotencyKey,
    LotInput,
    LotResponse,
    LotsResponse,
    NewLotInput,
    PortfolioResponse,
    PortfolioValuationResponse,
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

NOT_FOUND: dict[int | str, dict[str, Any]] = {
    404: {"model": ErrorResponse, "description": "No such purchase."}
}


@router.get("", summary="My holdings (one row per company, from its purchases)")
async def get_portfolio(auth: CurrentAuth, service: PortfolioServiceDep) -> PortfolioResponse:
    portfolio = await service.portfolio(auth.user.id)
    return PortfolioResponse(
        holdings=[
            HoldingResponse.from_domain(h, portfolio.names.get(h.symbol))
            for h in portfolio.holdings
        ],
        total_cost_basis=portfolio.total_cost_basis,
        valuation=PortfolioValuationResponse.from_domain(portfolio.valuation)
        if portfolio.valuation
        else None,
    )


@router.get("/lots", summary="My purchases, optionally for one company")
async def list_lots(
    auth: CurrentAuth,
    service: PortfolioServiceDep,
    symbol: Annotated[str | None, Query(min_length=1, max_length=10)] = None,
) -> LotsResponse:
    return LotsResponse(
        lots=[LotResponse.from_domain(lot) for lot in await service.lots(auth.user.id, symbol)]
    )


@router.post(
    "/lots",
    summary="Record a purchase",
    status_code=201,
    responses={
        200: {"model": LotResponse, "description": "Already recorded (same Idempotency-Key)."},
        404: {"model": ErrorResponse, "description": "No such company."},
        409: {"model": ErrorResponse, "description": "A limit was reached, or the key was reused."},
    },
)
async def create_lot(
    body: NewLotInput,
    auth: WriteAuth,
    service: PortfolioServiceDep,
    response: Response,
    idempotency_key: Annotated[
        IdempotencyKey | None,
        Header(
            description="Optional. Repeating a request with the same key returns the original "
            "purchase instead of adding another, so a double click or a retry is safe."
        ),
    ] = None,
) -> LotResponse:
    lot, created = await service.add_lot(
        auth.user.id,
        ticker=body.symbol,
        shares=body.shares_amount,
        unit_cost=body.unit_cost_amount,
        acquired_on=body.acquired_on,
        client_key=idempotency_key,
    )
    response.status_code = 201 if created else 200
    return LotResponse.from_domain(lot)


@router.put(
    "/lots/{lot_id}",
    summary="Replace a purchase",
    responses=NOT_FOUND,
)
async def replace_lot(
    body: LotInput, auth: WriteAuth, lot: OwnedLot, service: PortfolioServiceDep
) -> LotResponse:
    updated = await service.update_lot(
        auth.user.id,
        lot,
        shares=body.shares_amount,
        unit_cost=body.unit_cost_amount,
        acquired_on=body.acquired_on,
    )
    return LotResponse.from_domain(updated)


@router.delete("/lots/{lot_id}", summary="Delete a purchase", status_code=204, responses=NOT_FOUND)
async def delete_lot(auth: WriteAuth, lot: OwnedLot, service: PortfolioServiceDep) -> None:
    await service.delete_lot(auth.user.id, lot)
