"""Reading CoinMarketCap responses. Pure functions, no I/O.

The response shapes follow CoinMarketCap's public API documentation and still need confirming with a
live key; every reader is defensive about that. Whatever the provider sends is untrusted input:

- a figure that is not a finite, plain number becomes ``None`` (a price must also be above zero);
- a row that is missing its essentials is skipped, never half-read;
- text is stripped of control and format characters, whitespace-collapsed and length-capped (React
  escapes it on display, so no markup is ever interpreted);
- the number of rows is capped.
"""

import re
import unicodedata
from collections.abc import Mapping
from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, cast

from app.domain.crypto import AnchorPrices, CryptoAsset, CryptoListings, FearGreed, MarketTotals

Json = Mapping[str, Any]

MAX_ROWS = 200
MAX_TEXT = 80
_SPACES = re.compile(r"\s+")
_SLUG = re.compile(r"^[a-z0-9][a-z0-9._-]{0,79}$")
_MONEY_STEP = Decimal("1e-10")  # a price needs more places than cents (tiny coins), but not 30
_PERCENT_STEP = Decimal("0.01")


def _dict(value: object) -> Json:
    """The value as a mapping, or an empty one: callers never have to check the type first."""
    return cast("Json", value) if isinstance(value, Mapping) else {}


def error_code(payload: Json) -> int | None:
    """The provider's own error code, or None when the call succeeded."""
    code = _dict(payload.get("status")).get("error_code")
    if isinstance(code, bool) or not isinstance(code, int | str):
        return None
    try:
        number = int(code)
    except ValueError:
        return None
    return number or None


def credit_count(payload: Json) -> int | None:
    """How many of the monthly credits this call used, for the log."""
    count = _dict(payload.get("status")).get("credit_count")
    return count if isinstance(count, int) and not isinstance(count, bool) else None


def _text(value: object, limit: int = MAX_TEXT) -> str:
    if not isinstance(value, str):
        return ""
    cleaned = "".join(ch for ch in value if unicodedata.category(ch)[0] != "C")
    return _SPACES.sub(" ", cleaned).strip()[:limit]


def _decimal(value: object, step: Decimal) -> Decimal | None:
    if isinstance(value, bool) or not isinstance(value, int | float | str):
        return None
    try:
        number = Decimal(str(value))
        if not number.is_finite():
            return None
        return number.quantize(step)
    except InvalidOperation:
        return None


def _money(value: object) -> Decimal | None:
    number = _decimal(value, _MONEY_STEP)
    return number if number is not None and number >= 0 else None


def _percent(value: object) -> Decimal | None:
    return _decimal(value, _PERCENT_STEP)


def _when(value: object) -> datetime | None:
    """An ISO 8601 time such as ``2026-11-03T20:01:00.000Z``, as an aware UTC datetime."""
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.astimezone(UTC) if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _id(value: object) -> int | None:
    """The provider's numeric id: a positive integer, never a bool, a float or a string."""
    return value if isinstance(value, int) and not isinstance(value, bool) and value > 0 else None


def _asset(row: object) -> CryptoAsset | None:
    data = _dict(row)
    quote = _dict(_dict(data.get("quote")).get("USD"))
    rank = data.get("cmc_rank")
    symbol = _text(data.get("symbol"), 20)
    name = _text(data.get("name"))
    slug = _text(data.get("slug"), 80)
    price = _money(quote.get("price"))
    if (
        isinstance(rank, bool)
        or not isinstance(rank, int)
        or rank < 1
        or not symbol
        or not name
        or not _SLUG.match(slug)
        or price is None
        or price == 0
    ):
        return None
    return CryptoAsset(
        rank=rank,
        name=name,
        symbol=symbol,
        slug=slug,
        price=price,
        change_24h=_percent(quote.get("percent_change_24h")),
        change_7d=_percent(quote.get("percent_change_7d")),
        market_cap=_money(quote.get("market_cap")),
        volume_24h=_money(quote.get("volume_24h")),
        cmc_id=_id(data.get("id")),
        change_30d=_percent(quote.get("percent_change_30d")),
        change_90d=_percent(quote.get("percent_change_90d")),
    )


