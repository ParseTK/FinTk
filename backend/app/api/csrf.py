"""CSRF protection for every state-changing request made with the session cookie."""

from typing import Annotated

from fastapi import Depends, Request

from app.api.deps import get_settings_from
from app.api.session_deps import require_auth
from app.auth.security import safe_equals
from app.core.config import Settings
from app.core.errors import AppError
from app.domain.accounts import AuthContext

CSRF_HEADER = "X-CSRF-Token"
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


class CsrfError(AppError):
    status_code = 403
    code = "csrf_failed"
    default_message = "The request could not be verified. Reload the page and try again."


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
