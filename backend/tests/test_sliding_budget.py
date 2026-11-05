import pytest

from app.core.rate_limit import SlidingWindowBudget


class Clock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def test_allows_up_to_the_limit_then_refuses_with_the_wait() -> None:
    clock = Clock()
    budget = SlidingWindowBudget(3, 60, clock=clock)
    assert [budget.take() for _ in range(3)] == [None, None, None]
    clock.now = 20
    assert budget.take() == pytest.approx(40)


def test_a_slot_frees_exactly_when_the_oldest_call_leaves_the_window() -> None:
    clock = Clock()
    budget = SlidingWindowBudget(2, 60, clock=clock)
    assert budget.take() is None  # t=0
    clock.now = 30
    assert budget.take() is None  # t=30
    clock.now = 59.9
    assert budget.take() == pytest.approx(0.1)
    clock.now = 60
    assert budget.take() is None  # the t=0 call has left; a new one fits


def test_a_burst_straddling_a_fixed_window_boundary_is_still_limited() -> None:
    clock = Clock()
    budget = SlidingWindowBudget(2, 60, clock=clock)
    clock.now = 59
    assert budget.take() is None
    assert budget.take() is None
    clock.now = 61  # a fixed window would have reset here; the sliding one has not
    assert budget.take() is not None


def test_refused_calls_do_not_consume_budget() -> None:
    clock = Clock()
    budget = SlidingWindowBudget(1, 10, clock=clock)
    assert budget.take() is None
    for _ in range(50):
        assert budget.take() is not None
    clock.now = 10
    assert budget.take() is None


def test_memory_is_bounded_by_the_limit() -> None:
    clock = Clock()
    budget = SlidingWindowBudget(5, 60, clock=clock)
    for second in range(1000):
        clock.now = float(second)
        budget.take()
    assert len(budget._calls) <= 5  # pyright: ignore[reportPrivateUsage]


@pytest.mark.parametrize(("limit", "window"), [(0, 60), (1, 0), (-1, 5)])
def test_rejects_nonsense_configuration(limit: int, window: float) -> None:
    with pytest.raises(ValueError, match="positive"):
        SlidingWindowBudget(limit, window)


class TestSpend:
    """Calls that already happened and cost more than one credit are remembered, never refused."""

    def test_counts_extra_calls_against_the_limit(self) -> None:
        clock = Clock()
        budget = SlidingWindowBudget(5, 60, clock=clock)
        assert budget.take() is None  # one call
        budget.spend(3)  # it turned out to cost four credits in all
        assert budget.take() is None  # the fifth
        assert budget.take() is not None  # the sixth is refused

    def test_spending_never_refuses_even_past_the_limit(self) -> None:
        clock = Clock()
        budget = SlidingWindowBudget(2, 60, clock=clock)
        budget.spend(10)  # no exception: the credits are already gone
        assert budget.take() == pytest.approx(60)

    def test_what_was_spent_leaves_the_window_like_any_other_call(self) -> None:
        clock = Clock()
        budget = SlidingWindowBudget(3, 60, clock=clock)
        budget.spend(3)
        clock.now = 59
        assert budget.take() is not None
        clock.now = 60
        assert budget.take() is None

    @pytest.mark.parametrize("extra", [0, -1, -100])
    def test_nothing_or_less_than_nothing_changes_nothing(self, extra: int) -> None:
        clock = Clock()
        budget = SlidingWindowBudget(1, 60, clock=clock)
        budget.spend(extra)
        assert budget.take() is None
