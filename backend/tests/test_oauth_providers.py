from collections.abc import Callable
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest

from app.auth.providers import (
    GitHubProvider,
    GoogleProvider,
    SignInRejectedError,
    build_oauth_providers,
)
from app.core.errors import UpstreamError
from tests.conftest import make_settings
from tests.fake_idp import FakeIdentityProviders

Maker = Callable[[FakeIdentityProviders], GitHubProvider | GoogleProvider]
REDIRECT = "http://localhost:3000/api/v1/auth/github/callback"


@pytest.fixture
def idp() -> FakeIdentityProviders:
    return FakeIdentityProviders()


def github(idp: FakeIdentityProviders) -> GitHubProvider:
    return GitHubProvider(idp.client(), "client-id", "client-secret-value")


def google(idp: FakeIdentityProviders) -> GoogleProvider:
    return GoogleProvider(idp.client(), "client-id", "client-secret-value")


def query(url: str) -> dict[str, str]:
    return {k: v[0] for k, v in parse_qs(urlsplit(url).query).items()}


# -- authorize URLs ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("make", "host"),
    [(github, "github.com"), (google, "accounts.google.com")],
)
def test_the_authorize_url_carries_state_and_an_s256_challenge_but_no_secret(
    idp: FakeIdentityProviders, make: Maker, host: str
) -> None:
    provider = make(idp)
    url = provider.authorize_url(state="st4te", code_challenge="chal", redirect_uri=REDIRECT)

    assert urlsplit(url).netloc == host
    params = query(url)
    assert params["state"] == "st4te"
    assert params["code_challenge"] == "chal"
    assert params["code_challenge_method"] == "S256"
    assert params["redirect_uri"] == REDIRECT
    assert params["client_id"] == "client-id"
    assert "client-secret-value" not in url  # the secret only ever goes server to server


# -- GitHub ---------------------------------------------------------------------------------------


async def test_github_exchanges_the_code_with_the_verifier_and_reads_the_profile(
    idp: FakeIdentityProviders,
) -> None:
    profile = await github(idp).fetch_profile(
        code="the-code", code_verifier="ver1f1er", redirect_uri=REDIRECT
    )

    form = idp.form(0)
    assert form["code"] == "the-code"
    assert form["code_verifier"] == "ver1f1er"
    assert form["client_secret"] == "client-secret-value"
    assert profile.provider == "github"
    assert profile.provider_user_id == "4242"  # GitHub ids are numbers; we store text
    assert profile.name == "Octo Cat"
    assert profile.avatar_url == "https://avatars.example/octo.png"


async def test_github_uses_the_primary_verified_email_lowercased_by_the_service(
    idp: FakeIdentityProviders,
) -> None:
    profile = await github(idp).fetch_profile(code="c", code_verifier="v", redirect_uri=REDIRECT)
    assert profile.email == "Octo@Example.com"  # normalised later, in the service
    assert profile.email_verified is True


async def test_github_falls_back_to_a_non_primary_verified_email(
    idp: FakeIdentityProviders,
) -> None:
    idp.github_emails = [
        {"email": "unverified@example.com", "primary": True, "verified": False},
        {"email": "second@example.com", "primary": False, "verified": True},
    ]
    profile = await github(idp).fetch_profile(code="c", code_verifier="v", redirect_uri=REDIRECT)
    assert profile.email == "second@example.com"


@pytest.mark.parametrize(
    "emails",
    [[], [{"email": "x@example.com", "primary": True, "verified": False}], ["nonsense", 3, None]],
)
async def test_github_without_a_verified_email_reports_none(
    idp: FakeIdentityProviders, emails: list[object]
) -> None:
    idp.github_emails = emails  # type: ignore[assignment]
    profile = await github(idp).fetch_profile(code="c", code_verifier="v", redirect_uri=REDIRECT)
    assert profile.email is None
    assert profile.email_verified is False


async def test_github_scope_failure_on_the_emails_endpoint_means_no_email_not_a_crash(
    idp: FakeIdentityProviders,
) -> None:
    idp.overrides["api.github.com/user/emails"] = lambda _: httpx.Response(403)
    profile = await github(idp).fetch_profile(code="c", code_verifier="v", redirect_uri=REDIRECT)
    assert profile.email is None


async def test_github_answering_200_with_an_error_body_is_a_rejection(
    idp: FakeIdentityProviders,
) -> None:
    # GitHub reports a bad or reused code as HTTP 200 {"error": "bad_verification_code"}.
    idp.overrides["github.com/login/oauth/access_token"] = lambda _: httpx.Response(
        200, json={"error": "bad_verification_code"}
    )
    with pytest.raises(SignInRejectedError):
        await github(idp).fetch_profile(code="c", code_verifier="v", redirect_uri=REDIRECT)


