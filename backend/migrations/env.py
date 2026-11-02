"""Alembic environment: runs migrations over an async connection.

The database URL comes from the same validated settings as the app (``VIRELLO_DATABASE_URL``), so
there is one source of truth and no credentials in ``alembic.ini``. Tests can instead hand in an
open connection through ``config.attributes["connection"]``.
"""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import get_settings
from app.db import models  # noqa: F401  (importing registers every table on Base.metadata)
from app.db.base import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata

# Fail fast instead of queueing behind a long-running transaction and, in turn, blocking every
# query that queues behind the migration.
LOCK_TIMEOUT_MS = "5000"


def _url() -> str:
    url = get_settings().database_url
    if url is None:
        msg = "VIRELLO_DATABASE_URL is not set; cannot run migrations."
        raise RuntimeError(msg)
    return url.get_secret_value()


def _configure(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,  # notice a column changing type, not just appearing or vanishing
        compare_server_default=True,
    )


def _migrate(connection: Connection) -> None:
    _configure(connection)
    with context.begin_transaction():
        context.run_migrations()


async def _run_async() -> None:
    engine = create_async_engine(
        _url(),
        poolclass=pool.NullPool,
        connect_args={"server_settings": {"lock_timeout": LOCK_TIMEOUT_MS}},
    )
    try:
        async with engine.connect() as connection:
            await connection.run_sync(_migrate)
    finally:
        await engine.dispose()


def run_migrations_offline() -> None:
    """Emit SQL instead of running it: ``alembic upgrade head --sql`` (for review)."""
    context.configure(
        url=_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connection: Connection | None = config.attributes.get("connection")
    if connection is not None:
        _migrate(connection)
    else:
        asyncio.run(_run_async())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
