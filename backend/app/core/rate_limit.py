"""Rate limiting, in both directions.

- AsyncRateLimiter spaces our own calls to a data provider (SEC EDGAR blocks clients above 10
  requests per second, so we find out the easy way).
- SlidingWindowBudget keeps us inside a provider's published quota without ever queueing.
- KeyedRateLimiter limits how often one client can hit an endpoint such as sign-in.
"""

import asyncio
import time
from collections import OrderedDict, deque
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


class SlidingWindowBudget:
    """A call budget: at most ``limit`` calls in any ``window_seconds``, refused when spent.

    For a provider's published quota (for example 8 per minute and 800 per day). Unlike
    AsyncRateLimiter it never makes a caller wait, because a request that waits minutes for a quota
    slot is worse than one that is told to come back. Unlike a fixed window it cannot be fooled by a
    burst straddling the boundary: it remembers when each of the last ``limit`` calls happened.
    State is per process; with several instances, divide the limit between them.
    """

    def __init__(
        self,
        limit: int,
        window_seconds: float,
        *,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        if limit < 1 or window_seconds <= 0:
            msg = "limit and window_seconds must be positive"
            raise ValueError(msg)
        self._limit = limit
        self._window = window_seconds
        self._clock = clock
        self._calls: deque[float] = deque()

    def spend(self, extra: int) -> None:
        """Count ``extra`` more calls that already happened, without ever refusing.

        For a provider that charges more than one credit for some calls: the call was made and the
        credits are gone, so the budget must remember them even though nothing can be refused now.
        """
        now = self._clock()
        self._calls.extend([now] * max(extra, 0))

    def take(self) -> float | None:
        """Spend one call. None if allowed, else the seconds until a call becomes available."""
        now = self._clock()
        while self._calls and now - self._calls[0] >= self._window:
            self._calls.popleft()
        if len(self._calls) >= self._limit:
            return max(self._window - (now - self._calls[0]), 0.0)
        self._calls.append(now)
        return None


class KeyedRateLimiter:
    """At most ``limit`` hits per ``window_seconds`` for each key (for example a client address).

    Fixed windows: simple, O(1) per hit, and good enough to blunt brute force. Memory is bounded:
    past ``max_keys`` the least recently used key is forgotten, so an attacker rotating through
    addresses cannot grow the table without limit. State is per process, so with several instances
    the effective limit is multiplied by the instance count; move it to shared storage if that
    matters.
    """

    def __init__(
        self,
        limit: int,
        window_seconds: float = 60.0,
        *,
        max_keys: int = 10_000,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        if limit < 1 or window_seconds <= 0 or max_keys < 1:
            msg = "limit, window_seconds and max_keys must be positive"
            raise ValueError(msg)
        self._limit = limit
        self._window = window_seconds
        self._max_keys = max_keys
        self._clock = clock
        self._windows: OrderedDict[str, tuple[float, int]] = OrderedDict()

    def hit(self, key: str) -> float | None:
        """Count one request. None if allowed, else the seconds until the window resets."""
        now = self._clock()
        started, count = self._windows.get(key, (now, 0))
        if now - started >= self._window:
            started, count = now, 0
        if count >= self._limit:
            self._windows.move_to_end(key)
            return max(self._window - (now - started), 0.0)
        self._windows[key] = (started, count + 1)
        self._windows.move_to_end(key)
        while len(self._windows) > self._max_keys:
            self._windows.popitem(last=False)
        return None
