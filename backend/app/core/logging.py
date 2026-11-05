"""Structured JSON logging with the request id on every line.

Privacy rule: logs never contain request bodies, headers, cookies, tokens or query strings. The
request log line records the method, the path (without its query string), the status and the time.
"""

import json
import logging
import sys
from datetime import UTC, datetime
from typing import cast, override

from app.core.request_context import get_request_id

_HANDLER_MARK = "_virello_handler"


class _RequestIdFilter(logging.Filter):
    @override
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id()
        return True


class JsonFormatter(logging.Formatter):
    @override
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "time": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", None),
        }
        fields: object = getattr(record, "fields", None)
        if isinstance(fields, dict):
            payload.update(cast("dict[str, object]", fields))
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging(level: str) -> None:
    """Send JSON logs to stdout. Safe to call more than once."""
    root = logging.getLogger()
    root.setLevel(level)

    # Replace only the handler this function installed earlier, never anyone else's.
    for handler in list(root.handlers):
        if getattr(handler, _HANDLER_MARK, False):
            root.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    handler.addFilter(_RequestIdFilter())
    setattr(handler, _HANDLER_MARK, True)
    root.addHandler(handler)

    # uvicorn's access log prints the full URL including the query string; ours does not.
    access = logging.getLogger("uvicorn.access")
    access.handlers.clear()
    access.propagate = False
    access.disabled = True

    # httpx logs every outbound request URL, query string included. Several data providers take
    # their API key in the query string, so those lines would leak keys. Keep errors, drop the rest.
    for noisy in ("httpx", "httpcore"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
