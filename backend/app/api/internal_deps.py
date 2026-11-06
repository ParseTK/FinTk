"""Guard for routes that only our own website server may call.

Some vendors license their data "as part of your product, never on a standalone basis". The website
shows that data, but the API is a separate service that may be reachable on the internet, and a
public endpoint returning the raw data would be exactly the standalone feed the licence forbids.
So those routes require a shared secret that only the website server holds.

This is not user authentication. It says "this call came from our site", not who the visitor is.
"""

from fastapi import Request

from app.api.deps import get_settings_from
from app.auth.security import safe_equals
from app.core.errors import ForbiddenError

INTERNAL_TOKEN_HEADER = "X-Internal-Token"  # noqa: S105  (a header name, not a secret)
_MAX_TOKEN_LENGTH = 256  # cheap guard before comparing


async def require_internal_caller(request: Request) -> None:
    """Allow the call only if it carries the shared secret.

    With no secret configured the guard is open in development (so a developer can run the API
    alone) and closed everywhere else: forgetting to set it in production must never publish the
    data.
    """
    settings = get_settings_from(request)
    expected = settings.internal_api_token
    if expected is None:
        if settings.is_production:
            raise ForbiddenError
        return
    supplied = request.headers.get(INTERNAL_TOKEN_HEADER, "")
    if not supplied or len(supplied) > _MAX_TOKEN_LENGTH:
        raise ForbiddenError
    if not safe_equals(supplied, expected.get_secret_value()):
        raise ForbiddenError
