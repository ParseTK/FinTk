"""Database access: one engine per process, one short-lived session per unit of work.

The engine is built lazily by the application factory (only when a database URL is configured) and
opens no connection until the first query, so importing the app or running the unit tests never
needs a database.
"""

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import Settings

logger = logging.getLogger(__name__)


def create_engine(settings: Settings) -> AsyncEngine:
    if settings.database_url is None:
        msg = "VIRELLO_DATABASE_URL is not set"
        raise ValueError(msg)
    return create_async_engine(
        settings.database_url.get_secret_value(),
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_timeout=settings.db_pool_timeout_seconds,
        pool_recycle=settings.db_pool_recycle_seconds,
        # Test a pooled connection before handing it out, so a restarted database or a dropped
        # connection costs one cheap retry, not a failed request.
        pool_pre_ping=True,
        connect_args={
            "server_settings": {
                "application_name": "virello-api",
                "statement_timeout": str(settings.db_statement_timeout_ms),
                "idle_in_transaction_session_timeout": str(
                    settings.db_idle_in_transaction_timeout_ms
                ),
            },
            "timeout": settings.db_connect_timeout_seconds,  # connecting, not querying
        },
        echo=False,  # statements and parameters must never reach the logs
        hide_parameters=True,  # ...nor appear inside error messages, which are logged
    )


class Database:
    """Owns the engine and hands out sessions."""

    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine
        # expire_on_commit=False: objects stay readable after commit, no surprise refresh query.
        self._sessions = async_sessionmaker(engine, expire_on_commit=False)

    @property
    def engine(self) -> AsyncEngine:
        return self._engine

    @classmethod
    def from_settings(cls, settings: Settings) -> "Database":
        return cls(create_engine(settings))

    @asynccontextmanager
    async def session(self) -> AsyncGenerator[AsyncSession]:
        """One session, one transaction: committed on success, rolled back on any error."""
        async with self._sessions() as session, session.begin():
            yield session

    async def ping(self) -> None:
        async with self._engine.connect() as connection:
            await connection.execute(text("SELECT 1"))

    async def dispose(self) -> None:
        await self._engine.dispose()
