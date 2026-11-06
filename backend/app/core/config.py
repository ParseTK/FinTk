"""Application settings.

Everything is read from environment variables prefixed ``VIRELLO_`` (and, for local development,
from an untracked ``.env`` file). Nothing secret is ever hard-coded, and invalid configuration stops
the app at startup instead of failing on a request.
"""

from functools import lru_cache
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

from app.core.database_url import normalise_database_url, uses_tls_or_is_local

Environment = Literal["development", "test", "production"]
LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="VIRELLO_",
        env_file=".env",
        extra="ignore",
        frozen=True,
        # A rejected value is never echoed back: it may be a password or a key, and the message
        # goes to the host's logs.
        hide_input_in_errors=True,
    )

    environment: Environment = "development"
    log_level: LogLevel = "INFO"

    # Origins allowed to call the API from a browser. An explicit allowlist, never "*": the API will
    # use cookie credentials, and "*" with credentials is both forbidden by browsers and unsafe.
    # In the environment this is a comma-separated string.
    cors_origins: Annotated[tuple[str, ...], NoDecode] = ("http://localhost:3000",)

    # Interactive docs. Unset means "on everywhere except production".
    docs_enabled: bool | None = None

    # SEC EDGAR requires every automated client to identify itself with a contact. Only ever read
    # from the environment, never committed.
    sec_contact_email: str | None = None

    # Shared secret that proves a request comes from our own website server. Routes that return a
    # data vendor's content (the licence allows it only as part of our product, never on a
    # standalone basis) require it, so the API cannot be used as a public feed of that data. Unset
    # is allowed in development only; production fails closed.
    # Generate one with: openssl rand -base64 48
    internal_api_token: SecretStr | None = None

    # CoinMarketCap crypto data (free Basic plan: 15,000 credits a month, 50 calls a minute). Unset
    # means the crypto routes answer 503. The defaults keep a month under the plan with headroom
    # (450 a day is about 13,500). Sent only in a header, held as a secret.
    cmc_api_key: SecretStr | None = None
    cmc_calls_per_minute: int = Field(default=20, ge=1, le=50)
    cmc_credits_per_day: int = Field(default=450, ge=1, le=5000)

    # Postgres connection URL, e.g. postgresql+asyncpg://user:pass@host:5432/db. Held as a secret so
    # it never shows up in a repr, log line or traceback. Unset means "no database": the app still
    # starts and the data routes that need it answer 503.
    database_url: SecretStr | None = None

    # Connection pool. Bounded on purpose: a burst of requests queues for a connection (and then
    # fails fast with 503) instead of opening unbounded connections that overwhelm the database.
    db_pool_size: int = Field(default=5, ge=1, le=50)
    db_max_overflow: int = Field(default=5, ge=0, le=50)
    db_pool_timeout_seconds: float = Field(default=5.0, gt=0, le=60)
    db_pool_recycle_seconds: int = Field(default=1800, ge=60)
    # Server-side limits so one bad query or a forgotten transaction cannot hold the database.
    db_statement_timeout_ms: int = Field(default=5000, ge=100, le=120_000)
    db_idle_in_transaction_timeout_ms: int = Field(default=10_000, ge=100, le=120_000)

    # --- Sign-in -----------------------------------------------------------------------------
    # A provider is enabled only when both its client id and secret are set. None set means sign-in
    # is simply off. Secrets live in the environment or the host's secret store, never in git.
    github_client_id: str | None = None
    github_client_secret: SecretStr | None = None
    google_client_id: str | None = None
    google_client_secret: SecretStr | None = None

    # Signs the short-lived OAuth state cookie. Rotating it only invalidates logins in progress.
    secret_key: SecretStr | None = None
    # Public origin of the site users visit (the Next.js app, which proxies /api to this service),
    # e.g. https://fin-tk.example. OAuth redirect URIs and the CSRF Origin check derive from it.
    public_url: str | None = None

    session_idle_days: int = Field(default=30, ge=1, le=90)  # sliding: each visit extends it
    session_max_days: int = Field(default=90, ge=1, le=365)  # absolute: forces a fresh sign-in
    auth_requests_per_minute: int = Field(default=20, ge=1, le=600)  # per client, login endpoints
    # How many proxies you control sit in front of this service and each append the address they
    # saw to X-Forwarded-For (for example one load balancer: 1). The client address is then the
    # Nth entry from the right; entries further left are client-supplied and ignored. 0 means do
    # not read the header at all (every request then appears to come from the nearest proxy). If the
    # header holds fewer entries than expected, the request skipped a proxy and the socket address
    # is used instead, so a client cannot choose its own rate-limit bucket by sending the header.
    trust_proxy_hops: int = Field(default=0, ge=0, le=5)

    # --- Per-user limits (space and abuse bounds) ------------------------------------------
    writes_per_minute: int = Field(default=60, ge=1, le=1200)  # per signed-in user

    @field_validator("secret_key")
    @classmethod
    def _validate_secret_key(cls, key: SecretStr | None) -> SecretStr | None:
        if key is not None and len(key.get_secret_value()) < 32:
            msg = "secret_key must be at least 32 characters (try: openssl rand -base64 48)"
            raise ValueError(msg)
        return key

    @field_validator("internal_api_token")
    @classmethod
    def _validate_internal_api_token(cls, token: SecretStr | None) -> SecretStr | None:
        if token is not None and len(token.get_secret_value()) < 32:
            msg = "internal_api_token must be at least 32 characters (try: openssl rand -base64 48)"
            raise ValueError(msg)
        return token

    @field_validator("public_url")
    @classmethod
    def _validate_public_url(cls, url: str | None) -> str | None:
        if url is None:
            return None
        parts = urlsplit(url)
        bare = (
            parts.scheme in {"http", "https"}
            and bool(parts.netloc)
            and parts.path in {"", "/"}
            and not parts.query
            and not parts.fragment
        )
        if not bare:
            msg = "public_url must look like https://example.com[:port] (no path)"
            raise ValueError(msg)
        return url.rstrip("/")

    @model_validator(mode="after")
    def _check_sign_in_is_complete(self) -> "Settings":
        for name, id_, secret in (
            ("github", self.github_client_id, self.github_client_secret),
            ("google", self.google_client_id, self.google_client_secret),
        ):
            if (id_ is None) != (secret is None):
                msg = f"{name}: set both the client id and the client secret, or neither"
                raise ValueError(msg)
        if self.enabled_providers and (self.secret_key is None or self.public_url is None):
            msg = "sign-in needs VIRELLO_SECRET_KEY and VIRELLO_PUBLIC_URL"
            raise ValueError(msg)
        if self.is_production and self.public_url and not self.public_url.startswith("https://"):
            msg = "public_url must be https in production"
            raise ValueError(msg)
        return self

    @model_validator(mode="after")
    def _check_database_is_encrypted(self) -> "Settings":
        if (
            self.is_production
            and self.database_url is not None
            and not uses_tls_or_is_local(self.database_url.get_secret_value())
        ):
            msg = "the production database connection must use TLS (add ?sslmode=require)"
            raise ValueError(msg)
        return self

    @model_validator(mode="after")
    def _check_vendor_data_is_gated(self) -> "Settings":
        # The vendor licence allows its data only inside our product, never as a public feed. In
        # production the routes that return it must therefore be behind the internal token.
        if self.is_production and self.cmc_api_key is not None and self.internal_api_token is None:
            msg = "VIRELLO_INTERNAL_API_TOKEN is required in production when a crypto key is set"
            raise ValueError(msg)
        return self

    @property
    def enabled_providers(self) -> tuple[str, ...]:
        enabled: list[str] = []
        if self.github_client_id and self.github_client_secret:
            enabled.append("github")
        if self.google_client_id and self.google_client_secret:
            enabled.append("google")
        return tuple(enabled)

    @field_validator("database_url", mode="before")
    @classmethod
    def _accept_hosted_database_url(cls, value: object) -> object:
        # A hosted database's own string (postgresql://...?sslmode=require) is accepted as given.
        if isinstance(value, SecretStr):
            value = value.get_secret_value()
        return normalise_database_url(value) if isinstance(value, str) else value

    @field_validator("database_url")
    @classmethod
    def _validate_database_url(cls, url: SecretStr | None) -> SecretStr | None:
        if url is not None and not url.get_secret_value().startswith("postgresql+asyncpg://"):
            msg = "database_url must start with postgresql+asyncpg:// (the async driver)"
            raise ValueError(msg)
        return url

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return tuple(part.strip() for part in value.split(",") if part.strip())
        return value

    @field_validator("cors_origins")
    @classmethod
    def _validate_origins(cls, origins: tuple[str, ...]) -> tuple[str, ...]:
        for origin in origins:
            if origin == "*":
                msg = 'CORS origin "*" is not allowed; list explicit origins instead'
                raise ValueError(msg)
            parts = urlsplit(origin)
            is_bare_origin = (
                parts.scheme in {"http", "https"}
                and bool(parts.netloc)
                and parts.path == ""
                and not parts.query
                and not parts.fragment
            )
            if not is_bare_origin:
                msg = f"CORS origin {origin!r} must look like https://example.com[:port] (no path)"
                raise ValueError(msg)
        return origins

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def docs_active(self) -> bool:
        if self.docs_enabled is not None:
            return self.docs_enabled
        return not self.is_production


@lru_cache
def get_settings() -> Settings:
    return Settings()
