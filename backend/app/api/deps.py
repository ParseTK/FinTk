"""FastAPI dependencies shared by routers."""

from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import UnavailableError
from app.db.engine import Database


def get_database(request: Request) -> Database:
    database: Database | None = request.app.state.database
    if database is None:
        msg = "The database is not configured on this server."
        raise UnavailableError(msg)
    return database


async def get_session(
    database: Annotated[Database, Depends(get_database)],
) -> AsyncGenerator[AsyncSession]:
    """A request-scoped session. Routes that never ask for one never touch the database."""
    async with database.session() as session:
        yield session


DbSession = Annotated[AsyncSession, Depends(get_session)]
