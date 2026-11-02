import pytest
from pydantic import ValidationError

from app.core.config import get_settings
from tests.conftest import IsolatedSettings, make_settings


def test_defaults_are_safe_for_local_development() -> None:
    settings = IsolatedSettings()
    assert settings.environment == "development"
    assert settings.cors_origins == ("http://localhost:3000",)
    assert settings.docs_active is True
    assert settings.sec_contact_email is None


def test_settings_are_read_from_the_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VIRELLO_ENVIRONMENT", "production")
    monkeypatch.setenv("VIRELLO_LOG_LEVEL", "WARNING")
    monkeypatch.setenv("VIRELLO_SEC_CONTACT_EMAIL", "ops@example.com")
    settings = IsolatedSettings()
    assert settings.environment == "production"
    assert settings.log_level == "WARNING"
    assert settings.sec_contact_email == "ops@example.com"
    assert settings.is_production is True


def test_cors_origins_are_a_comma_separated_list(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VIRELLO_CORS_ORIGINS", "https://a.example, https://b.example:8443 ,")
    settings = IsolatedSettings()
    assert settings.cors_origins == ("https://a.example", "https://b.example:8443")


@pytest.mark.parametrize(
    "origin",
    [
        "*",
        "example.com",  # no scheme
        "ftp://example.com",  # wrong scheme
        "https://example.com/app",  # has a path
        "https://example.com?x=1",
        "https://example.com#frag",
    ],
)
def test_unsafe_or_malformed_cors_origins_are_rejected(origin: str) -> None:
    with pytest.raises(ValidationError):
        make_settings(cors_origins=(origin,))


def test_a_wildcard_is_rejected_from_the_environment_too(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VIRELLO_CORS_ORIGINS", "*")
    with pytest.raises(ValidationError):
        IsolatedSettings()


def test_invalid_values_stop_the_app_at_startup(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VIRELLO_ENVIRONMENT", "staging")
    with pytest.raises(ValidationError):
        IsolatedSettings()


@pytest.mark.parametrize(
    ("environment", "docs_enabled", "expected"),
    [
        ("development", None, True),
        ("test", None, True),
        ("production", None, False),
        ("production", True, True),
        ("development", False, False),
    ],
)
def test_docs_default_to_off_in_production_unless_overridden(
    environment: str, docs_enabled: bool | None, expected: bool
) -> None:
    settings = make_settings(environment=environment, docs_enabled=docs_enabled)
    assert settings.docs_active is expected


def test_settings_cannot_be_changed_after_creation() -> None:
    settings = make_settings()
    with pytest.raises(ValidationError):
        settings.environment = "production"  # pyright: ignore[reportAttributeAccessIssue]


def test_get_settings_is_cached(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir("/")  # no stray .env
    get_settings.cache_clear()
    try:
        assert get_settings() is get_settings()
    finally:
        get_settings.cache_clear()
