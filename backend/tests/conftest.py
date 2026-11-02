from collections.abc import AsyncIterator, Awaitable, Callable

import pytest
from fastapi import APIRouter, FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel, ConfigDict, Field
from pydantic_settings import SettingsConfigDict

from app.core.config import Settings
from app.core.errors import ConflictError, NotFoundError
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
