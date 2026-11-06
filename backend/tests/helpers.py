"""Test helpers: signed-in users without any OAuth, and an app with a fake SEC directory."""

import uuid
from dataclasses import dataclass
from datetime import timedelta

import httpx
from fastapi import FastAPI

from app.core.config import Settings
from app.db.engine import Database
from app.domain.accounts import ExternalProfile
from app.main import create_app
from app.providers.sec.client import SecProvider
from app.repositories.accounts import AccountRepository, SessionRepository
from app.services.auth import AuthService
from app.services.companies import CompanyService
from app.services.crypto import CryptoService
from tests.conftest import make_settings
from tests.conftest import test_router as routes_for_tests
from tests.test_sec_provider import NoWait, Upstream

ORIGIN = (
    "http://localhost:3000"  # in the default CORS allowlist, so it passes the CSRF origin check
)


def company_service() -> CompanyService:
    """Real company service over the recorded SEC fixtures: AAPL, MSFT, BRK-B and a few more."""
    sec = SecProvider(
        httpx.AsyncClient(transport=httpx.MockTransport(Upstream())),
        limiter=NoWait(),  # pyright: ignore[reportArgumentType]
        retry_delay=0,
    )
    return CompanyService(sec, sec)


def build_app(
    database: Database,
    settings: Settings | None = None,
    *,
    with_companies: bool = True,
    companies: CompanyService | None = None,
    crypto: CryptoService | None = None,
) -> FastAPI:
    return create_app(
        settings or make_settings(),
        extra_routers=[routes_for_tests],
        database=database,
        company_service=companies or (company_service() if with_companies else None),
        crypto_service=crypto,
    )


@dataclass
class Person:
    """A signed-in browser: a client holding the session cookie, plus its CSRF token."""

    client: httpx.AsyncClient
    csrf: str
    user_id: uuid.UUID

    async def get(self, path: str, **kwargs: object) -> httpx.Response:
        return await self.client.get(path, **kwargs)  # type: ignore[arg-type]

    async def send(
        self, method: str, path: str, *, csrf: bool = True, origin: bool = True, **kwargs: object
    ) -> httpx.Response:
        """A state-changing request, with the Origin and CSRF headers a real page would send."""
        headers: dict[str, str] = dict(kwargs.pop("headers", {}) or {})  # type: ignore[call-overload]
        if origin:
            headers["Origin"] = ORIGIN
        if csrf:
            headers["X-CSRF-Token"] = self.csrf
        return await self.client.request(method, path, headers=headers, **kwargs)  # type: ignore[arg-type]


async def sign_in_person(app: FastAPI, database: Database, email: str) -> Person:
    """Create (or find) a user and a real session, then return a client that carries it."""
    async with database.session() as session:
        service = AuthService(
            AccountRepository(session),
            SessionRepository(session),
            idle=timedelta(days=30),
            maximum=timedelta(days=90),
        )
        token, context = await service.sign_in(
            ExternalProfile("github", f"id-{email}", email, True, email.split("@")[0], None)
        )
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    client = httpx.AsyncClient(transport=transport, base_url=ORIGIN)
    client.cookies.set("fintk_session", token)
    return Person(client=client, csrf=context.csrf_token, user_id=context.user.id)


@dataclass
class World:
    app: FastAPI
    alice: Person
    bob: Person


async def make_world(
    database: Database,
    companies: CompanyService | None = None,
    crypto: CryptoService | None = None,
    **settings_overrides: object,
) -> World:
    """An app with two different signed-in people, for tests about who can see what."""
    app = build_app(
        database, make_settings(**settings_overrides), companies=companies, crypto=crypto
    )
    return World(
        app=app,
        alice=await sign_in_person(app, database, "alice@example.com"),
        bob=await sign_in_person(app, database, "bob@example.com"),
    )
