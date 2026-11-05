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


# -- sign-in configuration -------------------------------------------------------------------------


def sign_in(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "github_client_id": "id",
        "github_client_secret": "secret",
        "secret_key": "k" * 40,
        "public_url": "https://virello.example",
    }
    return {**base, **overrides}


def test_sign_in_is_off_when_no_provider_is_configured() -> None:
    assert make_settings().enabled_providers == ()


def test_a_provider_is_enabled_only_with_both_id_and_secret() -> None:
    assert make_settings(**sign_in()).enabled_providers == ("github",)
    assert make_settings(
        **sign_in(google_client_id="g", google_client_secret="s")
    ).enabled_providers == (
        "github",
        "google",
    )


@pytest.mark.parametrize(
    "overrides",
    [
        {"github_client_secret": None},
        {"google_client_id": "only-an-id"},
        {"secret_key": None},
        {"public_url": None},
        {"secret_key": "too-short"},
        {"public_url": "https://virello.example/path"},
        {"public_url": "ftp://virello.example"},
    ],
)
def test_incomplete_or_malformed_sign_in_settings_stop_startup(
    overrides: dict[str, object],
) -> None:
    with pytest.raises(ValueError, match=r"."):
        make_settings(**sign_in(**overrides))


def test_production_requires_https_for_the_public_url() -> None:
    with pytest.raises(ValueError, match="https"):
        make_settings(**sign_in(environment="production", public_url="http://virello.example"))
    assert (
        make_settings(**sign_in(environment="production")).public_url == "https://virello.example"
    )


def test_secrets_never_appear_in_a_repr() -> None:
    text = repr(make_settings(**sign_in()))
    assert "secret" not in text.replace("secret_key", "").replace("client_secret", "")
    assert "kkkk" not in text
