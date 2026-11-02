from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.providers import EmailNotVerifiedError
from app.auth.security import hash_token
from app.db.engine import Database
from app.db.models import OAuthIdentity, User, UserSession
from app.domain.accounts import ExternalProfile
from app.repositories.accounts import AccountRepository, SessionRepository
from app.services.auth import EXTEND_AFTER, AuthService

IDLE = timedelta(days=30)
MAXIMUM = timedelta(days=90)
START = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)


class Clock:
    def __init__(self) -> None:
        self.now = START

    def __call__(self) -> datetime:
        return self.now


def profile(
    provider: str = "github",
    provider_user_id: str = "1",
    email: str | None = "Octo@Example.com",
    *,
    verified: bool = True,
    name: str | None = "Octo",
    avatar: str | None = "https://a.example/o.png",
) -> ExternalProfile:
    return ExternalProfile(provider, provider_user_id, email, verified, name, avatar)


def service(session: AsyncSession, clock: Clock) -> AuthService:
    return AuthService(
        AccountRepository(session),
        SessionRepository(session),
        idle=IDLE,
        maximum=MAXIMUM,
        clock=clock,
    )


async def count(session: AsyncSession, model: type) -> int:
    return (await session.execute(select(func.count()).select_from(model))).scalar_one()


async def test_a_first_sign_in_creates_the_user_identity_and_session(database: Database) -> None:
    clock = Clock()
    async with database.session() as session:
        token, context = await service(session, clock).sign_in(profile())

        assert context.user.email == "octo@example.com"  # lowercased
        assert context.user.name == "Octo"
        assert context.expires_at == START + IDLE
        assert context.absolute_expires_at == START + MAXIMUM
        assert await count(session, User) == 1
        assert await count(session, OAuthIdentity) == 1
        assert await count(session, UserSession) == 1
        assert await service(session, clock).authenticate(token) is not None


async def test_the_raw_token_is_never_stored(database: Database) -> None:
    async with database.session() as session:
        token, _ = await service(session, Clock()).sign_in(profile())
        stored = (await session.execute(select(UserSession.token_hash))).scalar_one()
        everything = (
            await session.execute(text("SELECT row_to_json(s)::text FROM user_session s"))
        ).scalar_one()

    assert stored == hash_token(token)
    assert token not in everything


async def test_signing_in_again_with_the_same_identity_reuses_the_user(database: Database) -> None:
    async with database.session() as session:
        svc = service(session, Clock())
        _, first = await svc.sign_in(profile())
        _, second = await svc.sign_in(profile())

        assert first.user.id == second.user.id
        assert await count(session, User) == 1
        assert await count(session, UserSession) == 2  # two browsers, two sessions


async def test_a_second_provider_with_the_same_verified_email_links_to_the_same_user(
    database: Database,
) -> None:
    async with database.session() as session:
        svc = service(session, Clock())
        _, via_github = await svc.sign_in(profile("github", "1"))
        _, via_google = await svc.sign_in(profile("google", "g-9", email="octo@example.com"))

        assert via_github.user.id == via_google.user.id
        assert await count(session, User) == 1
        assert await count(session, OAuthIdentity) == 2


@pytest.mark.parametrize(
    ("email", "verified"),
    [
        ("octo@example.com", False),  # exists, but the provider did not verify it
        (None, False),
        (None, True),
        ("", True),
        ("   ", True),
        ("not-an-email", True),
        ("a@b.co" + "x" * 400, True),  # absurdly long
    ],
)
async def test_an_unverified_or_unusable_email_is_refused(
    database: Database, email: str | None, verified: bool
) -> None:
    async with database.session() as session:
        with pytest.raises(EmailNotVerifiedError):
            await service(session, Clock()).sign_in(profile(email=email, verified=verified))
        assert await count(session, User) == 0
        assert await count(session, UserSession) == 0


async def test_an_unverified_email_cannot_take_over_an_existing_account(database: Database) -> None:
    # The classic takeover: sign up elsewhere with the victim's address, unverified.
    async with database.session() as session:
        svc = service(session, Clock())
        _, victim = await svc.sign_in(profile("github", "1", email="victim@example.com"))
        with pytest.raises(EmailNotVerifiedError):
            await svc.sign_in(
                profile("google", "attacker", email="victim@example.com", verified=False)
            )
        identities = (await session.execute(select(OAuthIdentity.provider))).scalars().all()
    assert identities == ["github"]
    assert victim.user.email == "victim@example.com"


