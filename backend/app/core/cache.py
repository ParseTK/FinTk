"""A small async cache for provider data.

Three behaviours that matter when the data comes from a rate-limited third party:

- **Single flight**: if ten requests ask for the same missing key at once, the provider is called
  once and all ten share the answer.
- **Stale on error**: if a refresh fails but we hold an older copy that is still within
  ``stale_ttl``, serve it and log a warning, instead of failing the user because a provider blipped.
  The upstream is then left alone for ``stale_retry`` seconds, so an outage costs one failed call
  per interval, not one per request.
- **Bounded**: least-recently-used entries are evicted past ``max_entries``.

Failures are never cached.
"""

import asyncio
import logging
import time
from collections import OrderedDict
from collections.abc import Awaitable, Callable, Hashable
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class _Entry[V]:
    value: V
    fresh_until: float
    stale_until: float


class AsyncTTLCache[K: Hashable, V]:
    def __init__(
        self,
        *,
        max_entries: int = 1024,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        if max_entries < 1:
            msg = "max_entries must be at least 1"
            raise ValueError(msg)
        self._max_entries = max_entries
        self._clock = clock
        self._entries: OrderedDict[K, _Entry[V]] = OrderedDict()
        self._inflight: dict[K, asyncio.Task[V]] = {}

    def __len__(self) -> int:
        return len(self._entries)

    async def get_or_load(
        self,
        key: K,
        loader: Callable[[], Awaitable[V]],
        *,
        ttl: float,
        stale_ttl: float = 0.0,
        stale_retry: float = 30.0,
    ) -> V:
        entry = self._entries.get(key)
        if entry is not None and self._clock() < entry.fresh_until:
            self._entries.move_to_end(key)
            return entry.value

        task = self._inflight.get(key)
        if task is None:
            task = asyncio.create_task(self._load(key, loader, ttl, stale_ttl, stale_retry))
            self._inflight[key] = task
            task.add_done_callback(lambda finished: self._finished(key, finished))
        # shield: if this caller goes away (client disconnect), the load keeps running for others.
        return await asyncio.shield(task)

    def _finished(self, key: K, task: asyncio.Task[V]) -> None:
        self._inflight.pop(key, None)
        if not task.cancelled():
            task.exception()  # mark it as retrieved so an unwatched failure is not reported twice

    async def _load(
        self,
        key: K,
        loader: Callable[[], Awaitable[V]],
        ttl: float,
        stale_ttl: float,
        stale_retry: float,
    ) -> V:
        try:
            value = await loader()
        except Exception:
            stale = self._entries.get(key)
            if stale is not None and self._clock() < stale.stale_until:
                logger.warning("serving stale cache entry after a failed refresh", exc_info=True)
                # Back off: without this, every request during an outage would call the failing
                # upstream again and wait for its timeout, one after another.
                stale.fresh_until = self._clock() + stale_retry
                return stale.value
            raise

        now = self._clock()
        self._entries[key] = _Entry(value, fresh_until=now + ttl, stale_until=now + ttl + stale_ttl)
        self._entries.move_to_end(key)
        while len(self._entries) > self._max_entries:
            self._entries.popitem(last=False)
        return value
