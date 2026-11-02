import logging
from collections.abc import AsyncIterator
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import func, select

from app.auth.providers import build_oauth_providers
from app.auth.security import sign
from app.core.config import Settings
from app.db.engine import Database
from app.db.models import OAuthIdentity, User, UserSession
from app.main import create_app
from tests.conftest import make_settings
from tests.conftest import test_router as routes_for_tests
from tests.fake_idp import FakeIdentityProviders

ORIGIN = "http://localhost:3000"
SECRET_KEY = "k" * 48
AUTH = "/api/v1/auth"


def sign_in_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "github_client_id": "gh-id",
        "github_client_secret": "gh-secret-value",
        "google_client_id": "g-id",
        "google_client_secret": "g-secret-value",
        "secret_key": SECRET_KEY,
        "public_url": ORIGIN,
        **overrides,
    }
    return make_settings(**values)


@pytest.fixture
def idp() -> FakeIdentityProviders:
    return FakeIdentityProviders()


def build(settings: Settings, database: Database | None, idp: FakeIdentityProviders) -> FastAPI:
    return create_app(
        settings,
        extra_routers=[routes_for_tests],
        database=database,
        oauth_providers=build_oauth_providers(settings, idp.client()),
    )


def http(app: FastAPI) -> httpx.AsyncClient:
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    return httpx.AsyncClient(transport=transport, base_url=ORIGIN)


@pytest.fixture
async def client(
    database: Database, idp: FakeIdentityProviders
) -> AsyncIterator[httpx.AsyncClient]:
    async with http(build(sign_in_settings(), database, idp)) as c:
        yield c


def query(url: str) -> dict[str, str]:
    return {k: v[0] for k, v in parse_qs(urlsplit(url).query).items()}


async def start_login(
    client: httpx.AsyncClient, provider: str = "github", next_: str | None = "/portfolio"
) -> str:
    """Hit /login and return the state the provider would echo back."""
    params = {"next": next_} if next_ is not None else {}
    response = await client.get(f"{AUTH}/{provider}/login", params=params)
    assert response.status_code == 302
    return query(response.headers["location"])["state"]


async def sign_in(
    client: httpx.AsyncClient, provider: str = "github", next_: str | None = "/portfolio"
) -> httpx.Response:
    state = await start_login(client, provider, next_)
    return await client.get(f"{AUTH}/{provider}/callback", params={"code": "abc", "state": state})


async def csrf(client: httpx.AsyncClient) -> str:
    token = (await client.get(f"{AUTH}/session")).json()["csrf_token"]
    assert isinstance(token, str)
    return token


def unsafe_headers(token: str, origin: str = ORIGIN) -> dict[str, str]:
    return {"Origin": origin, "X-CSRF-Token": token}


# -- starting a login -----------------------------------------------------------------------------


async def test_login_redirects_to_the_provider_and_sets_a_signed_flow_cookie(
    client: httpx.AsyncClient,
) -> None:
    response = await client.get(f"{AUTH}/github/login")

    assert response.status_code == 302
    location = response.headers["location"]
    assert location.startswith("https://github.com/login/oauth/authorize?")
    params = query(location)
    assert params["redirect_uri"] == f"{ORIGIN}/api/v1/auth/github/callback"
    assert params["code_challenge_method"] == "S256"
    assert "gh-secret-value" not in location
    cookie = response.headers["set-cookie"]
    assert "virello_oauth=" in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie


async def test_each_login_gets_a_fresh_state_and_challenge(client: httpx.AsyncClient) -> None:
    a = query((await client.get(f"{AUTH}/google/login")).headers["location"])
    b = query((await client.get(f"{AUTH}/google/login")).headers["location"])
    assert a["state"] != b["state"]
    assert a["code_challenge"] != b["code_challenge"]


async def test_a_provider_that_is_not_configured_does_not_exist(
    database: Database, idp: FakeIdentityProviders
) -> None:
    settings = make_settings(
        github_client_id="gh-id",
        github_client_secret="s",
        secret_key=SECRET_KEY,
        public_url=ORIGIN,
    )
    async with http(build(settings, database, idp)) as c:
        assert (await c.get(f"{AUTH}/google/login")).status_code == 404
        assert (await c.get(f"{AUTH}/google/callback")).status_code == 404
        assert (await c.get(f"{AUTH}/github/login")).status_code == 302


async def test_an_unknown_provider_name_is_rejected(client: httpx.AsyncClient) -> None:
    assert (await client.get(f"{AUTH}/facebook/login")).status_code == 422


# -- finishing a login ----------------------------------------------------------------------------


