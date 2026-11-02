"""Authentication, CSRF and rate-limit dependencies for routers.

Authentication answers "who is this?". Authorization ("may they touch this object?") is separate:
see ``app.api.authz``. Both are required on every endpoint that returns or changes user data.
"""

from datetime import timedelta
from typing import Annotated

from fastapi import Depends, Request

from app.api.deps import DbSession
from app.auth.cookies import session_cookie_name
from app.auth.security import safe_equals
from app.core.config import Settings
from app.core.errors import AppError, RateLimitedError, UnauthorizedError
from app.core.rate_limit import KeyedRateLimiter
from app.domain.accounts import AuthContext
from app.repositories.accounts import AccountRepository, SessionRepository
from app.services.auth import AuthService

CSRF_HEADER = "X-CSRF-Token"
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


class CsrfError(AppError):
    status_code = 403
    code = "csrf_failed"
    default_message = "The request could not be verified. Reload the page and try again."


def get_settings_from(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def get_auth_service(session: DbSession, request: Request) -> AuthService:
    settings = get_settings_from(request)
    return AuthService(
        AccountRepository(session),
        SessionRepository(session),
        idle=timedelta(days=settings.session_idle_days),
        maximum=timedelta(days=settings.session_max_days),
    )


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


async def optional_auth(request: Request, service: AuthServiceDep) -> AuthContext | None:
    """The signed-in user, or None. A missing, unknown or expired cookie means 'not signed in'."""
    token = request.cookies.get(session_cookie_name(get_settings_from(request)))
    if not token or len(token) > 128:  # cheap guard before hashing and querying
        return None
    return await service.authenticate(token)


async def require_auth(
    context: Annotated[AuthContext | None, Depends(optional_auth)],
) -> AuthContext:
    if context is None:
        raise UnauthorizedError
    return context


def allowed_origins(settings: Settings) -> frozenset[str]:
    origins = set(settings.cors_origins)
    if settings.public_url:
        origins.add(settings.public_url)
    return frozenset(origins)


async def verify_csrf(
    request: Request, context: Annotated[AuthContext, Depends(require_auth)]
) -> AuthContext:
    """Guard for every state-changing request made with the session cookie.

    Layered on purpose: SameSite=Lax already withholds the cookie from cross-site POSTs; this adds
    an Origin allowlist (browsers always send Origin on POST) and a per-session secret token that a
    foreign site cannot read. Safe methods never change state, so they are not checked.
    """
    if request.method in SAFE_METHODS:
        return context
    origin = request.headers.get("origin")
    if origin is None or origin not in allowed_origins(get_settings_from(request)):
        raise CsrfError
    supplied = request.headers.get(CSRF_HEADER, "")
    if not supplied or not safe_equals(supplied, context.csrf_token):
        raise CsrfError
    return context


def client_key(request: Request) -> str:
    """Who is calling, for rate limiting."""
    if get_settings_from(request).trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            # The rightmost entry was appended by our own proxy; earlier ones are client-supplied.
            return forwarded.split(",")[-1].strip()[:64]
    return request.client.host if request.client else "unknown"


async def limit_auth_requests(request: Request) -> None:
    limiter: KeyedRateLimiter = request.app.state.auth_limiter
    retry_after = limiter.hit(client_key(request))
    if retry_after is not None:
        raise RateLimitedError(headers={"Retry-After": str(max(1, round(retry_after)))})


CurrentAuth = Annotated[AuthContext, Depends(require_auth)]
CsrfProtectedAuth = Annotated[AuthContext, Depends(verify_csrf)]
