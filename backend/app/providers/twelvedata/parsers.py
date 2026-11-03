"""Turns a Twelve Data ``time_series`` response into domain prices. Pure, so it is tested on a
recorded real response.

Twelve Data labels a monthly bar with the first day of its month (``1980-12-01``), reports closes
as strings, and describes failures in the body (``{"status": "error", "code": 429, ...}``).
"""

from collections.abc import Mapping
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any, cast

from app.domain.models import MonthlyPrice
from app.domain.months import month_end

# More than any listed security has existed; stops a corrupt response from becoming a huge write.
MAX_MONTHS = 1200
# The price column is NUMERIC(18, 6): six decimals, and a value must stay below 10**12.
STORED_PRECISION = Decimal("0.000001")
MAX_CLOSE = Decimal(10) ** 12


def error_code(payload: Mapping[str, Any]) -> int | None:
    """The provider's error code if the body reports a failure, else None."""
    if payload.get("status") != "error":
        return None
    code = payload.get("code")
    return code if isinstance(code, int) else 0


def parse_monthly(payload: Mapping[str, Any], last_complete: date) -> tuple[MonthlyPrice, ...]:
    """Completed months only, oldest first, one per calendar month.

    The current month is partial (its "close" is just the latest trade), so it is dropped:
    ``last_complete`` is the last day of the newest month whose close is final.
    """
    rows_value: object = payload.get("values")
    if not isinstance(rows_value, list):
        msg = "missing values"
        raise TypeError(msg)
    rows = cast("list[object]", rows_value)
    if len(rows) > MAX_MONTHS:
        msg = "implausibly long history"
        raise ValueError(msg)

    by_month: dict[tuple[int, int], MonthlyPrice] = {}
    for row in rows:
        if not isinstance(row, dict):
            msg = "unexpected row"
            raise TypeError(msg)
        fields = cast("dict[str, object]", row)
        label = date.fromisoformat(str(fields["datetime"])[:10])
        end = month_end(label.year, label.month)
        if end > last_complete:
            continue
        raw = fields.get("close")
        if raw is None:
            continue  # a month with no close is skipped, not guessed
        try:
            close = Decimal(str(raw))
        except InvalidOperation as error:
            msg = "unreadable close"
            raise ValueError(msg) from error
        if not close.is_finite() or close >= MAX_CLOSE:
            continue
        close = close.quantize(STORED_PRECISION)  # the column holds six decimals; round here
        if close <= 0:
            continue
        by_month[(label.year, label.month)] = MonthlyPrice(month_end=end, close=close)
    return tuple(by_month[key] for key in sorted(by_month))
