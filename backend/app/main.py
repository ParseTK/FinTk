"""Application factory.

``create_app`` builds a fully configured app from settings, so tests and tools can build variants
(production, custom origins) without touching global state. ``app`` is what uvicorn serves.
"""

from collections.abc import AsyncGenerator, Sequence
from contextlib import asynccontextmanager

import httpx
from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api import health
from app.api.v1 import router as v1_router
from app.core.config import Settings, get_settings
from app.core.errors import ERROR_RESPONSES, install_error_handlers
from app.core.logging import configure_logging
from app.core.middleware import (
    REQUEST_ID_HEADER,
    RequestContextMiddleware,
    SecurityHeadersMiddleware,
)
from app.providers.sample_prices import SamplePriceProvider
from app.providers.sec.client import SecProvider, build_http_client
from app.services.companies import CompanyService

_DOCS_PATHS = ("/docs", "/openapi.json")


def _lifespan(settings: Settings):
    """Builds the SEC-backed company service once, if none was injected, and closes its client."""

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
        client: httpx.AsyncClient | None = None
        if app.state.company_service is None and settings.sec_contact_email:
            client = build_http_client(settings.sec_contact_email)
            sec = SecProvider(client)
            app.state.company_service = CompanyService(sec, sec, sec, SamplePriceProvider())
        try:
            yield
        finally:
            if client is not None:
                await client.aclose()

    return lifespan


def create_app(
    settings: Settings | None = None,
    *,
    extra_routers: Sequence[APIRouter] = (),
    company_service: CompanyService | None = None,
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
    app.state.readiness_checks = {}
    app.state.company_service = company_service

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
