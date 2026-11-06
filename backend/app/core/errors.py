"""The API's error types and the one shape they are reported in.

Every failure, from a validation error to an unexpected crash, is returned as::

    {"error": {"code": "not_found", "message": "...", "request_id": "..."}}

so clients handle errors one way. Messages are written for people. They never contain stack traces,
exception text from unexpected errors, or the values a client sent (which could be secrets).

This module is only the vocabulary: plain exceptions and response models, with no web framework and
no database in it, so any layer may raise an error. Turning them into HTTP responses is
``app.core.error_handlers``.
"""

from pydantic import BaseModel


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
    headers: dict[str, str] | None = None

    def __init__(
        self, message: str | None = None, *, headers: dict[str, str] | None = None
    ) -> None:
        self.message = message or self.default_message
        self.headers = headers
        super().__init__(self.message)


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"
    default_message = "That does not exist."


class ConflictError(AppError):
    status_code = 409
    code = "conflict"
    default_message = "That conflicts with the current state."


class BadRequestError(AppError):
    status_code = 400
    code = "bad_request"
    default_message = "That request could not be understood."


class RowsInvalidError(AppError):
    """A batch was refused because some rows are not valid. Nothing was saved.

    Carries one entry per problem, located like a validation error (``["body", "lots", 2,
    "symbol"]``), so a client can mark the exact field of the exact row.
    """

    status_code = 422
    code = "validation_error"
    default_message = "Some rows could not be saved. Nothing was added."

    def __init__(self, details: list[ErrorDetail]) -> None:
        super().__init__()
        self.details = details


class RateLimitedError(AppError):
    status_code = 429
    code = "rate_limited"
    default_message = "Too many requests. Please slow down and try again shortly."


class LimitReachedError(AppError):
    status_code = 409
    code = "limit_reached"
    default_message = "You have reached the limit for this."


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
