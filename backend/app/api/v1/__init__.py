"""Version 1 of the public API, mounted at /api/v1.

Compatibility rule: v1 only ever changes additively. A rename or removal is a breaking change and
means a new version. (The stock endpoints were removed together, when the product became
crypto-only; nothing had been released.)
"""

from fastapi import APIRouter

from app.api.v1 import auth, crypto, me, meta, news

router = APIRouter(prefix="/api/v1")
router.include_router(meta.router)
router.include_router(crypto.router)
router.include_router(news.router)
router.include_router(auth.router)
router.include_router(me.router)
