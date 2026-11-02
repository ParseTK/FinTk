"""Deterministic sample prices so the price and seasonality features can be built end to end.

These numbers are NOT market data. Every response carries ``source = "sample"`` so the UI can say
so. A real provider (see the price research notes) replaces this behind the same interface.
"""

import calendar
import hashlib
import random
from collections.abc import Callable
from datetime import date
from decimal import Decimal

from app.domain.models import MonthlyPrice, PriceHistory

SOURCE = "sample"
START_YEAR = 2000


def _month_ends(today: date) -> list[date]:
    ends: list[date] = []
    year, month = START_YEAR, 1
    while (year, month) < (today.year, today.month):  # only completed months
        ends.append(date(year, month, calendar.monthrange(year, month)[1]))
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return ends


class SamplePriceProvider:
    def __init__(self, today: Callable[[], date] = date.today) -> None:
        self._today = today

    async def monthly_history(self, symbol: str) -> PriceHistory:
        seed = int.from_bytes(hashlib.sha256(symbol.upper().encode()).digest()[:8], "big")
        rng = random.Random(seed)  # noqa: S311 - reproducible sample data, not security
        price = Decimal(rng.randint(20, 200))
        prices: list[MonthlyPrice] = []
        for month_end in _month_ends(self._today()):
            change = Decimal(str(round(rng.gauss(0.008, 0.06), 4)))
            price = max(Decimal("1"), price * (1 + change))
            prices.append(MonthlyPrice(month_end=month_end, close=price.quantize(Decimal("0.01"))))
        return PriceHistory(symbol=symbol.upper(), source=SOURCE, prices=tuple(prices))
