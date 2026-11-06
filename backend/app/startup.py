"""Opening the long-lived resources the app needs, and closing exactly what it opened.

Each ``_open_*`` function owns one subsystem: it builds it only when it is configured and has not
been injected (tests inject their own), stores it on ``app.state``, and registers how to close it on
the exit stack. Nothing connects until first use, and everything registered is closed on shutdown
even if closing one of them fails. ``create_app`` decides what the app is; this decides what starts.
"""

from contextlib import AsyncExitStack

from fastapi import FastAPI

from app.api.health import ReadinessCheck
from app.auth.providers import build_oauth_providers
from app.core.config import Settings
from app.core.http import build_client
from app.core.rate_limit import SlidingWindowBudget
from app.db.engine import Database
from app.providers.coinmarketcap.client import CoinMarketCapProvider
from app.providers.coinmarketcap.client import build_http_client as build_crypto_client
from app.providers.feeds import FeedProvider
from app.providers.sec.client import SecProvider, build_http_client, build_user_agent
from app.services.companies import CompanyService
from app.services.crypto import CryptoService
from app.services.news import NewsService

_SECONDS_PER_MINUTE = 60
_SECONDS_PER_DAY = 86_400


def open_resources(app: FastAPI, settings: Settings, stack: AsyncExitStack) -> None:
    """Build each configured subsystem that was not injected, news after companies."""
    _open_sign_in(app, settings, stack)
    _open_database(app, settings, stack)
    _open_companies(app, settings, stack)
    _open_news(app, settings, stack)
    _open_crypto(app, settings, stack)


def _open_sign_in(app: FastAPI, settings: Settings, stack: AsyncExitStack) -> None:
    if app.state.oauth_providers or not settings.enabled_providers:
        return
    client = build_client()
    stack.push_async_callback(client.aclose)
    app.state.oauth_providers = build_oauth_providers(settings, client)


def _open_database(app: FastAPI, settings: Settings, stack: AsyncExitStack) -> None:
    if app.state.database is not None or settings.database_url is None:
        return
    database = Database.from_settings(settings)
    stack.push_async_callback(database.dispose)
    app.state.database = database
    checks: dict[str, ReadinessCheck] = app.state.readiness_checks
    checks["database"] = database.ping


def _open_companies(app: FastAPI, settings: Settings, stack: AsyncExitStack) -> None:
    if app.state.company_service is not None or not settings.sec_contact_email:
        return
    client = build_http_client(settings.sec_contact_email)
    stack.push_async_callback(client.aclose)
    sec = SecProvider(client)
    app.state.company_service = CompanyService(sec, sec)


def _open_news(app: FastAPI, settings: Settings, stack: AsyncExitStack) -> None:
    if app.state.news_service is not None:
        return
    client = build_client(
        headers={
            "User-Agent": build_user_agent(settings.sec_contact_email or "no contact set"),
            "Accept": "application/rss+xml, application/xml",
        },
    )
    stack.push_async_callback(client.aclose)
    app.state.news_service = NewsService(FeedProvider(client), app.state.company_service)


def _open_crypto(app: FastAPI, settings: Settings, stack: AsyncExitStack) -> None:
    if app.state.crypto_service is not None or settings.cmc_api_key is None:
        return
    client = build_crypto_client(settings.cmc_api_key.get_secret_value())
    stack.push_async_callback(client.aclose)
    provider = CoinMarketCapProvider(
        client,
        per_minute=SlidingWindowBudget(settings.cmc_calls_per_minute, _SECONDS_PER_MINUTE),
        per_day=SlidingWindowBudget(settings.cmc_credits_per_day, _SECONDS_PER_DAY),
    )
    app.state.crypto_service = CryptoService(provider)
