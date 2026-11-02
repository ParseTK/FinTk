"""Version 1 of the public API, mounted at /api/v1.

Compatibility rule: v1 only ever changes additively. A rename or removal is a breaking change and
means a new version.
"""

from fastapi import APIRouter

from app.api.v1 import meta

router = APIRouter(prefix="/api/v1")
router.include_router(meta.router)
