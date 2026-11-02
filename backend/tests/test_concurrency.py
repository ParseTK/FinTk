"""Races and contention, tested on purpose.

Each test here was written to fail against a real defect before the fix, so they guard against the
defect coming back: concurrent sign-ins, concurrent housekeeping, writes visible before the response
is sent, and many requests sharing a small connection pool.
"""

import asyncio
import time
from collections.abc import MutableMapping
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select, text
from starlette.types import Message, Scope

from app.db.engine import Database
from app.db.models import OAuthIdentity, User, UserSession
from app.domain.accounts import ExternalProfile
from app.main import create_app
from app.repositories.accounts import AccountRepository, SessionRepository
from app.services.auth import AuthService
from tests.conftest import make_settings
from tests.conftest import test_router as routes_for_tests
from tests.fake_idp import FakeIdentityProviders
from tests.test_auth_api import build, http, sign_in, sign_in_settings

IDLE = timedelta(days=30)
MAXIMUM = timedelta(days=90)


def profile(
    provider: str = "github", pid: str = "1", email: str = "racer@example.com"
) -> ExternalProfile:
    return ExternalProfile(provider, pid, email, True, "Racer", None)


async def sign_in_once(database: Database, who: ExternalProfile) -> str:
    """One sign-in in its own transaction, like one real callback request."""
    async with database.session() as session:
        service = AuthService(
            AccountRepository(session), SessionRepository(session), idle=IDLE, maximum=MAXIMUM
        )
        _, context = await service.sign_in(who)
        return str(context.user.id)


async def count(database: Database, model: type) -> int:
    async with database.session() as session:
        return (await session.execute(select(func.count()).select_from(model))).scalar_one()


# -- concurrent sign-ins ------------------------------------------------------------


async def test_many_simultaneous_first_sign_ins_for_one_person_make_one_account(
    database: Database,
) -> None:
    # A double-clicked button, or the provider redirecting twice: same person, same instant.
    ids = await asyncio.gather(*(sign_in_once(database, profile()) for _ in range(8)))

    assert len(set(ids)) == 1
    assert await count(database, User) == 1
    assert await count(database, OAuthIdentity) == 1
    assert await count(database, UserSession) == 8  # each browser still gets its own session


async def test_the_same_email_arriving_from_two_providers_at_once_is_still_one_account(
    database: Database,
) -> None:
    ids = await asyncio.gather(
        *(
            sign_in_once(database, profile("github", "1")),
            sign_in_once(database, profile("google", "g-1")),
            sign_in_once(database, profile("github", "1")),
            sign_in_once(database, profile("google", "g-1")),
        )
    )
    assert len(set(ids)) == 1
    assert await count(database, User) == 1
    assert await count(database, OAuthIdentity) == 2


# -- concurrent housekeeping ----------------------------------------------------


async def test_simultaneous_cleanups_neither_deadlock_nor_fail(database: Database) -> None:
    long_ago = datetime(2020, 1, 1, tzinfo=UTC)
    async with database.session() as session:
        user = await AccountRepository(session).get_or_create("cleanup@example.com", None, None)
        sessions = SessionRepository(session)
        for i in range(400):
            await sessions.create(
                token_hash=bytes([i % 256, i // 256]) * 16,
                user_id=user.id,
                csrf_token="c",
                expires_at=long_ago,
                absolute_expires_at=long_ago,
                now=long_ago,
            )

    async def cleanup() -> int:
        async with database.session() as session:
            return await SessionRepository(session).delete_expired(datetime.now(UTC), limit=100)

    removed = await asyncio.gather(*(cleanup() for _ in range(6)))

    assert sum(removed) == 400  # every row removed exactly once, no errors, no deadlock


# -- writes must be durable before the client hears "success" ------------------------------


async def test_a_write_is_committed_before_the_response_starts(database: Database) -> None:
    """The sign-in redirect carries the session cookie. If the response left before the commit, the
    browser could follow it and arrive before the session exists."""
    app = create_app(make_settings(), extra_routers=[routes_for_tests], database=database)
    committed_when_response_started: list[bool] = []

    async def receive() -> Message:
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message: MutableMapping[str, Any]) -> None:
        if message["type"] == "http.response.start":
            async with database.session() as session:
                visible = (
                    await session.execute(
                        text("SELECT count(*) FROM price_series WHERE symbol = 'RACE'")
                    )
                ).scalar_one()
            committed_when_response_started.append(visible == 1)

    scope: Scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "path": "/__test/db-write",
        "raw_path": b"/__test/db-write",
        "query_string": b"",
        "headers": [],
        "client": ("127.0.0.1", 1),
        "server": ("test", 80),
        "scheme": "http",
    }
    await app(scope, receive, send)

    assert committed_when_response_started == [True]


# -- one small pool, many requests -------------------------------------------------------------


async def test_many_concurrent_authenticated_requests_share_a_small_pool_without_failing(
    migrated_database: str,
) -> None:
    idp = FakeIdentityProviders()
    settings = sign_in_settings(database_url=migrated_database, db_pool_size=2, db_max_overflow=1)
    database = Database.from_settings(settings)
    try:
        app = build(settings, database, idp)
        async with http(app) as client:
            await sign_in(client)
            started = time.perf_counter()
            responses = await asyncio.gather(*(client.get("/api/v1/me") for _ in range(60)))
            elapsed = time.perf_counter() - started

        assert [r.status_code for r in responses] == [200] * 60
        assert elapsed < 5.0  # queued for the 3 connections, but no request starved
    finally:
        async with database.session() as session:
            await session.execute(text("TRUNCATE price_series, user_account CASCADE"))
        await database.dispose()


async def test_a_burst_of_sign_ins_through_the_http_layer_all_succeed(
    database: Database,
) -> None:
    idp = FakeIdentityProviders()
    app = build(sign_in_settings(auth_requests_per_minute=600), database, idp)

    async def one_browser() -> int:
        async with http(app) as client:
            return (await sign_in(client)).status_code

    codes = await asyncio.gather(*(one_browser() for _ in range(10)))

    assert codes == [302] * 10
    assert await count(database, User) == 1  # ten browsers, one person, one account
    assert await count(database, UserSession) == 10
