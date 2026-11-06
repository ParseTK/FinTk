"""Turning errors into HTTP responses: the one error shape, on the wire.

The error types themselves are in ``app.core.errors`` (no web framework there). This is the web and
database side: building the JSON response, the handlers FastAPI calls for each kind of failure, and
the rule for which database errors mean "the database cannot serve this right now".
"""

import logging
from typing import cast

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError
from sqlalchemy.exc import TimeoutError as PoolTimeoutError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.errors import AppError, ErrorBody, ErrorDetail, ErrorResponse, UnavailableError
from app.core.request_context import get_request_id

logger = logging.getLogger(__name__)


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
    details = cast("list[ErrorDetail] | None", getattr(error, "details", None))
    response = error_response(error.status_code, error.code, error.message, details=details)
    if error.headers:
        response.headers.update(error.headers)
    return response


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
