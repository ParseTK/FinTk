"""One error shape for the whole API.

Every failure, from a validation error to an unexpected crash, is returned as::

    {"error": {"code": "not_found", "message": "...", "request_id": "..."}}

so clients handle errors one way. Messages are written for people. They never contain stack traces,
exception text from unexpected errors, or the values a client sent (which could be secrets).
"""

from typing import cast

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.request_context import get_request_id


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
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)