async def test_a_full_sign_in_creates_a_session_and_returns_to_the_requested_page(
    client: httpx.AsyncClient, database: Database
) -> None:
    response = await sign_in(client, next_="/portfolio")

    assert response.status_code == 302
    assert response.headers["location"] == "/portfolio"
    assert any("virello_session=" in c for c in response.headers.get_list("set-cookie"))
    me = await client.get("/api/v1/me")
    assert me.status_code == 200
    assert me.json()["email"] == "octo@example.com"
    async with database.session() as session:
        assert (
            await session.execute(select(func.count()).select_from(UserSession))
        ).scalar_one() == 1


async def test_google_sign_in_works_the_same_way(client: httpx.AsyncClient) -> None:
    assert (await sign_in(client, "google", "/")).headers["location"] == "/"
    assert (await client.get("/api/v1/me")).json()["email"] == "octo@example.com"


async def test_the_same_person_on_both_providers_is_one_account(
    client: httpx.AsyncClient, database: Database
) -> None:
    await sign_in(client, "github")
    await sign_in(client, "google")
    async with database.session() as session:
        users = (await session.execute(select(func.count()).select_from(User))).scalar_one()
        identities = (
            await session.execute(select(func.count()).select_from(OAuthIdentity))
        ).scalar_one()
    assert (users, identities) == (1, 2)


async def test_the_flow_cookie_is_single_use(client: httpx.AsyncClient) -> None:
    state = await start_login(client)
    first = await client.get(f"{AUTH}/github/callback", params={"code": "abc", "state": state})
    assert first.headers["location"] == "/portfolio"
    assert "virello_oauth=" in "".join(first.headers.get_list("set-cookie"))  # cleared

    client.cookies.delete("virello_session")
    replay = await client.get(f"{AUTH}/github/callback", params={"code": "abc", "state": state})
    assert replay.headers["location"] == "/sign-in?error=invalid"


async def test_a_wrong_state_is_refused_without_calling_the_provider(
    client: httpx.AsyncClient, idp: FakeIdentityProviders
) -> None:
    await start_login(client)
    response = await client.get(
        f"{AUTH}/github/callback", params={"code": "abc", "state": "forged"}
    )

    assert response.headers["location"] == "/sign-in?error=invalid"
    assert idp.requests == []  # the code was never exchanged
    assert (await client.get("/api/v1/me")).status_code == 401


async def test_a_callback_without_the_flow_cookie_is_refused(
    client: httpx.AsyncClient, idp: FakeIdentityProviders
) -> None:
    # Someone else's authorization code fed into this browser: no cookie, so no sign-in.
    response = await client.get(f"{AUTH}/github/callback", params={"code": "abc", "state": "x"})
    assert response.headers["location"] == "/sign-in?error=invalid"
    assert idp.requests == []


async def test_a_tampered_or_foreign_flow_cookie_is_refused(
    client: httpx.AsyncClient, idp: FakeIdentityProviders
) -> None:
    forged = sign({"s": "s", "v": "v", "p": "github", "n": "/"}, b"attacker-secret-" * 4)
    client.cookies.set("virello_oauth", forged)
    response = await client.get(f"{AUTH}/github/callback", params={"code": "abc", "state": "s"})
    assert response.headers["location"] == "/sign-in?error=invalid"
    assert idp.requests == []


async def test_a_flow_started_for_one_provider_cannot_finish_at_another(
    client: httpx.AsyncClient,
) -> None:
    state = await start_login(client, "github")
    response = await client.get(f"{AUTH}/google/callback", params={"code": "abc", "state": state})
    assert response.headers["location"] == "/sign-in?error=invalid"


async def test_the_person_cancelling_at_the_provider_lands_on_sign_in_with_a_reason(
    client: httpx.AsyncClient,
) -> None:
    state = await start_login(client)
    response = await client.get(
        f"{AUTH}/github/callback", params={"error": "access_denied", "state": state}
    )
    assert response.headers["location"] == "/sign-in?error=denied"


async def test_a_provider_without_a_verified_email_is_explained_not_a_crash(
    client: httpx.AsyncClient, idp: FakeIdentityProviders
) -> None:
    idp.github_emails = []
    response = await sign_in(client)
    assert response.headers["location"] == "/sign-in?error=unverified"
    assert (await client.get("/api/v1/me")).status_code == 401


async def test_a_rejected_code_and_a_provider_outage_are_reported_distinctly(
    client: httpx.AsyncClient, idp: FakeIdentityProviders
) -> None:
    idp.overrides["github.com/login/oauth/access_token"] = lambda _: httpx.Response(
        200, json={"error": "bad_verification_code"}
    )
    assert (await sign_in(client)).headers["location"] == "/sign-in?error=failed"

    idp.overrides["github.com/login/oauth/access_token"] = lambda _: httpx.Response(503)
    assert (await sign_in(client)).headers["location"] == "/sign-in?error=unavailable"


