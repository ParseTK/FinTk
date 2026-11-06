"""Dependency that builds the holdings service for one request."""

from typing import Annotated

from fastapi import Depends

from app.api.deps import DbSession, get_crypto_service
from app.repositories.holdings import HoldingRepository, WatchRepository
from app.services.crypto import CryptoService
from app.services.holdings import HoldingsService


def get_holdings_service(
    session: DbSession, crypto: Annotated[CryptoService, Depends(get_crypto_service)]
) -> HoldingsService:
    return HoldingsService(session, WatchRepository(session), HoldingRepository(session), crypto)


HoldingsServiceDep = Annotated[HoldingsService, Depends(get_holdings_service)]
