"""CoinMarketCap provider: top coins, market totals and the Fear and Greed index.

Free Basic plan: 15,000 credits a month and 50 calls a minute. Both limits are enforced here with
budgets that refuse instead of queueing, and the layer above caches every answer for minutes, so a
page view never costs a call.

Licence reminders (the Commercial API Terms): the data may be shown only as part of our product and
never as a standalone feed, so nothing here is exposed publicly (routes using it require the
internal token); and it may be stored only temporarily, so it is cached in memory and never written
to the database. The attribution "Data provided by CoinMarketCap.com", linked, is sent with every
response so a page cannot forget it.

The key travels in the ``X-CMC_PRO_API_KEY`` header, never the URL, so it cannot end up in a URL a
proxy, a log line or an error message might repeat. Nothing here logs a response body.
"""

import asyncio
import logging
from collections.abc import Callable, Sequence
from datetime import UTC, date, datetime, timedelta
from typing import Any, cast

import httpx

from app.core.errors import UnavailableError, UpstreamError
from app.core.http import build_client
from app.core.rate_limit import SlidingWindowBudget
from app.domain.crypto import AnchorPrices, CryptoListings, FearGreed, MarketTotals
from app.providers.coinmarketcap import parsers

logger = logging.getLogger(__name__)

SOURCE = "CoinMarketCap"
BASE_URL = "https://pro-api.coinmarketcap.com"
TIMEOUT = httpx.Timeout(10.0, connect=5.0)
RETRYABLE_STATUS = frozenset({500, 502, 503, 504})
MAX_BYTES = 2_000_000  # a 200-row listing is about 300 KB


def build_http_client(api_key: str) -> httpx.AsyncClient:
    return build_client(
        base_url=BASE_URL,
        headers={"X-CMC_PRO_API_KEY": api_key, "Accept": "application/json"},
        timeout=TIMEOUT,
    )


def _now() -> datetime:
    return datetime.now(UTC)


class CoinMarketCapProvider:
    source = SOURCE

    def __init__(
        self,
        client: httpx.AsyncClient,
        *,
        per_minute: SlidingWindowBudget,
        per_day: SlidingWindowBudget,
        now: Callable[[], datetime] = _now,
        retry_delay: float = 1.0,
    ) -> None:
        self._client = client
        self._per_minute = per_minute
        self._per_day = per_day
        self._now = now
        self._retry_delay = retry_delay

    async def listings(self, limit: int) -> CryptoListings:
        payload = await self._get(
            "/v1/cryptocurrency/listings/latest",
            {"start": 1, "limit": limit, "convert": "USD", "sort": "market_cap"},
        )
        return self._read(lambda: parsers.parse_listings(payload, self._now()))

    async def market_totals(self) -> MarketTotals:
        payload = await self._get("/v1/global-metrics/quotes/latest", {"convert": "USD"})
        return self._read(lambda: parsers.parse_global(payload, self._now()))

    async def fear_greed(self) -> FearGreed:
        payload = await self._get("/v3/fear-and-greed/latest", {})
        return self._read(lambda: parsers.parse_fear_greed(payload, self._now()))

    async def anchor_prices(self, ids: Sequence[int], day: date) -> AnchorPrices:
        """One daily point per coin, stamped 00:00 UTC on ``day``. Ten coins cost one credit.

        The provider stamps a daily point with the day it closes, so the request starts the day
        before. The free plan allows only twelve months of history: an older day is refused.
        """
        payload = await self._get(
            "/v3/cryptocurrency/quotes/historical",
            {
                "id": ",".join(str(coin) for coin in sorted(set(ids))),
                "interval": "daily",
                "time_start": (day - timedelta(days=1)).isoformat(),
                "count": 1,
                "convert": "USD",
            },
        )
        return self._read(lambda: parsers.parse_anchor_prices(payload))

    @staticmethod
    def _read[T](parse: Callable[[], T]) -> T:
        try:
            return parse()
        except (ValueError, KeyError, TypeError) as error:
            logger.error("unreadable crypto response: %s", type(error).__name__)
            msg = "The crypto data service returned an unreadable response."
            raise UpstreamError(msg) from error

    async def _get(self, path: str, params: dict[str, str | int]) -> dict[str, Any]:
        for attempt in (1, 2):
            self._spend_budget()
            try:
                response = await self._client.get(path, params=params)
            except httpx.TransportError as error:
                if attempt == 2:
                    logger.warning("crypto request failed: %s", type(error).__name__)
                    msg = "The crypto data service is unreachable."
                    raise UpstreamError(msg) from error
            else:
                if response.status_code in RETRYABLE_STATUS and attempt == 1:
                    pass
                else:
                    return self._settle(self._decode(response))
            await asyncio.sleep(self._retry_delay)
        msg = (
            "The crypto data service is unavailable."  # unreachable; keeps the type checker honest
        )
        raise UpstreamError(msg)

    def _settle(self, body: dict[str, Any]) -> dict[str, Any]:
        """Remember credits beyond the one each call is budgeted for (a long history costs many)."""
        used = parsers.credit_count(body)
        if used is not None and used > 1:
            self._per_day.spend(used - 1)
        return body

    def _spend_budget(self) -> None:
        for budget in (self._per_minute, self._per_day):
            wait = budget.take()
            if wait is not None:
                # Our own quota guard tripped before the provider could block us.
                logger.warning("crypto provider quota reached; retry in %.0fs", wait)
                msg = "Crypto prices are refreshing slowly right now. Please try again shortly."
                raise UnavailableError(msg, headers={"Retry-After": str(max(int(wait) + 1, 1))})

    @staticmethod
    def _decode(response: httpx.Response) -> dict[str, Any]:
        if len(response.content) > MAX_BYTES:
            logger.warning("crypto provider sent an oversized response")
            msg = "The crypto data service returned an unreadable response."
            raise UpstreamError(msg)
        try:
            payload = response.json()
        except ValueError as error:
            logger.warning("crypto provider sent non-JSON with status %s", response.status_code)
            msg = "The crypto data service returned an unreadable response."
            raise UpstreamError(msg) from error
        if not isinstance(payload, dict):
            msg = "The crypto data service returned an unreadable response."
            raise UpstreamError(msg)
        body = cast("dict[str, Any]", payload)
        code = parsers.error_code(body)
        if response.status_code != 200 or code is not None:
            # 401/403 is a rejected key, 429 the provider's own quota: the cause is on our side of
            # the fence and a visitor can only retry later.
            logger.warning("crypto provider error: http %s, code %s", response.status_code, code)
            msg = "The crypto data service returned an error."
            raise UpstreamError(msg)
        credits_used = parsers.credit_count(body)
        if credits_used is not None:
            logger.info("crypto call used %s credit(s)", credits_used)
        return body
