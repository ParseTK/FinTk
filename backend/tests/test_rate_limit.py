import asyncio

import pytest

from app.core.rate_limit import AsyncRateLimiter, KeyedRateLimiter


class FakeTime:
    """A clock that only moves when something sleeps, so tests are instant and exact."""

    def __init__(self) -> None:
        self.now = 100.0
        self.sleeps: list[float] = []

    def clock(self) -> float:
        return self.now

    async def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


def test_a_non_positive_rate_is_rejected() -> None:
    with pytest.raises(ValueError, match="positive"):
        AsyncRateLimiter(0)


async def test_the_first_call_is_immediate() -> None:
    fake = FakeTime()
    limiter = AsyncRateLimiter(8, clock=fake.clock, sleep=fake.sleep)
    await limiter.acquire()
    assert fake.sleeps == []


async def test_back_to_back_calls_are_spaced_by_the_interval() -> None:
    fake = FakeTime()
    limiter = AsyncRateLimiter(8, clock=fake.clock, sleep=fake.sleep)  # 0.125 s apart

    for _ in range(4):
        await limiter.acquire()

    assert fake.sleeps == pytest.approx([0.125, 0.125, 0.125])


async def test_a_call_after_a_long_pause_does_not_wait() -> None:
    fake = FakeTime()
    limiter = AsyncRateLimiter(8, clock=fake.clock, sleep=fake.sleep)
    await limiter.acquire()
    fake.now += 5.0

    await limiter.acquire()

    assert fake.sleeps == []


async def test_concurrent_callers_each_get_their_own_slot() -> None:
    fake = FakeTime()
    waits: list[float] = []

    async def record_only(seconds: float) -> None:
        waits.append(seconds)  # the clock stays put, as it would while all callers queue at once

    limiter = AsyncRateLimiter(10, clock=fake.clock, sleep=record_only)  # 0.1 s apart

    await asyncio.gather(*(limiter.acquire() for _ in range(5)))

    # Five callers need slots at 0, 0.1, 0.2, 0.3 and 0.4 seconds after the first.
    assert sorted(waits) == pytest.approx([0.1, 0.2, 0.3, 0.4])


async def test_the_rate_never_exceeds_the_limit_over_a_burst() -> None:
    fake = FakeTime()
    limiter = AsyncRateLimiter(8, clock=fake.clock, sleep=fake.sleep)
    started = fake.now

    for _ in range(81):
        await limiter.acquire()

    elapsed = fake.now - started
    assert 80 / elapsed <= 8.0 + 1e-9  # 81 calls span 80 intervals


# -- KeyedRateLimiter ------------------------------------------------------------------------------


def make_keyed(
    limit: int = 3, window: float = 60.0, max_keys: int = 100
) -> tuple[KeyedRateLimiter, FakeTime]:
    fake = FakeTime()
    return KeyedRateLimiter(limit, window, max_keys=max_keys, clock=fake.clock), fake


def test_a_key_may_hit_up_to_the_limit_then_is_told_when_to_retry() -> None:
    limiter, fake = make_keyed(limit=3, window=60)
    assert [limiter.hit("a") for _ in range(3)] == [None, None, None]
    fake.now += 20
    assert limiter.hit("a") == pytest.approx(40.0)


def test_the_window_resets_after_it_passes() -> None:
    limiter, fake = make_keyed(limit=1, window=60)
    assert limiter.hit("a") is None
    assert limiter.hit("a") is not None
    fake.now += 60
    assert limiter.hit("a") is None


def test_keys_are_counted_independently() -> None:
    limiter, _ = make_keyed(limit=1)
    assert limiter.hit("a") is None
    assert limiter.hit("b") is None
    assert limiter.hit("a") is not None


def test_memory_is_bounded_by_forgetting_the_least_recently_used_key() -> None:
    limiter, _ = make_keyed(limit=1, max_keys=3)
    for key in "abcd":  # "a" is evicted when "d" arrives
        limiter.hit(key)
    assert limiter.hit("a") is None  # forgotten, so it starts fresh
    assert limiter.hit("d") is not None  # still remembered


@pytest.mark.parametrize("args", [(0, 60.0), (1, 0.0), (1, -1.0)])
def test_nonsense_limits_are_rejected(args: tuple[int, float]) -> None:
    with pytest.raises(ValueError, match="positive"):
        KeyedRateLimiter(*args)
