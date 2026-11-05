import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.exc import TimeoutError as PoolTimeoutError

from app.core.config import Settings
from app.core.errors import is_database_unavailable
from app.db.engine import Database, create_engine
from app.main import create_app
from tests.conftest import make_settings
from tests.conftest import test_router as routes_for_tests

UNREACHABLE = "postgresql+asyncpg://u:p@127.0.0.1:1/none"


def test_the_engine_needs_a_database_url() -> None:
    with pytest.raises(ValueError, match="DATABASE_URL"):
        create_engine(make_settings())


def test_building_the_engine_opens_no_connection() -> None:
    # An unreachable address: this would hang or fail if creating the engine connected.
    engine = create_engine(make_settings(database_url=UNREACHABLE))
    assert engine.pool.checkedout() == 0  # type: ignore[attr-defined]


@pytest.mark.parametrize("url", ["postgresql://u:p@h/db", "mysql://u:p@h/db", "sqlite:///x.db"])
def test_only_the_async_postgres_driver_is_accepted(url: str) -> None:
    with pytest.raises(ValueError, match=r"postgresql\+asyncpg"):
        make_settings(database_url=url)


def test_the_database_url_never_appears_in_a_repr() -> None:
    settings = make_settings(database_url="postgresql+asyncpg://user:hunter2@h/db")
    assert "hunter2" not in repr(settings)
    assert "hunter2" not in str(settings)


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("db_pool_size", 0),
        ("db_pool_size", 500),
        ("db_pool_timeout_seconds", 0),
        ("db_statement_timeout_ms", 1),
    ],
)
def test_pool_limits_are_bounded(name: str, value: int) -> None:
    with pytest.raises(ValueError, match=name):
        make_settings(**{name: value})


async def test_a_session_commits_on_success_and_rolls_back_on_error(database: Database) -> None:
    async with database.session() as session:
        await session.execute(text("INSERT INTO user_account (email) VALUES ('ok@example.com')"))

    async def insert_then_fail() -> None:
        async with database.session() as session:
            await session.execute(
                text("INSERT INTO user_account (email) VALUES ('lost@example.com')")
            )
            raise RuntimeError

    with pytest.raises(RuntimeError):
        await insert_then_fail()

    async with database.session() as session:
        rows = (await session.execute(text("SELECT email FROM user_account"))).scalars().all()
    assert rows == ["ok@example.com"]


async def test_ping_succeeds_against_a_live_database(database: Database) -> None:
    await database.ping()


async def test_connections_carry_the_configured_server_side_limits(migrated_database: str) -> None:
    settings = make_settings(
        database_url=migrated_database,
        db_statement_timeout_ms=1234,
        db_idle_in_transaction_timeout_ms=4321,
    )
    db = Database.from_settings(settings)
    try:
        async with db.session() as session:

            async def show(name: str) -> object:
                return (await session.execute(text(f"SHOW {name}"))).scalar_one()

            observed = (
                await show("statement_timeout"),
                await show("idle_in_transaction_session_timeout"),
                await show("application_name"),
            )
    finally:
        await db.dispose()
    assert observed == ("1234ms", "4321ms", "virello-api")


async def test_a_runaway_query_is_cut_off_by_the_statement_timeout(migrated_database: str) -> None:
    db = Database.from_settings(
        make_settings(database_url=migrated_database, db_statement_timeout_ms=200)
    )
    try:
        with pytest.raises(DBAPIError):
            async with db.session() as session:
                await session.execute(text("SELECT pg_sleep(5)"))
    finally:
        await db.dispose()


# -- through the HTTP layer ------------------------------------------------------------------------


def app_with(database: Database | None, settings: Settings | None = None) -> FastAPI:
    return create_app(
        settings or make_settings(), extra_routers=[routes_for_tests], database=database
    )


async def get(app: FastAPI, path: str) -> httpx.Response:
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
        return await http.get(path)


async def test_a_route_can_use_the_request_scoped_session(database: Database) -> None:
    response = await get(app_with(database), "/__test/db")
    assert response.status_code == 200
    assert response.json() == {"value": 1}


async def test_a_route_that_needs_the_database_answers_503_when_none_is_configured() -> None:
    response = await get(app_with(None), "/__test/db")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "unavailable"


async def test_a_slow_query_becomes_a_503_not_a_hung_request(migrated_database: str) -> None:
    db = Database.from_settings(
        make_settings(database_url=migrated_database, db_statement_timeout_ms=200)
    )
    try:
        response = await get(app_with(db), "/__test/db-slow")
    finally:
        await db.dispose()
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "unavailable"
    assert "pg_sleep" not in response.text  # the SQL never reaches the client


async def test_readiness_reports_ready_when_the_database_is_up(database: Database) -> None:
    response = await get(app_with(database), "/readyz")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"


async def test_readiness_fails_fast_and_names_an_unreachable_database() -> None:
    dead = Database.from_settings(make_settings(database_url=UNREACHABLE))
    try:
        response = await get(app_with(dead), "/readyz")
    finally:
        await dead.dispose()
    assert response.status_code == 503
    assert response.json() == {"status": "not_ready", "failed": ["database"]}


# -- which database errors mean "unavailable" ----------------------------------------------------


class FakeDriverError(Exception):
    def __init__(self, sqlstate: str | None) -> None:
        super().__init__("driver error")
        self.sqlstate = sqlstate


def dbapi_error(sqlstate: str | None, *, invalidated: bool = False) -> DBAPIError:
    return DBAPIError(
        "SELECT 1", None, FakeDriverError(sqlstate), connection_invalidated=invalidated
    )


@pytest.mark.parametrize(
    "sqlstate",
    ["08006", "08001", "40001", "40P01", "53300", "57014", "57P01"],
)
def test_connection_resource_timeout_and_retryable_errors_are_unavailable(sqlstate: str) -> None:
    assert is_database_unavailable(dbapi_error(sqlstate))


@pytest.mark.parametrize("sqlstate", ["23505", "23514", "42601", "22003", "42P01", None])
def test_constraint_syntax_and_data_errors_are_bugs_not_outages(sqlstate: str | None) -> None:
    assert not is_database_unavailable(dbapi_error(sqlstate))


def test_an_invalidated_connection_and_pool_exhaustion_are_unavailable() -> None:
    assert is_database_unavailable(dbapi_error(None, invalidated=True))
    assert is_database_unavailable(PoolTimeoutError("pool exhausted"))


def test_unrelated_exceptions_are_not_database_outages() -> None:
    assert not is_database_unavailable(ValueError("nope"))
