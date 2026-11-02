"""Sign-in providers (OAuth 2.0 authorization code + PKCE) behind one small interface.

We exchange the code ourselves, over TLS, and read the profile straight from the provider with the
access token we just received. We never keep that token: nothing here calls the provider again
after sign-in, so there is nothing to store, refresh or leak.
"""

import logging
from typing import Protocol, cast
from urllib.parse import urlencode

import httpx

from app.core.config import Settings
from app.core.errors import AppError, UpstreamError
from app.domain.accounts import ExternalProfile

logger = logging.getLogger(__name__)

TIMEOUT = httpx.Timeout(10.0, connect=5.0)
MAX_NAME = 200
MAX_EMAIL = 320
MAX_URL = 500


class SignInRejectedError(AppError):
    """The provider refused the code, or the profile cannot be used (e.g. no verified email)."""

    status_code = 400
    code = "sign_in_failed"
    default_message = "Sign-in could not be completed."


class EmailNotVerifiedError(SignInRejectedError):
    """The provider gave no email, or one it has not verified. We never trust such an address."""

    default_message = "A verified email address is required to sign in."


class OAuthProvider(Protocol):
    name: str

    def authorize_url(self, *, state: str, code_challenge: str, redirect_uri: str) -> str: ...

    async def fetch_profile(
        self, *, code: str, code_verifier: str, redirect_uri: str
    ) -> ExternalProfile: ...


def _clean(value: object, limit: int) -> str | None:
    return value.strip()[:limit] or None if isinstance(value, str) else None


def _https_url(value: object) -> str | None:
    url = _clean(value, MAX_URL)
    # Avatars are rendered in the page, so accept only plain https URLs.
    return url if url and url.startswith("https://") else None


class _HttpProvider:
    """Shared plumbing: one JSON request with a timeout and no leaking of provider details."""

    name: str

    def __init__(self, client: httpx.AsyncClient, client_id: str, client_secret: str) -> None:
        self._client = client
        self._client_id = client_id
        self._client_secret = client_secret

    async def _request(self, method: str, url: str, **kwargs: object) -> httpx.Response:
        try:
            return await self._client.request(method, url, timeout=TIMEOUT, **kwargs)  # type: ignore[arg-type]
        except httpx.TransportError as error:
            logger.warning("%s sign-in request failed: %s", self.name, type(error).__name__)
            msg = "The sign-in provider is not responding."
            raise UpstreamError(msg) from error

    async def _json(self, response: httpx.Response, *, what: str) -> dict[str, object]:
        if response.status_code >= 500:
            logger.warning("%s %s returned %s", self.name, what, response.status_code)
            msg = "The sign-in provider is not responding."
            raise UpstreamError(msg)
        try:
            payload = response.json()
        except ValueError:
            payload = None
        if response.status_code >= 400 or not isinstance(payload, dict):
            # Log the status only: bodies can echo the code or the client secret's hints.
            logger.info("%s %s rejected with %s", self.name, what, response.status_code)
            raise SignInRejectedError
        return payload  # type: ignore[return-value]

    async def _access_token(self, url: str, form: dict[str, str]) -> str:
        response = await self._request(
            "POST", url, data=form, headers={"Accept": "application/json"}
        )
        payload = await self._json(response, what="token exchange")
        token = payload.get("access_token")
        if not isinstance(token, str) or not token:  # GitHub answers 200 with {"error": ...}
            raise SignInRejectedError
        return token


