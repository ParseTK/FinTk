"""Liveness and readiness, the two endpoints an orchestrator or load balancer polls.

- /healthz: "is the process up?" Never touches dependencies, so a slow database cannot make the
  platform kill a healthy process.
- /readyz: "can it serve traffic?" Runs the registered dependency checks (the database, later).
"""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Literal

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])

# A check raises (or times out) when its dependency is unhealthy.
ReadinessCheck = Callable[[], Awaitable[None]]

CHECK_TIMEOUT_SECONDS = 2.0


class HealthResponse(BaseModel):
    status: Literal["ok"]


class ReadinessResponse(BaseModel):
    status: Literal["ready", "not_ready"]
    # Names of the failing checks only. Error text is never exposed here.
    failed: list[str] = []


@router.get("/healthz", summary="Liveness")
async def healthz() -> HealthResponse:
    return HealthResponse(status="ok")


async def _run(name: str, check: ReadinessCheck) -> str | None:
    try:
        async with asyncio.timeout(CHECK_TIMEOUT_SECONDS):
            await check()
    except Exception:
        logger.warning("readiness check failed: %s", name, exc_info=True)
        return name
    return None


@router.get(
    "/readyz",
    summary="Readiness",
    responses={503: {"model": ReadinessResponse, "description": "A dependency is unavailable."}},
)
async def readyz(request: Request, response: Response) -> ReadinessResponse:
    checks: dict[str, ReadinessCheck] = request.app.state.readiness_checks
    results = await asyncio.gather(*(_run(name, check) for name, check in checks.items()))
    failed = sorted(name for name in results if name is not None)
    if failed:
        response.status_code = 503
        return ReadinessResponse(status="not_ready", failed=failed)
    return ReadinessResponse(status="ready")
