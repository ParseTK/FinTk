"""ASGI middleware: request ids and request logging, and security headers.

These are plain ASGI middleware, not Starlette's BaseHTTPMiddleware: they do not buffer
responses and they keep context variables intact (which the request id depends on).
"""

import logging
import re
import time
import uuid

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.error_handlers import error_response
from app.core.request_context import reset_request_id, set_request_id

logger = logging.getLogger("app.request")

REQUEST_ID_HEADER = "X-Request-ID"
# An id supplied by a client or proxy is only trusted if it is short and plain; anything else
# (log-injection attempts, huge values) is replaced with a fresh one.
_VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{8,64}$")


def _incoming_request_id(scope: Scope) -> str | None:
    wanted = REQUEST_ID_HEADER.lower().encode()
    for name, value in scope["headers"]:
        if name == wanted:
            candidate = value.decode("latin-1")
            return candidate if _VALID_REQUEST_ID.match(candidate) else None
    return None


def _forwarded_entry_count(scope: Scope) -> int:
    """How many addresses X-Forwarded-For lists: only a count, never the addresses themselves.

    It shows how many proxies sit in front of the API, which is what VIRELLO_TRUST_PROXY_HOPS needs.
    """
    count = 0
    for name, value in scope["headers"]:
        if name == b"x-forwarded-for":
            count += sum(1 for part in value.decode("latin-1").split(",") if part.strip())
    return count


class RequestContextMiddleware:
    """Gives every request an id, logs it once, and turns unexpected crashes into a safe 500."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = _incoming_request_id(scope) or uuid.uuid4().hex
        token = set_request_id(request_id)
        started = time.perf_counter()
        status = 500
        response_started = False

        async def send_with_id(message: Message) -> None:
            nonlocal status, response_started
            if message["type"] == "http.response.start":
                response_started = True
                status = message["status"]
                MutableHeaders(scope=message)[REQUEST_ID_HEADER] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        except Exception:
            # Full detail goes to the log (with the request id); the client gets a generic message.
            logger.exception("unhandled error")
            if response_started:
                raise
            response = error_response(500, "internal_error", "Something went wrong.")
            await response(scope, receive, send_with_id)
        finally:
            logger.info(
                "request",
                extra={
                    "fields": {
                        "method": scope["method"],
                        "path": scope["path"],  # never the query string
                        "status": status,
                        "duration_ms": round((time.perf_counter() - started) * 1000, 1),
                        "forwarded_entries": _forwarded_entry_count(scope),
                    }
                },
            )
            reset_request_id(token)


class SecurityHeadersMiddleware:
    """Headers every API response carries. Routes can override Cache-Control for cacheable data."""

    def __init__(
        self,
        app: ASGIApp,
        *,
        hsts: bool,
        relaxed_paths: tuple[str, ...] = (),
    ) -> None:
        self.app = app
        self.hsts = hsts
        self.relaxed_paths = relaxed_paths

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # The interactive docs page loads scripts, so it cannot use the strict policy. They are only
        # served outside production.
        strict_csp = scope["path"] not in self.relaxed_paths

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers.setdefault("X-Content-Type-Options", "nosniff")
                headers.setdefault("Referrer-Policy", "no-referrer")
                headers.setdefault("Cache-Control", "no-store")
                if strict_csp:
                    headers.setdefault(
                        "Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"
                    )
                if self.hsts:
                    headers.setdefault(
                        "Strict-Transport-Security", "max-age=63072000; includeSubDomains"
                    )
            await send(message)

        await self.app(scope, receive, send_with_headers)
