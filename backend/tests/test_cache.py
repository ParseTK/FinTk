import asyncio

import pytest

from app.core.cache import AsyncTTLCache


class Clock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


class Counter:
    """A loader that counts its calls and can be told to fail."""

    def __init__(self, value: str = "v") -> None:
        self.calls = 0
        self.value = value
        self.fail = False

    async def __call__(self) -> str:
        self.calls += 1
        if self.fail:
            msg = "provider down"
            raise ConnectionError(msg)
        return f"{self.value}{self.calls}"


async def test_a_fresh_value_is_served_without_calling_the_loader_again() -> None:
    cache: AsyncTTLCache[str, str] = AsyncTTLCache(clock=Clock())
    loader = Counter()

    first = await cache.get_or_load("k", loader, ttl=60)
    second = await cache.get_or_load("k", loader, ttl=60)

    assert first == second == "v1"
    assert loader.calls == 1


async def test_an_expired_value_is_reloaded() -> None:
    clock = Clock()
    cache: AsyncTTLCache[str, str] = AsyncTTLCache(clock=clock)
    loader = Counter()
    await cache.get_or_load("k", loader, ttl=60)

    clock.now = 61
    again = await cache.get_or_load("k", loader, ttl=60)

    assert again == "v2"
    assert loader.calls == 2


async def test_concurrent_requests_for_one_key_share_a_single_load() -> None:
    cache: AsyncTTLCache[str, str] = AsyncTTLCache(clock=Clock())
    gate = asyncio.Event()
    calls = 0

    async def slow() -> str:
        nonlocal calls
        calls += 1
        await gate.wait()
        return "shared"

    tasks = [asyncio.create_task(cache.get_or_load("k", slow, ttl=60)) for _ in range(10)]
    await asyncio.sleep(0)  # let all ten reach the cache
    gate.set()
    results = await asyncio.gather(*tasks)

    assert results == ["shared"] * 10
    assert calls == 1


async def test_different_keys_load_independently() -> None:
    cache: AsyncTTLCache[str, str] = AsyncTTLCache(clock=Clock())
    a, b = Counter("a"), Counter("b")

    assert await cache.get_or_load("a", a, ttl=60) == "a1"
    assert await cache.get_or_load("b", b, ttl=60) == "b1"
    assert (a.calls, b.calls) == (1, 1)


async def test_a_failure_is_raised_and_not_cached() -> None:
    cache: AsyncTTLCache[str, str] = AsyncTTLCache(clock=Clock())
    loader = Counter()
    loader.fail = True

    with pytest.raises(ConnectionError):
        await cache.get_or_load("k", loader, ttl=60)

    loader.fail = False
    assert await cache.get_or_load("k", loader, ttl=60) == "v2"  # the failed call counted as call 1


async def test_a_stale_copy_is_served_when_the_refresh_fails() -> None:
    clock = Clock()
    cache: AsyncTTLCache[str, str] = AsyncTTLCache(clock=clock)
    loader = Counter()
    await cache.get_or_load("k", loader, ttl=60, stale_ttl=3600)

    clock.now = 120  # expired, but within the stale window
    loader.fail = True
    served = await cache.get_or_load("k", loader, ttl=60, stale_ttl=3600)

    assert served == "v1"


async def test_a_copy_past_the_stale_window_is_not_served() -> None:
    clock = Clock()
    cache: AsyncTTLCache[str, str] = AsyncTTLCache(clock=clock)
    loader = Counter()
    await cache.get_or_load("k", loader, ttl=60, stale_ttl=3600)

    clock.now = 60 + 3600 + 1
    loader.fail = True

    with pytest.raises(ConnectionError):
        await cache.get_or_load("k", loader, ttl=60, stale_ttl=3600)


async def test_no_stale_window_means_no_stale_fallback() -> None:
    clock = Clock()
    cache: AsyncTTLCache[str, str] = AsyncTTLCache(clock=clock)
    loader = Counter()
    await cache.get_or_load("k", loader, ttl=60)

    clock.now = 61
    loader.fail = True

    with pytest.raises(ConnectionError):
        await cache.get_or_load("k", loader, ttl=60)


async def test_the_least_recently_used_entry_is_evicted() -> None:
    cache: AsyncTTLCache[str, str] = AsyncTTLCache(max_entries=2, clock=Clock())
    a, b, c = Counter("a"), Counter("b"), Counter("c")
    await cache.get_or_load("a", a, ttl=60)
    await cache.get_or_load("b", b, ttl=60)
    await cache.get_or_load("a", a, ttl=60)  # touch a, so b is now the oldest

    await cache.get_or_load("c", c, ttl=60)  # evicts b

    assert len(cache) == 2
    await cache.get_or_load("a", a, ttl=60)
    assert a.calls == 1  # still cached
    await cache.get_or_load("b", b, ttl=60)
    assert b.calls == 2  # had been evicted, so it loaded again


async def test_a_load_survives_its_first_caller_going_away() -> None:
    cache: AsyncTTLCache[str, str] = AsyncTTLCache(clock=Clock())
    gate = asyncio.Event()

    async def slow() -> str:
        await gate.wait()
        return "done"

    first = asyncio.create_task(cache.get_or_load("k", slow, ttl=60))
    await asyncio.sleep(0)
    second = asyncio.create_task(cache.get_or_load("k", slow, ttl=60))
    await asyncio.sleep(0)

    first.cancel()  # the first client disconnects
    gate.set()

    assert await second == "done"


def test_a_cache_needs_room_for_at_least_one_entry() -> None:
    with pytest.raises(ValueError, match="at least 1"):
        AsyncTTLCache(max_entries=0)