async def test_github_profile_without_a_numeric_id_is_rejected(idp: FakeIdentityProviders) -> None:
    idp.github_user = {"login": "octo"}
    with pytest.raises(SignInRejectedError):
        await github(idp).fetch_profile(code="c", code_verifier="v", redirect_uri=REDIRECT)


# -- Google ---------------------------------------------------------------------------------------


async def test_google_exchanges_the_code_and_reads_the_userinfo(idp: FakeIdentityProviders) -> None:
    profile = await google(idp).fetch_profile(
        code="the-code", code_verifier="ver1f1er", redirect_uri=REDIRECT
    )

    form = idp.form(0)
    assert form["grant_type"] == "authorization_code"
    assert form["code_verifier"] == "ver1f1er"
    assert profile.provider == "google"
    assert profile.provider_user_id == "g-1001"
    assert profile.email == "octo@example.com"
    assert profile.email_verified is True


@pytest.mark.parametrize("claim", [False, "true", None, 1])
async def test_google_email_counts_as_verified_only_when_the_claim_is_exactly_true(
    idp: FakeIdentityProviders, claim: object
) -> None:
    idp.google_info = {**idp.google_info, "email_verified": claim}
    profile = await google(idp).fetch_profile(code="c", code_verifier="v", redirect_uri=REDIRECT)
    assert profile.email_verified is False


async def test_google_profile_without_a_subject_is_rejected(idp: FakeIdentityProviders) -> None:
    idp.google_info = {"email": "x@example.com", "email_verified": True}
    with pytest.raises(SignInRejectedError):
        await google(idp).fetch_profile(code="c", code_verifier="v", redirect_uri=REDIRECT)


# -- shared hardening -----------------------------------------------------------------------------


@pytest.mark.parametrize("make", [github, google])
async def test_untrusted_profile_fields_are_cleaned(
    idp: FakeIdentityProviders, make: Maker
) -> None:
    idp.github_user = {**idp.github_user, "name": "N" * 500, "avatar_url": "http://insecure/a.png"}
    idp.google_info = {**idp.google_info, "name": "N" * 500, "picture": "javascript:alert(1)"}
    profile = await make(idp).fetch_profile(code="c", code_verifier="v", redirect_uri=REDIRECT)
    assert profile.name is not None
    assert len(profile.name) == 200  # truncated
    assert profile.avatar_url is None  # only https avatars are accepted


@pytest.mark.parametrize("make", [github, google])
@pytest.mark.parametrize("status", [400, 401, 403])
async def test_a_refusal_from_the_provider_is_a_rejection(
    idp: FakeIdentityProviders, make: Maker, status: int
) -> None:
    idp.overrides["github.com/login/oauth/access_token"] = lambda _: httpx.Response(status)
    idp.overrides["oauth2.googleapis.com/token"] = lambda _: httpx.Response(status)
    with pytest.raises(SignInRejectedError):
        await make(idp).fetch_profile(code="c", code_verifier="v", redirect_uri=REDIRECT)


@pytest.mark.parametrize("make", [github, google])
async def test_a_provider_outage_is_an_upstream_error_not_a_rejection(
    idp: FakeIdentityProviders, make: Maker
) -> None:
    idp.overrides["github.com/login/oauth/access_token"] = lambda _: httpx.Response(503)
    idp.overrides["oauth2.googleapis.com/token"] = lambda _: httpx.Response(503)
    with pytest.raises(UpstreamError):
        await make(idp).fetch_profile(code="c", code_verifier="v", redirect_uri=REDIRECT)


@pytest.mark.parametrize("make", [github, google])
async def test_a_dropped_connection_is_an_upstream_error(
    idp: FakeIdentityProviders, make: Maker
) -> None:
    def broken(_: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("boom")

    idp.overrides["github.com/login/oauth/access_token"] = broken
    idp.overrides["oauth2.googleapis.com/token"] = broken
    with pytest.raises(UpstreamError):
        await make(idp).fetch_profile(code="c", code_verifier="v", redirect_uri=REDIRECT)


@pytest.mark.parametrize("make", [github, google])
async def test_a_non_json_reply_is_a_rejection(idp: FakeIdentityProviders, make: Maker) -> None:
    def html(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"<html>captive portal</html>")

    idp.overrides["github.com/login/oauth/access_token"] = html
    idp.overrides["oauth2.googleapis.com/token"] = html
    with pytest.raises(SignInRejectedError):
        await make(idp).fetch_profile(code="c", code_verifier="v", redirect_uri=REDIRECT)


def test_only_fully_configured_providers_are_built(idp: FakeIdentityProviders) -> None:
    none = build_oauth_providers(make_settings(), idp.client())
    only_github = build_oauth_providers(
        make_settings(
            github_client_id="id",
            github_client_secret="secret",
            secret_key="k" * 40,
            public_url="http://localhost:3000",
        ),
        idp.client(),
    )
    assert none == {}
    assert set(only_github) == {"github"}