def parse_listings(payload: Json, fetched_at: datetime) -> CryptoListings:
    """The top coins by market capitalization, ordered by rank.

    Raises ``ValueError`` when no usable row is found: a response of garbage must not look like an
    empty market.
    """
    raw = payload.get("data")
    if not isinstance(raw, list):
        msg = "listings response has no data list"
        raise ValueError(msg)
    rows = cast("list[object]", raw)
    assets = [asset for row in rows[:MAX_ROWS] if (asset := _asset(row)) is not None]
    if not assets:
        msg = "listings response has no readable rows"
        raise ValueError(msg)
    assets.sort(key=lambda asset: asset.rank)
    as_of = _when(_dict(payload.get("status")).get("timestamp")) or fetched_at
    return CryptoListings(assets=tuple(assets), as_of=as_of)


def _either(data: Json, quote: Json, key: str) -> object:
    """A figure the provider puts either beside the quote or inside it."""
    value = quote.get(key)
    return value if value is not None else data.get(key)


def parse_global(payload: Json, fetched_at: datetime) -> MarketTotals:
    data = _dict(payload.get("data"))
    if not data:
        msg = "global metrics response has no data"
        raise ValueError(msg)
    quote = _dict(_dict(data.get("quote")).get("USD"))
    totals = MarketTotals(
        total_market_cap=_money(quote.get("total_market_cap")),
        total_volume_24h=_money(quote.get("total_volume_24h")),
        btc_dominance=_percent(data.get("btc_dominance")),
        eth_dominance=_percent(data.get("eth_dominance")),
        as_of=_when(data.get("last_updated")) or fetched_at,
        total_market_cap_yesterday=_money(_either(data, quote, "total_market_cap_yesterday")),
        btc_dominance_yesterday=_percent(_either(data, quote, "btc_dominance_yesterday")),
        eth_dominance_yesterday=_percent(_either(data, quote, "eth_dominance_yesterday")),
        stablecoin_market_cap=_money(_either(data, quote, "stablecoin_market_cap")),
        defi_market_cap=_money(_either(data, quote, "defi_market_cap")),
    )
    if totals.total_market_cap is None and totals.btc_dominance is None:
        msg = "global metrics response has nothing readable"
        raise ValueError(msg)
    return totals


def parse_fear_greed(payload: Json, fetched_at: datetime) -> FearGreed:
    data = _dict(payload.get("data"))
    value = data.get("value")
    label = _text(data.get("value_classification"), 40)
    if isinstance(value, bool) or not isinstance(value, int | float | str):
        msg = "fear and greed response has no value"
        raise ValueError(msg)
    try:
        number = int(Decimal(str(value)))
    except (InvalidOperation, ValueError) as error:
        msg = "fear and greed value is not a number"
        raise ValueError(msg) from error
    if not 0 <= number <= 100 or not label:
        msg = "fear and greed value is out of range"
        raise ValueError(msg)
    return FearGreed(value=number, label=label, as_of=_when(data.get("update_time")) or fetched_at)


def _first(value: object) -> object:
    """The first element of a list, the value itself otherwise (the provider sends either)."""
    if isinstance(value, list):
        items = cast("list[object]", value)
        return items[0] if items else None
    return value


def parse_anchor_prices(payload: Json) -> AnchorPrices:
    """The prices from a one-point historical request for several coins.

    The provider stamps each point at 00:00 UTC of the day it describes; all coins share one day.
    Raises ``ValueError`` when nothing usable is found, so garbage is never taken as "no change".
    """
    data = payload.get("data")
    if not isinstance(data, Mapping):
        msg = "anchor response has no data"
        raise ValueError(msg)
    prices: dict[int, Decimal] = {}
    day: date | None = None
    for key, value in cast("Mapping[object, object]", data).items():
        row = _dict(_first(value))
        coin = _id(row.get("id")) or (
            _id(int(key)) if isinstance(key, str) and key.isdigit() else None
        )
        quotes = row.get("quotes")
        first: Json = {}
        if isinstance(quotes, list) and quotes:
            first = _dict(cast("list[object]", quotes)[0])
        price = _money(_dict(_dict(first.get("quote")).get("USD")).get("price"))
        when = _when(first.get("timestamp"))
        if coin is None or price is None or price == 0 or when is None:
            continue
        day = day or when.date()
        if when.date() == day:
            prices[coin] = price
    if day is None or not prices:
        msg = "anchor response has no readable prices"
        raise ValueError(msg)
    return AnchorPrices(on=day, prices=prices)
