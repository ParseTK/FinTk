"""Client-side rate limiting for calls to a data provider.

SEC EDGAR allows 10 requests per second per user and blocks clients that exceed it, so we space our
own calls out instead of finding out the hard way.
"""

import asyncio
import time
from collections.abc import Awaitable, Callable


class AsyncRateLimiter:
    """Spaces calls at least ``1 / rate_per_second`` seconds apart, across all concurrent tasks."""

    def __init__(
        self,
        rate_per_second: float,
        *,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        if rate_per_second <= 0:
            msg = "rate_per_second must be positive"
            raise ValueError(msg)
        self._interval = 1.0 / rate_per_second
        self._clock = clock
        self._sleep = sleep
        self._next_slot = 0.0
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        # Reserve a slot under the lock, then wait for it outside the lock, so waiting tasks do not
        # block each other from reserving theirs.
        async with self._lock:
            now = self._clock()
            start = max(now, self._next_slot)
            self._next_slot = start + self._interval
        delay = start - now
        if delay > 0:
            await self._sleep(delay)
