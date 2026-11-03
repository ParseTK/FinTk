"""Calendar-month helpers shared by the price providers and the price store."""

import calendar
from datetime import date, timedelta


def month_end(year: int, month: int) -> date:
    return date(year, month, calendar.monthrange(year, month)[1])


def month_index(value: date) -> int:
    """Months since year 0, so two months compare and subtract as plain integers."""
    return value.year * 12 + value.month - 1


def last_complete_month_end(today: date) -> date:
    """The last day of the newest month whose closing price is final.

    A month counts as complete once a full calendar day has passed since it ended. The extra day
    covers the gap between UTC (what the server uses) and the US market time zone, so a close
    that may still be settling is never stored as final.
    """
    day = today - timedelta(days=1)
    first_of_month = day.replace(day=1)
    return first_of_month - timedelta(days=1)
