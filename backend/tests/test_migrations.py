from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import Connection, inspect

from app.db.base import Base
from app.db.engine import Database
from tests.conftest import alembic_config


def test_there_is_exactly_one_migration_head() -> None:
    # Two branches that both add a migration create two heads. Catch it here, not at deploy time.
    assert len(ScriptDirectory.from_config(alembic_config()).get_heads()) == 1


def test_the_migrations_form_one_unbroken_chain() -> None:
    revisions = list(ScriptDirectory.from_config(alembic_config()).walk_revisions())
    assert revisions[-1].down_revision is None  # back to the very first migration


async def test_the_models_and_the_migrations_agree(database: Database) -> None:
    # If this fails, a model changed without a migration: run
    # `uv run alembic revision --autogenerate -m "..."`, then read what it wrote.
    def diff(connection: Connection) -> list[object]:
        context = MigrationContext.configure(
            connection, opts={"compare_type": True, "compare_server_default": True}
        )
        return list(compare_metadata(context, Base.metadata))

    async with database.engine.connect() as connection:
        assert await connection.run_sync(diff) == []


async def test_the_schema_has_the_expected_tables_and_keys(database: Database) -> None:
    def describe(connection: Connection) -> tuple[set[str], list[str]]:
        inspector = inspect(connection)
        pk = inspector.get_pk_constraint("monthly_price")["constrained_columns"]
        return set(inspector.get_table_names()), pk

    async with database.engine.connect() as connection:
        tables, primary_key = await connection.run_sync(describe)

    assert {"price_series", "monthly_price"} <= tables
    assert primary_key == ["symbol", "month_end"]