async def test_a_returning_user_does_not_need_a_verified_email(database: Database) -> None:
    # Known identity: the provider's stable id is enough; the email is only used to link new ones.
    async with database.session() as session:
        svc = service(session, Clock())
        await svc.sign_in(profile())
        _, again = await svc.sign_in(profile(email=None, verified=False))
        assert again.user.email == "octo@example.com"


async def test_a_profile_fills_in_missing_details_but_never_overwrites(database: Database) -> None:
    async with database.session() as session:
        svc = service(session, Clock())
        await svc.sign_in(profile(name=None, avatar=None))
        await svc.sign_in(profile(name="First", avatar="https://a.example/1.png"))
        _, third = await svc.sign_in(profile(name="Second", avatar="https://a.example/2.png"))
        user = await session.get(User, third.user.id)
        await session.refresh(user)
    assert user is not None
    assert user.name == "First"
    assert user.avatar_url == "https://a.example/1.png"


async def test_an_unknown_token_is_not_authenticated(database: Database) -> None:
    async with database.session() as session:
        assert await service(session, Clock()).authenticate("nope") is None


async def test_a_session_expires_after_the_idle_limit(database: Database) -> None:
    clock = Clock()
    async with database.session() as session:
        svc = service(session, clock)
        token, _ = await svc.sign_in(profile())
        clock.now = START + IDLE + timedelta(seconds=1)  # a month of silence
        assert await svc.authenticate(token) is None


async def test_visits_slide_the_idle_limit_but_not_past_the_hard_limit(database: Database) -> None:
    clock = Clock()
    async with database.session() as session:
        svc = service(session, clock)
        token, _ = await svc.sign_in(profile())

        for _ in range(4):  # a visit every 25 days keeps the session alive...
            clock.now += timedelta(days=25)
            if clock.now >= START + MAXIMUM:
                break
            assert await svc.authenticate(token) is not None

        clock.now = START + MAXIMUM + timedelta(seconds=1)  # ...until the hard limit
        assert await svc.authenticate(token) is None


async def test_the_idle_limit_is_only_rewritten_about_once_an_hour(database: Database) -> None:
    clock = Clock()
    async with database.session() as session:
        svc = service(session, clock)
        token, _ = await svc.sign_in(profile())

        clock.now += EXTEND_AFTER - timedelta(minutes=1)
        await svc.authenticate(token)
        untouched = (await session.execute(select(UserSession.last_seen_at))).scalar_one()
        assert untouched == START  # a frequent visitor does not cause a write per request

        clock.now = START + EXTEND_AFTER + timedelta(minutes=1)
        await svc.authenticate(token)
        touched = (await session.execute(select(UserSession.last_seen_at))).scalar_one()
        assert touched == clock.now


async def test_signing_out_ends_only_that_session(database: Database) -> None:
    clock = Clock()
    async with database.session() as session:
        svc = service(session, clock)
        first, ctx = await svc.sign_in(profile())
        second, _ = await svc.sign_in(profile())

        await svc.sign_out(ctx.token_hash)

        assert await svc.authenticate(first) is None
        assert await svc.authenticate(second) is not None


async def test_deleting_the_account_removes_identities_and_sessions(database: Database) -> None:
    async with database.session() as session:
        svc = service(session, Clock())
        token, ctx = await svc.sign_in(profile())
        await svc.sign_in(profile("google", "g-1", email="octo@example.com"))

        assert await svc.delete_account(ctx.user.id) is True

        assert await count(session, User) == 0
        assert await count(session, OAuthIdentity) == 0
        assert await count(session, UserSession) == 0
        assert await svc.authenticate(token) is None
        assert await svc.delete_account(ctx.user.id) is False  # already gone


async def test_expired_sessions_are_cleaned_up_in_bounded_batches(database: Database) -> None:
    clock = Clock()
    async with database.session() as session:
        svc = service(session, clock)
        for i in range(5):
            await svc.sign_in(profile(provider_user_id=str(i), email=f"user{i}@example.com"))
        sessions = SessionRepository(session)

        clock.now = START + IDLE + timedelta(days=1)
        assert await sessions.delete_expired(clock.now, limit=3) == 3  # a bounded batch
        assert await sessions.delete_expired(clock.now, limit=3) == 2
        assert await sessions.delete_expired(clock.now, limit=3) == 0