@pytest.mark.parametrize(
    "next_",
    ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "evil"],
)
async def test_the_next_parameter_cannot_redirect_off_site(
    client: httpx.AsyncClient, next_: str
) -> None:
    response = await sign_in(client, next_=next_)
    assert response.headers["location"] == "/"


# -- the session ----------------------------------------------------------------------------------


async def test_session_info_when_signed_out_lists_only_configured_providers(
    client: httpx.AsyncClient,
) -> None:
    body = (await client.get(f"{AUTH}/session")).json()
    assert body == {"user": None, "csrf_token": None, "providers": ["github", "google"]}


async def test_session_info_when_signed_in_has_the_user_and_a_csrf_token(
    client: httpx.AsyncClient,
) -> None:
    await sign_in(client)
    body = (await client.get(f"{AUTH}/session")).json()
    assert body["user"]["email"] == "octo@example.com"
    assert body["user"]["name"] == "Octo Cat"
    assert len(body["csrf_token"]) >= 40


async def test_session_responses_are_never_cached(client: httpx.AsyncClient) -> None:
    await sign_in(client)
    assert (await client.get(f"{AUTH}/session")).headers["cache-control"] == "no-store"
    assert (await client.get("/api/v1/me")).headers["cache-control"] == "no-store"


async def test_a_garbage_session_cookie_is_simply_signed_out(client: httpx.AsyncClient) -> None:
    for value in ("nonsense", "x" * 5000, "../../etc/passwd", ""):
        client.cookies.set("virello_session", value)
        assert (await client.get("/api/v1/me")).status_code == 401
    assert (await client.get(f"{AUTH}/session")).json()["user"] is None


async def test_me_requires_a_session(client: httpx.AsyncClient) -> None:
    response = await client.get("/api/v1/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


# -- logout and account deletion (CSRF) --------------------------------------------------------


async def test_logout_ends_the_session_and_clears_the_cookie(
    client: httpx.AsyncClient, database: Database
) -> None:
    await sign_in(client)
    token = await csrf(client)

    response = await client.post(f"{AUTH}/logout", headers=unsafe_headers(token))

    assert response.status_code == 204
    assert "virello_session=" in response.headers["set-cookie"]
    assert "Max-Age=0" in response.headers["set-cookie"]
    assert (await client.get("/api/v1/me")).status_code == 401
    async with database.session() as session:
        assert (
            await session.execute(select(func.count()).select_from(UserSession))
        ).scalar_one() == 0


@pytest.mark.parametrize(
    ("headers", "why"),
    [
        ({}, "no origin and no token"),
        ({"Origin": ORIGIN}, "origin but no token"),
        ({"X-CSRF-Token": "REAL"}, "token but no origin"),
        ({"Origin": "https://evil.example", "X-CSRF-Token": "REAL"}, "foreign origin"),
        ({"Origin": ORIGIN, "X-CSRF-Token": "wrong-token"}, "wrong token"),
        ({"Origin": ORIGIN + ".evil.example", "X-CSRF-Token": "REAL"}, "look-alike origin"),
        ({"Origin": "null", "X-CSRF-Token": "REAL"}, "sandboxed-frame origin"),
    ],
)
async def test_state_changing_requests_fail_csrf_checks(
    client: httpx.AsyncClient, headers: dict[str, str], why: str
) -> None:
    await sign_in(client)
    real = await csrf(client)
    sent = {k: (real if v == "REAL" else v) for k, v in headers.items()}

    for method, path in (("POST", f"{AUTH}/logout"), ("DELETE", "/api/v1/me")):
        response = await client.request(method, path, headers=sent)
        assert response.status_code == 403, why
        assert response.json()["error"]["code"] == "csrf_failed"

    assert (await client.get("/api/v1/me")).status_code == 200  # nothing happened


async def test_a_csrf_token_from_another_session_is_refused(
    database: Database, idp: FakeIdentityProviders
) -> None:
    app = build(sign_in_settings(), database, idp)
    async with http(app) as alice, http(app) as mallory:
        await sign_in(alice)
        await sign_in(mallory)
        mallory_token = await csrf(mallory)
        response = await alice.delete("/api/v1/me", headers=unsafe_headers(mallory_token))
        assert response.status_code == 403


async def test_deleting_my_account_removes_everything_and_signs_me_out(
    client: httpx.AsyncClient, database: Database
) -> None:
    await sign_in(client, "github")
    await sign_in(client, "google")
    token = await csrf(client)

    response = await client.delete("/api/v1/me", headers=unsafe_headers(token))

    assert response.status_code == 204
    assert (await client.get("/api/v1/me")).status_code == 401
    async with database.session() as session:
        for model in (User, OAuthIdentity, UserSession):
            assert (
                await session.execute(select(func.count()).select_from(model))
            ).scalar_one() == 0


async def test_state_changing_requests_without_a_session_are_401_not_403(
    client: httpx.AsyncClient,
) -> None:
    response = await client.delete("/api/v1/me", headers={"Origin": ORIGIN})
    assert response.status_code == 401


# -- production cookie hardening -----------------------------------------------------------------


async def test_production_cookies_are_secure_host_prefixed_and_scoped_to_the_whole_host(
    database: Database, idp: FakeIdentityProviders
) -> None:
    settings = sign_in_settings(environment="production", public_url="https://virello.example")
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(
            app=build(settings, database, idp), raise_app_exceptions=False
        ),
        base_url="https://virello.example",
    ) as c:
        login = await c.get(f"{AUTH}/github/login")
        flow = login.headers["set-cookie"]
        state = query(login.headers["location"])["state"]
        done = await c.get(f"{AUTH}/github/callback", params={"code": "abc", "state": state})
        session = next(v for v in done.headers.get_list("set-cookie") if "session" in v)

    for cookie in (flow, session):
        assert cookie.startswith("__Host-virello_")
        assert "Secure" in cookie
        assert "HttpOnly" in cookie
        assert "SameSite=lax" in cookie
        assert "Path=/" in cookie
        assert "Domain" not in cookie  # a Domain attribute would let sibling subdomains read it


