"""Application settings.

Everything is read from environment variables prefixed ``VIRELLO_`` (and, for local development,
from an untracked ``.env`` file). Nothing secret is ever hard-coded, and invalid configuration stops
the app at startup instead of failing on a request.
"""

from functools import lru_cache
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

Environment = Literal["development", "test", "production"]
LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="VIRELLO_",
        env_file=".env",
        extra="ignore",
        frozen=True,
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
