"""The sign-in flow: what is remembered between sending a person to a provider and their return.

Starting a login puts a few values in a short-lived signed cookie. The callback must prove that the
person coming back is the browser that left: the state in the address has to equal the one in the
cookie. This module owns that contract (the cookie's shape and every check on it), so the routes
only carry requests in and redirects out. It has no web framework and no database, and the clock
is a parameter, so every check is unit-tested without a server.
"""

import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from app.auth.cookies import FLOW_MAX_AGE_SECONDS
from app.auth.security import (
    new_pkce_pair,
    new_state,
    safe_equals,
    safe_redirect_path,
    sign,
    verify,
)


@dataclass(frozen=True, slots=True)
class SignInFlow:
    state: str  # compared with the state the provider sends back
    verifier: str  # the PKCE secret that proves this browser started the login
    provider: str
    next_path: str  # where to go after signing in; a same-site path


def start_flow(provider: str, next_value: str | None) -> tuple[SignInFlow, str]:
    """A new flow, and the PKCE challenge to send to the provider."""
    verifier, challenge = new_pkce_pair()
    flow = SignInFlow(
        state=new_state(),
        verifier=verifier,
        provider=provider,
        next_path=safe_redirect_path(next_value),
    )
    return flow, challenge


def encode_flow(flow: SignInFlow, secret: bytes) -> str:
    """The signed cookie value. It holds nothing the provider or the person does not already see,
    except the verifier, which is useless without the authorization code."""
    return sign(
        {"s": flow.state, "v": flow.verifier, "p": flow.provider, "n": flow.next_path}, secret
    )


def read_flow(
    cookie: str | None,
    secret: bytes,
    *,
    provider: str,
    state: str | None,
    max_age_seconds: int = FLOW_MAX_AGE_SECONDS,
    clock: Callable[[], float] = time.time,
) -> SignInFlow | None:
    """The flow if the cookie is genuine, fresh, for this provider, and matches the returned state.

    Anything else is None: a missing, forged, expired or other-provider cookie, or a state that
    differs. The state comparison is what stops someone else's authorization code being fed into
    your session.
    """
    if not cookie or not state:
        return None
    payload = verify(cookie, secret, max_age_seconds=max_age_seconds, clock=clock)
    if payload is None:
        return None
    stored = _text(payload, "s")
    verifier = _text(payload, "v")
    if stored is None or verifier is None or payload.get("p") != provider:
        return None
    if not safe_equals(state, stored):
        return None
    return SignInFlow(
        state=stored,
        verifier=verifier,
        provider=provider,
        next_path=safe_redirect_path(_text(payload, "n")),
    )


def _text(payload: dict[str, Any], key: str) -> str | None:
    value = payload.get(key)
    return value if isinstance(value, str) else None
