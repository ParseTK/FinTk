"""Who is signed in: build the auth service for a request and read the session cookie.

Authentication answers "who is this?". Authorization ("may they touch this object?") is separate:
see ``app.core.authz``. Both are required on every endpoint that returns or changes user data.
"""

from datetime import timedelta
from typing import Annotated

from fastapi import Depends, Request

from app.api.deps import DbSession, get_settings_from
from app.auth.cookies import session_cookie_name
from app.core.errors import UnauthorizedError
from app.domain.accounts import AuthContext
from app.repositories.accounts import AccountRepository, SessionRepository
from app.services.auth import AuthService

MAX_TOKEN_LENGTH = 128  # a real token is far shorter: refuse the rest before hashing or querying


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
    if not token or len(token) > MAX_TOKEN_LENGTH:
        return None
    return await service.authenticate(token)


async def require_auth(
    context: Annotated[AuthContext | None, Depends(optional_auth)],
) -> AuthContext:
    if context is None:
        raise UnauthorizedError
    return context