class GitHubProvider(_HttpProvider):
    name = "github"
    AUTHORIZE = "https://github.com/login/oauth/authorize"
    TOKEN = "https://github.com/login/oauth/access_token"  # noqa: S105 - a URL, not a secret
    API = "https://api.github.com"

    def authorize_url(self, *, state: str, code_challenge: str, redirect_uri: str) -> str:
        query = urlencode(
            {
                "client_id": self._client_id,
                "redirect_uri": redirect_uri,
                "scope": "read:user user:email",
                "state": state,
                "code_challenge": code_challenge,
                "code_challenge_method": "S256",
            }
        )
        return f"{self.AUTHORIZE}?{query}"

    async def fetch_profile(
        self, *, code: str, code_verifier: str, redirect_uri: str
    ) -> ExternalProfile:
        token = await self._access_token(
            self.TOKEN,
            {
                "client_id": self._client_id,
                "client_secret": self._client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
                "code_verifier": code_verifier,
            },
        )
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "Virello",
        }
        user = await self._json(
            await self._request("GET", f"{self.API}/user", headers=headers), what="profile"
        )
        user_id = user.get("id")
        if not isinstance(user_id, int):
            raise SignInRejectedError
        email = await self._verified_email(headers)
        return ExternalProfile(
            provider=self.name,
            provider_user_id=str(user_id),
            email=email,
            email_verified=email is not None,
            name=_clean(user.get("name"), MAX_NAME) or _clean(user.get("login"), MAX_NAME),
            avatar_url=_https_url(user.get("avatar_url")),
        )

    async def _verified_email(self, headers: dict[str, str]) -> str | None:
        """The primary verified address. /user can show an unverified or hidden one, so ask."""
        response = await self._request("GET", f"{self.API}/user/emails", headers=headers)
        if response.status_code >= 500:
            msg = "The sign-in provider is not responding."
            raise UpstreamError(msg)
        raw: object = None
        if response.status_code == 200:
            try:
                raw = response.json()
            except ValueError:
                raw = None
        best: str | None = None
        items = cast("list[object]", raw) if isinstance(raw, list) else []
        for item in items:
            if not isinstance(item, dict):
                continue
            entry = cast("dict[str, object]", item)
            if entry.get("verified") is not True:
                continue
            email = _clean(entry.get("email"), MAX_EMAIL)
            if email is None:
                continue
            if entry.get("primary") is True:
                return email  # the primary verified address wins outright
            best = best or email
        return best


class GoogleProvider(_HttpProvider):
    name = "google"
    AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN = "https://oauth2.googleapis.com/token"  # noqa: S105 - a URL, not a secret
    USERINFO = "https://openidconnect.googleapis.com/v1/userinfo"

    def authorize_url(self, *, state: str, code_challenge: str, redirect_uri: str) -> str:
        query = urlencode(
            {
                "client_id": self._client_id,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": "openid email profile",
                "state": state,
                "code_challenge": code_challenge,
                "code_challenge_method": "S256",
                "prompt": "select_account",
            }
        )
        return f"{self.AUTHORIZE}?{query}"

    async def fetch_profile(
        self, *, code: str, code_verifier: str, redirect_uri: str
    ) -> ExternalProfile:
        token = await self._access_token(
            self.TOKEN,
            {
                "client_id": self._client_id,
                "client_secret": self._client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
                "code_verifier": code_verifier,
            },
        )
        info = await self._json(
            await self._request("GET", self.USERINFO, headers={"Authorization": f"Bearer {token}"}),
            what="profile",
        )
        subject = info.get("sub")
        if not isinstance(subject, str) or not subject:
            raise SignInRejectedError
        return ExternalProfile(
            provider=self.name,
            provider_user_id=subject[:64],
            email=_clean(info.get("email"), MAX_EMAIL),
            email_verified=info.get("email_verified") is True,
            name=_clean(info.get("name"), MAX_NAME),
            avatar_url=_https_url(info.get("picture")),
        )


def build_oauth_providers(
    settings: Settings, client: httpx.AsyncClient
) -> dict[str, OAuthProvider]:
    """The providers that are fully configured. A provider with no credentials does not exist."""
    providers: dict[str, OAuthProvider] = {}
    if settings.github_client_id and settings.github_client_secret:
        providers["github"] = GitHubProvider(
            client, settings.github_client_id, settings.github_client_secret.get_secret_value()
        )
    if settings.google_client_id and settings.google_client_secret:
        providers["google"] = GoogleProvider(
            client, settings.google_client_id, settings.google_client_secret.get_secret_value()
        )
    return providers
