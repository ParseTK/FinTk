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
    """A request-scoped session. Routes that never ask for one never touch the database.

    A connection is taken from the pool at the first query and held until the route returns, with
    a transaction open (Postgres ends one that sits idle for 10 s). So do slow outside I/O, such
    as a provider call, before the first query or after the session is no longer needed.
    """
    async with database.session() as session:
        yield session


# scope="function": the session's cleanup (the COMMIT) runs when the route function returns, before
# the response is sent. With the default scope it runs after the response has gone out, so a client
# could be told "signed in" (with its cookie) before the session row is committed, and a failed
# commit would be invisible to it. Measured against a real server, not assumed.
DbSession = Annotated[AsyncSession, Depends(get_session, scope="function")]
