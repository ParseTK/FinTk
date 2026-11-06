"""Application factory.

``create_app`` builds a fully configured app from settings, so tests and tools can build variants
(production, custom origins) without touching global state. ``app`` is what uvicorn serves.
"""

from collections.abc import AsyncGenerator, Mapping, Sequence
from contextlib import AsyncExitStack, asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api import health
from app.api.health import ReadinessCheck
from app.api.v1 import router as v1_router
from app.auth.providers import OAuthProvider
from app.core.config import Settings, get_settings
from app.core.error_handlers import install_error_handlers
from app.core.errors import ERROR_RESPONSES
from app.core.logging import configure_logging
from app.core.middleware import (
    REQUEST_ID_HEADER,
    RequestContextMiddleware,
    SecurityHeadersMiddleware,
)
from app.core.rate_limit import KeyedRateLimiter
from app.db.engine import Database
from app.services.companies import CompanyService
from app.services.crypto import CryptoService
from app.services.news import NewsService
from app.startup import open_resources

_DOCS_PATHS = ("/docs", "/openapi.json")


def _lifespan(settings: Settings):
    """Opens the configured resources when the app starts and closes them all when it stops.

    What is built, and how each piece is closed, is app.startup; this only holds the exit stack open
    for the life of the app.
    """

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
        async with AsyncExitStack() as stack:
            open_resources(app, settings, stack)
            yield

    return lifespan


def create_app(
    settings: Settings | None = None,
    *,
    extra_routers: Sequence[APIRouter] = (),
    company_service: CompanyService | None = None,
    news_service: NewsService | None = None,
    crypto_service: CryptoService | None = None,
    database: Database | None = None,
    oauth_providers: Mapping[str, OAuthProvider] | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    if settings.is_production and not settings.sec_contact_email and company_service is None:
        msg = "VIRELLO_SEC_CONTACT_EMAIL is required in production (SEC identifies clients by it)."
        raise ValueError(msg)
    configure_logging(settings.log_level)

    app = FastAPI(
        title="Virello API",
        version=__version__,
        # Interactive docs and the schema are off in production.
        docs_url="/docs" if settings.docs_active else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.docs_active else None,
        lifespan=_lifespan(settings),
    )
    app.state.settings = settings
    readiness_checks: dict[str, ReadinessCheck] = {}
    app.state.readiness_checks = readiness_checks
    app.state.company_service = company_service
    app.state.news_service = news_service
    app.state.crypto_service = crypto_service
    app.state.database = database
    app.state.oauth_providers = dict(oauth_providers or {})
    app.state.auth_limiter = KeyedRateLimiter(settings.auth_requests_per_minute)
    app.state.write_limiter = KeyedRateLimiter(settings.writes_per_minute)
    if database is not None:
        readiness_checks["database"] = database.ping

    install_error_handlers(app)
    app.include_router(health.router, responses=ERROR_RESPONSES)
    app.include_router(v1_router, responses=ERROR_RESPONSES)
    for router in extra_routers:
        app.include_router(router, responses=ERROR_RESPONSES)

    # Added innermost first: the last one added is the outermost, so the request id and the security
    # headers wrap every response, including CORS preflights and errors.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", REQUEST_ID_HEADER],
        expose_headers=[REQUEST_ID_HEADER],
        max_age=600,
    )
    app.add_middleware(
        SecurityHeadersMiddleware,
        hsts=settings.is_production,
        relaxed_paths=_DOCS_PATHS if settings.docs_active else (),
    )
    app.add_middleware(RequestContextMiddleware)
    return app


app = create_app()
