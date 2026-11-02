"""Small, dependency-free security primitives for sign-in. Everything here is pure and testable.

- Session tokens are 256 random bits. Only their SHA-256 is stored, so a leaked database cannot be
  replayed as logins. (A fast hash is right for high-entropy tokens; slow hashes are for passwords.)
- PKCE (RFC 7636, S256) binds the authorization code to the browser that started the login.
- The OAuth "flow" cookie carries state between redirect and callback. It is signed (HMAC-SHA256)
  and expires, so it cannot be forged or replayed later, and it holds nothing secret.
- Every comparison of secrets is constant-time.
"""

import base64
import binascii
import hashlib
import hmac
import json
import secrets
import time
from collections.abc import Callable, Mapping
from typing import Any, cast

TOKEN_BYTES = 32


def new_session_token() -> tuple[str, bytes]:
    """A fresh token for the cookie, and the hash to store."""
    token = secrets.token_urlsafe(TOKEN_BYTES)
    return token, hash_token(token)


def hash_token(token: str) -> bytes:
    return hashlib.sha256(token.encode("ascii", errors="ignore")).digest()


def new_csrf_token() -> str:
    return secrets.token_urlsafe(TOKEN_BYTES)


def safe_equals(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())


def new_state() -> str:
    return secrets.token_urlsafe(24)


def pkce_challenge(verifier: str) -> str:
    """S256: base64url(SHA-256(verifier)) without padding, as RFC 7636 defines it."""
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def new_pkce_pair() -> tuple[str, str]:
    """(verifier, challenge). The verifier stays with us; the challenge goes to the provider."""
    verifier = secrets.token_urlsafe(48)  # 64 chars, inside RFC 7636's 43-128
    return verifier, pkce_challenge(verifier)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _mac(secret: bytes, body: str) -> bytes:
    return hmac.new(secret, body.encode("ascii"), hashlib.sha256).digest()


def sign(
    payload: Mapping[str, Any], secret: bytes, *, clock: Callable[[], float] = time.time
) -> str:
    body = _b64(json.dumps({**payload, "iat": int(clock())}, separators=(",", ":")).encode())
    return f"{body}.{_b64(_mac(secret, body))}"


def verify(
    value: str,
    secret: bytes,
    *,
    max_age_seconds: int,
    clock: Callable[[], float] = time.time,
) -> dict[str, Any] | None:
    """The payload if the signature is valid and fresh, otherwise None. Never raises."""
    try:
        body, signature = value.split(".", 1)
        if not hmac.compare_digest(_unb64(signature), _mac(secret, body)):
            return None
        payload = cast("dict[str, Any]", json.loads(_unb64(body)))
    except (ValueError, binascii.Error, UnicodeError):
        return None
    issued = payload.get("iat")
    if not isinstance(issued, int) or not 0 <= clock() - issued <= max_age_seconds:
        return None
    return payload


MAX_REDIRECT_LENGTH = 200


def safe_redirect_path(value: str | None, default: str = "/") -> str:
    """Only same-site paths. Anything else (another site, a scheme, "//host", backslashes, control
    characters) becomes the default, so the login redirect cannot be used to send people away."""
    if (
        not value
        or len(value) > MAX_REDIRECT_LENGTH
        or not value.startswith("/")
        or value.startswith(("//", "/\\"))
        or "\\" in value
        or any(ord(char) < 32 or ord(char) == 127 for char in value)
    ):
        return default
    return value
