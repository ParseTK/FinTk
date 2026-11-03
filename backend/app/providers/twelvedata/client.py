"""Twelve Data price provider: monthly closing prices back to a security's first listing.

Free plan: 8 calls a minute and 800 a day. Both are enforced here with a budget that refuses
instead of queueing, and the layer above stores every series permanently and later asks only for
the newest months, so a symbol costs one call ever, then one small call per month.

The key travels in an ``Authorization`` header, not the query string, so it cannot end up in a URL
that a proxy, a log line or an error message might repeat. Nothing here logs a response body.
"""

import asyncio
import logging
from collections.abc import Callable
from datetime import UTC, date, datetime
from typing import Any, cast

import httpx

from app.core.errors import UnavailableError, UpstreamError
from app.core.rate_limit import SlidingWindowBudget
from app.domain.models import PriceHistory
from app.domain.months import last_complete_month_end, month_index
from app.providers.twelvedata import parsers

logger = logging.getLogger(__name__)

SOURCE = "Twelve Data"
BASE_URL = "https://api.twelvedata.com"
TIMEOUT = httpx.Timeout(15.0, connect=5.0)
RETRYABLE_STATUS = frozenset({500, 502, 503, 504})
MAX_OUTPUT = 5000  # the most rows one call can return
# Error codes that mean "this provider has no data for that symbol", not "the call failed".
UNKNOWN_SYMBOL_CODES = frozenset({400, 404})


def build_http_client(api_key: str) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=BASE_URL,
        headers={"Authorization": f"apikey {api_key}", "Accept": "application/json"},
        timeout=TIMEOUT,
        follow_redirects=False,
    )


def _provider_symbol(symbol: str) -> str:
    """Twelve Data writes share classes with a dot (BRK.B); SEC and this app use a dash."""
    return symbol.strip().upper().replace("-", ".")


class TwelveDataProvider:
    source = SOURCE

    def __init__(
        self,
        client: httpx.AsyncClient,
        *,
        per_minute: SlidingWindowBudget,
        per_day: SlidingWindowBudget,
        today: Callable[[], date] = lambda: datetime.now(UTC).date(),
        retry_delay: float = 1.0,
    ) -> None:
        self._client = client
        self._per_minute = per_minute
        self._per_day = per_day
        self._today = today
        self._retry_delay = retry_delay

    async def monthly_history(self, symbol: str, *, since: date | None = None) -> PriceHistory:
        today = self._today()
        payload = await self._get(
            {
                "symbol": _provider_symbol(symbol),
                "interval": "1month",
                "order": "DESC",  # newest first, so a short outputsize means the newest months
                "outputsize": self._outputsize(today, since),
            }
        )
        code = parsers.error_code(payload)
        if code in UNKNOWN_SYMBOL_CODES:
            logger.info("price provider has no data for a symbol")
            return PriceHistory(symbol=symbol.upper(), source=SOURCE, prices=())
        if code is not None:
            # 429 means the provider's own quota; 401/403 a rejected key. Either way the cause
            # is on our side of the fence and the user can only retry later.
            logger.warning("price provider reported error code %s", code)
            msg = "The price data service returned an error."
            raise UpstreamError(msg)
        try:
            prices = parsers.parse_monthly(payload, last_complete_month_end(today))
        except (ValueError, KeyError, TypeError) as error:
            logger.error("unreadable price response: %s", type(error).__name__)
            msg = "The price data service returned an unreadable response."
            raise UpstreamError(msg) from error
        return PriceHistory(symbol=symbol.upper(), source=SOURCE, prices=prices)

    @staticmethod
    def _outputsize(today: date, since: date | None) -> int:
        if since is None:
            return MAX_OUTPUT
        # From `since` (inclusive, so a restated month is corrected) to the current partial month.
        months = month_index(today) - month_index(since) + 1
        return min(max(months, 2), MAX_OUTPUT)

    async def _get(self, params: dict[str, str | int]) -> dict[str, Any]:
        for attempt in (1, 2):
            self._spend_budget()
            try:
                response = await self._client.get("/time_series", params=params)
            except httpx.TransportError as error:
                if attempt == 2:
                    logger.warning("price request failed: %s", type(error).__name__)
                    msg = "The price data service is unreachable."
                    raise UpstreamError(msg) from error
            else:
                if response.status_code in RETRYABLE_STATUS and attempt == 1:
                    pass
                else:
                    return self._decode(response)
            await asyncio.sleep(self._retry_delay)
        msg = "The price data service is unavailable."  # unreachable; keeps the type checker honest
        raise UpstreamError(msg)

    def _spend_budget(self) -> None:
        for budget in (self._per_minute, self._per_day):
            wait = budget.take()
            if wait is not None:
                # Our own quota guard tripped before the provider could block us.
                logger.warning("price provider quota reached; retry in %.0fs", wait)
                msg = "Price history is loading slowly right now. Please try again shortly."
                raise UnavailableError(msg, headers={"Retry-After": str(max(int(wait) + 1, 1))})

    @staticmethod
    def _decode(response: httpx.Response) -> dict[str, Any]:
        try:
            payload = response.json()
        except ValueError as error:
            logger.warning("price provider sent non-JSON with status %s", response.status_code)
            msg = "The price data service returned an unreadable response."
            raise UpstreamError(msg) from error
        if not isinstance(payload, dict):
            msg = "The price data service returned an unreadable response."
            raise UpstreamError(msg)
        return cast("dict[str, Any]", payload)
