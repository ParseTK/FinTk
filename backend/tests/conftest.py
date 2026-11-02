import os
from collections.abc import AsyncIterator, Awaitable, Callable, Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi import APIRouter, FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel, ConfigDict, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import text

from app.api.deps import DbSession
from app.core.config import Settings, get_settings
from app.core.errors import ConflictError, NotFoundError
from app.db.engine import Database
from app.main import create_app


class Item(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    name: str = Field(min_length=1, max_length=20)
    quantity: int = Field(ge=1)


# Routes that exist only in tests, to exercise every error path.
test_router = APIRouter(prefix="/__test")


@test_router.post("/items")
async def create_item(item: Item) -> Item:
    return item


@test_router.get("/missing")
async def missing() -> None:
    raise NotFoundError("No such thing.")


@test_router.get("/conflict")
async def conflict() -> None:
    raise ConflictError("Already exists.")


@test_router.get("/boom")
async def boom() -> None:
    raise RuntimeError("secret internal detail: db password is hunter2")


class IsolatedSettings(Settings):
    """Settings that never read the developer's real .env file."""

    model_config = SettingsConfigDict(env_file=None)


def make_settings(**overrides: object) -> IsolatedSettings:
    values: dict[str, object] = {
        "environment": "test",
        "sec_contact_email": "ops@example.test",  # not a real address
        **overrides,
    }
    return IsolatedSettings(**values)  # pyright: ignore[reportArgumentType]


@pytest.fixture
def settings() -> Settings:
    return make_settings()


@pytest.fixture
def app(settings: Settings) -> FastAPI:
    return create_app(settings, extra_routers=[test_router])


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    # raise_app_exceptions=False: an unexpected crash must come back as a response, as it does in
    # production, instead of re-raising inside the test.
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as http:
        yield http


ClientFactory = Callable[..., Awaitable[AsyncClient]]


@pytest.fixture
async def make_client() -> AsyncIterator[ClientFactory]:
    """Build a client for an app with non-default settings. All clients are closed afterwards."""
    opened: list[AsyncClient] = []

    async def factory(**settings_overrides: object) -> AsyncClient:
        app = create_app(make_settings(**settings_overrides), extra_routers=[test_router])
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        http = AsyncClient(transport=transport, base_url="http://test")
        opened.append(http)
        return http

    yield factory
    for http in opened:
        await http.aclose()


# -- Real Postgres ---------------------------------------------------------------------------------
#
# Database tests run against a real Postgres (VIRELLO_TEST_DATABASE_URL), never a fake: SQLite would
# not catch Postgres-specific behaviour (NUMERIC, ON CONFLICT, timeouts). Locally they skip when no
# database is configured; in CI a missing database is a failure, so they can never be skipped there.

BACKEND_DIR = Path(__file__).resolve().parent.parent


class TestDatabaseSettings(BaseSettings):
    __test__ = False  # not a test class, despite the name

    model_config = SettingsConfigDict(env_prefix="VIRELLO_", env_file=".env", extra="ignore")

    test_database_url: str | None = None


@pytest.fixture(scope="session")
def test_database_url() -> str:
    url = TestDatabaseSettings().test_database_url
    if url is None:
        if os.environ.get("CI"):
            pytest.fail("VIRELLO_TEST_DATABASE_URL must be set in CI: database tests may not skip.")
        pytest.skip("VIRELLO_TEST_DATABASE_URL is not set")
    assert url.rsplit("/", 1)[-1].endswith("_test"), "refusing to run tests on a non-test database"
    return url


def alembic_config() -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    return config


@pytest.fixture(scope="session")
def migrated_database(test_database_url: str) -> Iterator[str]:
    """The test database with every migration applied, so the tests exercise the migrations too."""
    previous = os.environ.get("VIRELLO_DATABASE_URL")
    os.environ["VIRELLO_DATABASE_URL"] = test_database_url
    get_settings.cache_clear()
    try:
        command.downgrade(alembic_config(), "base")
        command.upgrade(alembic_config(), "head")
        yield test_database_url
    finally:
        if previous is None:
            os.environ.pop("VIRELLO_DATABASE_URL", None)
        else:
            os.environ["VIRELLO_DATABASE_URL"] = previous
        get_settings.cache_clear()


@pytest.fixture
async def database(migrated_database: str) -> AsyncIterator[Database]:
    """A Database on the migrated test schema, emptied after every test."""
    db = Database.from_settings(make_settings(database_url=migrated_database))
    yield db
    async with db.session() as session:
        await session.execute(text("TRUNCATE price_series CASCADE"))
    await db.dispose()


@test_router.get("/db")
async def db_roundtrip(session: DbSession) -> dict[str, int]:
    return {"value": (await session.execute(text("SELECT 1"))).scalar_one()}


@test_router.get("/db-slow")
async def db_slow(session: DbSession) -> None:
    await session.execute(text("SELECT pg_sleep(5)"))
