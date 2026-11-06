"""The guards routes use, composed from the pieces that each do one job.

- ``CurrentAuth``: signed in (``session_deps``).
- ``CsrfProtectedAuth``: signed in and, for a state-changing request, CSRF-verified (``csrf``).
- ``WriteAuth``: all of that plus the per-person write limit (``limits``): the guard for writes.
"""

from typing import Annotated

from fastapi import Depends, Request

from app.api.csrf import verify_csrf
from app.api.limits import limit_writes
from app.api.session_deps import require_auth
from app.domain.accounts import AuthContext


async def write_access(
    request: Request, context: Annotated[AuthContext, Depends(verify_csrf)]
) -> AuthContext:
    """Signed in, CSRF-verified and under the per-user write limit."""
    limit_writes(request, str(context.user.id))
    return context


CurrentAuth = Annotated[AuthContext, Depends(require_auth)]
WriteAuth = Annotated[AuthContext, Depends(write_access)]
CsrfProtectedAuth = Annotated[AuthContext, Depends(verify_csrf)]
