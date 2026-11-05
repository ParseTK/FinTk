"""Rate-limit guards: one for sign-in calls (per address) and one for writes (per person)."""

from fastapi import Request

from app.api.client_ip import client_key
from app.core.errors import RateLimitedError
from app.core.rate_limit import KeyedRateLimiter


def _enforce(limiter: KeyedRateLimiter, key: str) -> None:
    """Count one call for ``key``; refuse with a Retry-After when it is over its allowance."""
    retry_after = limiter.hit(key)
    if retry_after is not None:
        raise RateLimitedError(headers={"Retry-After": str(max(1, round(retry_after)))})


async def limit_auth_requests(request: Request) -> None:
    """Sign-in start and finish: limited per address, because there is no account yet."""
    limiter: KeyedRateLimiter = request.app.state.auth_limiter
    _enforce(limiter, client_key(request))


def limit_writes(request: Request, user_id: str) -> None:
    """Writes: limited per person, not per address. One person on a shared network should not be
    blocked by another, and one account cannot hammer the database from many addresses."""
    limiter: KeyedRateLimiter = request.app.state.write_limiter
    _enforce(limiter, user_id)
