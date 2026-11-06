"""Cookie names and attributes for sign-in. One place, so every cookie is hardened the same way.

All cookies are HttpOnly (scripts cannot read them) and SameSite=Lax (not sent on cross-site
POSTs). In production they are also Secure and use the ``__Host-`` prefix, which makes browsers
refuse a cookie that is not Secure, has a Domain, or is not scoped to the whole host, so a
sibling subdomain cannot plant one.
"""

from fastapi import Response

from app.core.config import Settings

FLOW_MAX_AGE_SECONDS = 600  # ten minutes to finish signing in at the provider


def session_cookie_name(settings: Settings) -> str:
    return "__Host-fintk_session" if settings.is_production else "fintk_session"


def flow_cookie_name(settings: Settings) -> str:
    return "__Host-fintk_oauth" if settings.is_production else "fintk_oauth"


def _set(response: Response, settings: Settings, name: str, value: str, max_age: int) -> None:
    response.set_cookie(
        name,
        value,
        max_age=max_age,
        path="/",
        secure=settings.is_production,
        httponly=True,
        samesite="lax",
    )


def set_session_cookie(response: Response, settings: Settings, token: str) -> None:
    # Lives as long as the hard limit; the server enforces the shorter idle limit.
    _set(
        response, settings, session_cookie_name(settings), token, settings.session_max_days * 86400
    )


def set_flow_cookie(response: Response, settings: Settings, value: str) -> None:
    _set(response, settings, flow_cookie_name(settings), value, FLOW_MAX_AGE_SECONDS)


def clear_cookie(response: Response, settings: Settings, name: str) -> None:
    response.delete_cookie(
        name, path="/", secure=settings.is_production, httponly=True, samesite="lax"
    )
