import asyncio

import pytest

from app.core.rate_limit import AsyncRateLimiter


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
