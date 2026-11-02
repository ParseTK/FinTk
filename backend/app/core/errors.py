"""One error shape for the whole API.

Every failure, from a validation error to an unexpected crash, is returned as::

    {"error": {"code": "not_found", "message": "...", "request_id": "..."}}

so clients handle errors one way. Messages are written for people. They never contain stack traces,
exception text from unexpected errors, or the values a client sent (which could be secrets).
"""

import logging
from typing import cast

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.exc import DBAPIError
from sqlalchemy.exc import TimeoutError as PoolTimeoutError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.request_context import get_request_id

logger = logging.getLogger(__name__)


class ErrorDetail(BaseModel):
    """One problem with one part of a request (validation errors only)."""

    loc: list[str | int]
    message: str
    type: str


class ErrorBody(BaseModel):
    code: str
    message: str
    request_id: str | None = None
    details: list[ErrorDetail] | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody


# Documented on every route so the generated TypeScript client knows the error shape.
ERROR_RESPONSES: dict[int | str, dict[str, object]] = {
    422: {"model": ErrorResponse, "description": "The request was not valid."},
    500: {"model": ErrorResponse, "description": "Unexpected server error."},
    502: {"model": ErrorResponse, "description": "A data provider failed."},
    503: {"model": ErrorResponse, "description": "The service is unavailable."},
}


class AppError(Exception):
    """A failure the API reports on purpose. Subclasses set the status and code."""

    status_code: int = 500
    code: str = "internal_error"
    default_message: str = "Something went wrong."

    def __init__(self, message: str | None = None) -> None:
        self.message = message or self.default_message
        super().__init__(self.message)


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"
    default_message = "That does not exist."


class ConflictError(AppError):
    status_code = 409
    code = "conflict"
    default_message = "That conflicts with the current state."


class UnauthorizedError(AppError):
    status_code = 401
    code = "unauthorized"
    default_message = "Sign in to continue."


class ForbiddenError(AppError):
    status_code = 403
    code = "forbidden"
    default_message = "You do not have access to that."


class UpstreamError(AppError):
    """A data provider failed or timed out. The client can retry later."""

    status_code = 502
    code = "upstream_error"
    default_message = "A data provider is not responding. Please try again shortly."


class UnavailableError(AppError):
    """A capability is not configured or is switched off on this server."""

    status_code = 503
    code = "unavailable"
    default_message = "This service is temporarily unavailable."


def error_response(
    status_code: int,
    code: str,
    message: str,
    *,
    details: list[ErrorDetail] | None = None,
) -> JSONResponse:
    body = ErrorResponse(
        error=ErrorBody(code=code, message=message, request_id=get_request_id(), details=details)
    )
    return JSONResponse(
        status_code=status_code, content=body.model_dump(mode="json", exclude_none=True)
    )


_HTTP_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    429: "rate_limited",
}


async def _app_error(_: Request, exc: Exception) -> JSONResponse:
    error = cast("AppError", exc)
    return error_response(error.status_code, error.code, error.message)


# Postgres error classes that mean "the database cannot serve this right now", not "this request or
# our code is wrong": connection problems (08), resource exhaustion (53), shutdown or a cancelled
# statement such as the statement timeout (57), and a rolled-back transaction that is safe to retry,
# i.e. serialization failure or deadlock (40).
_UNAVAILABLE_SQLSTATE_CLASSES = frozenset({"08", "40", "53", "57"})


def is_database_unavailable(exc: Exception) -> bool:
    if isinstance(exc, PoolTimeoutError):
        return True
    if not isinstance(exc, DBAPIError):
        return False
    if exc.connection_invalidated:
        return True
    sqlstate = getattr(exc.orig, "sqlstate", None) or getattr(exc.orig, "pgcode", None)
    return isinstance(sqlstate, str) and sqlstate[:2] in _UNAVAILABLE_SQLSTATE_CLASSES


async def _database_error(_: Request, exc: Exception) -> JSONResponse:
    if not is_database_unavailable(exc):
        raise exc  # a bug or bad data (constraint, syntax...): an unexpected error, a generic 500
    return await _database_unavailable(_, exc)


async def _database_unavailable(_: Request, exc: Exception) -> JSONResponse:
    # Connection loss, a statement timeout or an exhausted pool: the database is the problem, not
    # the request. Details go to the log (with the request id), never to the client.
    logger.warning("database unavailable: %s", type(exc).__name__, exc_info=True)
    error = UnavailableError()
    return error_response(error.status_code, error.code, error.message)


async def _validation_error(_: Request, exc: Exception) -> JSONResponse:
    # Deliberately builds the details by hand: pydantic's own errors include the rejected input.
    problems = cast("RequestValidationError", exc).errors()
    details = [
        ErrorDetail(
            loc=[part if isinstance(part, str | int) else str(part) for part in problem["loc"]],
            message=problem["msg"],
            type=problem["type"],
        )
        for problem in problems
    ]
    return error_response(422, "validation_error", "The request was not valid.", details=details)


async def _http_error(_: Request, exc: Exception) -> JSONResponse:
    error = cast("StarletteHTTPException", exc)
    code = _HTTP_CODES.get(error.status_code, "http_error")
    message = error.detail or "Request failed."
    return error_response(error.status_code, code, message)


def install_error_handlers(app: FastAPI) -> None:
    """Unexpected exceptions are handled one level up, in RequestContextMiddleware."""
    app.add_exception_handler(AppError, _app_error)
    for database_error in (DBAPIError, PoolTimeoutError):
        app.add_exception_handler(database_error, _database_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)
