"""Dependencies shared by the watchlist and portfolio routers."""

import uuid
from typing import Annotated

from fastapi import Depends, Request

from app.api.auth_deps import CurrentAuth, get_settings_from
from app.api.deps import DbSession
from app.domain.portfolio import Lot
from app.repositories.portfolio import LotRepository, WatchlistRepository, lock_user
from app.services.companies import CompanyService
from app.services.portfolio import PortfolioService


def get_portfolio_service(session: DbSession, request: Request) -> PortfolioService:
    settings = get_settings_from(request)
    companies: CompanyService | None = request.app.state.company_service
    return PortfolioService(
        WatchlistRepository(session),
        LotRepository(session),
        companies,
        lambda user_id: lock_user(session, user_id),
        max_watchlist_items=settings.watchlist_max_items,
        max_lots=settings.portfolio_max_lots,
    )


PortfolioServiceDep = Annotated[PortfolioService, Depends(get_portfolio_service)]


async def owned_lot(lot_id: uuid.UUID, auth: CurrentAuth, service: PortfolioServiceDep) -> Lot:
    """The lot in the URL, if and only if it belongs to the signed-in user. Anyone else's, or one
    that does not exist, is the same 404: ids cannot be probed."""
    return await service.get_owned_lot(auth.user.id, lot_id)


OwnedLot = Annotated[Lot, Depends(owned_lot)]