# -- rate limiting and hygiene -----------------------------------------------------------------


async def test_login_endpoints_are_rate_limited_per_client(
    database: Database, idp: FakeIdentityProviders
) -> None:
    app = build(sign_in_settings(auth_requests_per_minute=3), database, idp)
    async with http(app) as c:
        statuses = [(await c.get(f"{AUTH}/github/login")).status_code for _ in range(5)]
        blocked = await c.get(f"{AUTH}/github/login")

    assert statuses == [302, 302, 302, 429, 429]
    assert blocked.json()["error"]["code"] == "rate_limited"
    assert 1 <= int(blocked.headers["retry-after"]) <= 60


async def test_a_forged_forwarded_for_header_cannot_dodge_the_limit_unless_a_proxy_is_trusted(
    database: Database, idp: FakeIdentityProviders
) -> None:
    app = build(sign_in_settings(auth_requests_per_minute=2), database, idp)
    async with http(app) as c:
        codes = [
            (
                await c.get(f"{AUTH}/github/login", headers={"X-Forwarded-For": f"9.9.9.{i}"})
            ).status_code
            for i in range(4)
        ]
    assert codes == [302, 302, 429, 429]  # not trusted, so the header is ignored


async def test_behind_a_trusted_proxy_clients_are_told_apart_by_the_proxy_appended_address(
    database: Database, idp: FakeIdentityProviders
) -> None:
    app = build(
        sign_in_settings(auth_requests_per_minute=1, trust_proxy_headers=True), database, idp
    )
    async with http(app) as c:
        # The rightmost entry is what our own proxy appended; the left one is client-controlled.
        first = await c.get(
            f"{AUTH}/github/login", headers={"X-Forwarded-For": "1.1.1.1, 10.0.0.1"}
        )
        spoofed = await c.get(
            f"{AUTH}/github/login", headers={"X-Forwarded-For": "2.2.2.2, 10.0.0.1"}
        )
        other = await c.get(
            f"{AUTH}/github/login", headers={"X-Forwarded-For": "1.1.1.1, 10.0.0.2"}
        )
    assert (first.status_code, spoofed.status_code, other.status_code) == (302, 429, 302)


async def test_codes_tokens_and_secrets_never_reach_the_logs(
    client: httpx.AsyncClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.DEBUG):
        await sign_in(client)
        await client.get("/api/v1/me")
        token = await csrf(client)
        await client.post(f"{AUTH}/logout", headers=unsafe_headers(token))
    logs = "\n".join(record.getMessage() for record in caplog.records)

    for secret in ("gh-secret-value", "fake-access-token", "code=abc", token, SECRET_KEY):
        assert secret not in logs


async def test_signing_in_is_unavailable_but_not_a_crash_when_no_database_is_configured(
    idp: FakeIdentityProviders,
) -> None:
    app = build(sign_in_settings(), None, idp)
    async with http(app) as c:
        state = await start_login(c)
        response = await c.get(f"{AUTH}/github/callback", params={"code": "abc", "state": state})
        assert response.status_code == 503
        assert (await c.get("/api/v1/me")).status_code == 503
