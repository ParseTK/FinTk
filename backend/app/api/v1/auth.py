"""Social sign-in: start, finish, inspect and end a session.

Flow: GET /auth/{provider}/login sets a signed, short-lived cookie holding the state and PKCE
verifier and redirects to the provider. The provider redirects to /auth/{provider}/callback, which
checks the state, exchanges the code, resolves the user, starts a session and redirects home. Every
failure redirects to /sign-in?error=... so a person never sees raw JSON mid-login.
"""

import logging
from typing import Annotated, Literal
from urllib.parse import urlencode, urlparse

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import RedirectResponse

from app.api.auth_deps import (
    AuthServiceDep,
    CsrfProtectedAuth,
    get_settings_from,
    limit_auth_requests,
    optional_auth,
)
from app.auth.cookies import (
    FLOW_MAX_AGE_SECONDS,
    clear_cookie,
    flow_cookie_name,
    session_cookie_name,
    set_flow_cookie,
    set_session_cookie,
)
from app.auth.providers import EmailNotVerifiedError, OAuthProvider, SignInRejectedError
from app.auth.security import (
    new_pkce_pair,
    new_state,
    safe_equals,
    safe_redirect_path,
    sign,
    verify,
)
from app.core.errors import ErrorResponse, NotFoundError, UnavailableError, UpstreamError
from app.domain.accounts import AuthContext
from app.schemas.auth import SessionResponse, UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
    responses={
        401: {"model": ErrorResponse, "description": "Not signed in."},
        403: {"model": ErrorResponse, "description": "The request failed CSRF verification."},
        429: {"model": ErrorResponse, "description": "Too many requests."},
    },
)

Provider = Literal["github", "google"]
REDIRECT_STATUS = 302


def _providers(request: Request) -> dict[str, OAuthProvider]:
    providers: dict[str, OAuthProvider] = request.app.state.oauth_providers
    return providers


def _provider(request: Request, name: str) -> OAuthProvider:
    provider = _providers(request).get(name)
    if provider is None:
        msg = "That sign-in method is not available."
        raise NotFoundError(msg)
    return provider


def _redirect_uri(request: Request, provider: str) -> str:
    base = get_settings_from(request).public_url or ""
    return f"{base}/api/v1/auth/{provider}/callback"


def _local_target(value: object) -> str:
    """The post-login destination, guaranteed to stay on this site.

    The value already passed `safe_redirect_path` when login started and is signed into the flow
    cookie, so it is trusted. This is a second, independent check at the point of use: a target with
    a host or a scheme is never followed, whatever produced it.
    """
    target = safe_redirect_path(value if isinstance(value, str) else None).replace("\\", "")
    if not urlparse(target).netloc and not urlparse(target).scheme:
        return target
    return "/"


def _failure(request: Request, reason: str) -> RedirectResponse:
    settings = get_settings_from(request)
    response = RedirectResponse(f"/sign-in?{urlencode({'error': reason})}", REDIRECT_STATUS)
    clear_cookie(response, settings, flow_cookie_name(settings))
    return response


@router.get("/session", summary="Who is signed in, and which sign-in methods exist")
async def get_session_info(
    request: Request, context: Annotated[AuthContext | None, Depends(optional_auth)]
) -> SessionResponse:
    providers = sorted(_providers(request))
    if context is None:
        return SessionResponse(user=None, csrf_token=None, providers=providers)
    return SessionResponse(
        user=UserResponse.from_domain(context.user),
        csrf_token=context.csrf_token,
        providers=providers,
    )


@router.get(
    "/{provider}/login",
    summary="Start signing in with a provider",
    status_code=REDIRECT_STATUS,
    response_class=RedirectResponse,
    dependencies=[Depends(limit_auth_requests)],
)
async def login(
    request: Request,
    provider: Provider,
    next: Annotated[str | None, Query(max_length=200)] = None,  # noqa: A002 - public query name
) -> RedirectResponse:
    settings = get_settings_from(request)
    oauth = _provider(request, provider)
    state = new_state()
    verifier, challenge = new_pkce_pair()
    flow = {"s": state, "v": verifier, "p": provider, "n": safe_redirect_path(next)}
    secret = _secret(request)
    response = RedirectResponse(
        oauth.authorize_url(
            state=state, code_challenge=challenge, redirect_uri=_redirect_uri(request, provider)
        ),
        REDIRECT_STATUS,
    )
    set_flow_cookie(response, settings, sign(flow, secret))
    return response


@router.get(
    "/{provider}/callback",
    summary="Finish signing in (the provider redirects here)",
    status_code=REDIRECT_STATUS,
    response_class=RedirectResponse,
    dependencies=[Depends(limit_auth_requests)],
)
async def callback(
    request: Request,
    provider: Provider,
    service: AuthServiceDep,
    code: Annotated[str | None, Query(max_length=2048)] = None,
    state: Annotated[str | None, Query(max_length=256)] = None,
    error: Annotated[str | None, Query(max_length=100)] = None,
) -> RedirectResponse:
    settings = get_settings_from(request)
    oauth = _provider(request, provider)

    cookie = request.cookies.get(flow_cookie_name(settings), "")
    flow = (
        verify(cookie, _secret(request), max_age_seconds=FLOW_MAX_AGE_SECONDS) if cookie else None
    )
    # The state in the URL must equal the one we put in the signed cookie for *this* browser.
    # This is what stops someone else's authorization code being fed into your session.
    if (
        flow is None
        or flow.get("p") != provider
        or not state
        or not isinstance(flow.get("s"), str)
        or not safe_equals(state, flow["s"])
    ):
        return _failure(request, "invalid")
    if error is not None or not code:
        return _failure(request, "denied")  # the person said no, or the provider refused

    try:
        profile = await oauth.fetch_profile(
            code=code,
            code_verifier=str(flow.get("v", "")),
            redirect_uri=_redirect_uri(request, provider),
        )
        token, _ = await service.sign_in(profile)
    except EmailNotVerifiedError:
        return _failure(request, "unverified")
    except SignInRejectedError:
        return _failure(request, "failed")
    except UpstreamError:
        return _failure(request, "unavailable")

    response = RedirectResponse(_local_target(flow.get("n")), REDIRECT_STATUS)
    clear_cookie(response, settings, flow_cookie_name(settings))
    set_session_cookie(response, settings, token)
    return response


@router.post("/logout", summary="Sign out", status_code=204)
async def logout(
    request: Request, response: Response, context: CsrfProtectedAuth, service: AuthServiceDep
) -> None:
    settings = get_settings_from(request)
    await service.sign_out(context.token_hash)
    clear_cookie(response, settings, session_cookie_name(settings))


def _secret(request: Request) -> bytes:
    key = get_settings_from(request).secret_key
    if key is None:
        msg = "Sign-in is not configured on this server."
        raise UnavailableError(msg)
    return key.get_secret_value().encode()
