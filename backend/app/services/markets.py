"""The market overview: month-end figures for a fixed list of index and sector ETFs.

History comes from the price provider (which stores it, so a symbol costs provider calls only the
first time). The page must never fail because one symbol could not be fetched, and a cold start
needs more provider calls than the free plan allows per minute, so:

- every symbol is fetched on its own, and one that fails is simply a row without figures;
- the wait is capped, and a fetch that is still running keeps going for the next visitor;
- the finished overview is kept for a while (shortly, if some rows are missing, so they fill in).
"""

import asyncio
import logging
import time
from collections.abc import Callable
from dataclasses import dataclass

from app.core.errors import AppError
from app.domain.markets import (
    INSTRUMENTS,
    Instrument,
    MarketFigures,
    MarketRow,
    market_figures,
)
from app.providers.base import PriceProvider

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class MarketOverview:
    source: str
    rows: tuple[MarketRow, ...]

    @property
    def complete(self) -> bool:
        return all(row.figures is not None for row in self.rows)


class MarketService:
    def __init__(
        self,
        prices: PriceProvider,
        *,
        wait: float = 8.0,
        keep_complete: float = 1800.0,
        keep_partial: float = 45.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._prices = prices
        self._wait = wait
        self._keep_complete = keep_complete
        self._keep_partial = keep_partial
        self._clock = clock
        self._kept: tuple[float, MarketOverview] | None = None
        self._lock = asyncio.Lock()
        # Fetches cut short by the wait keep running (and are held here so they are not collected
        # early); what they find is kept in _known for the next build.
        self._running: dict[str, asyncio.Task[None]] = {}
        self._known: dict[str, MarketFigures] = {}

    async def overview(self) -> MarketOverview:
        kept = self._kept
        if kept is not None and self._clock() < kept[0]:
            return kept[1]
        async with self._lock:  # one build at a time; the others reuse its result
            kept = self._kept
            if kept is not None and self._clock() < kept[0]:
                return kept[1]
            overview = await self._build()
            keep = self._keep_complete if overview.complete else self._keep_partial
            self._kept = (self._clock() + keep, overview)
            return overview

    async def _build(self) -> MarketOverview:
        # A fetch still running from an earlier build is joined, not repeated.
        for instrument in INSTRUMENTS:
            if instrument.symbol not in self._running:
                self._running[instrument.symbol] = asyncio.create_task(self._fetch(instrument))
        await asyncio.wait(list(self._running.values()), timeout=self._wait)
        # A symbol whose fetch has not finished (or failed) shows its last known figures, if any.
        rows = tuple(
            MarketRow(instrument, self._known.get(instrument.symbol)) for instrument in INSTRUMENTS
        )
        return MarketOverview(source=self._prices.source, rows=rows)

    async def _fetch(self, instrument: Instrument) -> None:
        try:
            history = await self._prices.monthly_history(instrument.symbol)
            figures = market_figures(history.prices)
            if figures is not None:
                self._known[instrument.symbol] = figures
        except AppError:
            logger.info("market figures unavailable for %s", instrument.symbol)
        except Exception:  # a row without figures, never a failed page or an unretrieved task
            logger.exception("unexpected error fetching market figures for %s", instrument.symbol)
        finally:
            self._running.pop(instrument.symbol, None)
