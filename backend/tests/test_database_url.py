import pytest
from pydantic import ValidationError

from app.core.database_url import normalise_database_url, uses_tls_or_is_local
from tests.conftest import make_settings

NEON = (
    "postgresql://owner:placeholder-word@ep-example-123.us-east-2.aws.neon.tech/appdb"
    "?sslmode=require&channel_binding=require"
)


def test_a_hosted_string_becomes_the_async_driver_form() -> None:
    assert normalise_database_url(NEON) == (
        "postgresql+asyncpg://owner:placeholder-word@ep-example-123.us-east-2.aws.neon.tech/appdb"
        "?ssl=require"
    )


def test_the_short_scheme_and_surrounding_spaces_are_accepted() -> None:
    url = normalise_database_url("  postgres://u:p@h:5432/d ")
    assert url == "postgresql+asyncpg://u:p@h:5432/d"


def test_a_string_already_in_driver_form_is_unchanged() -> None:
    url = "postgresql+asyncpg://u:p@127.0.0.1:5433/d"
    assert normalise_database_url(url) == url


def test_other_options_are_kept() -> None:
    url = normalise_database_url("postgresql://u:p@h/d?sslmode=verify-full&application_name=x")
    assert url.endswith("?ssl=verify-full&application_name=x")


def test_tls_is_recognised_or_the_host_is_local() -> None:
    assert uses_tls_or_is_local("postgresql+asyncpg://u:p@db.example/d?ssl=require")
    assert uses_tls_or_is_local("postgresql+asyncpg://u:p@127.0.0.1:5433/d")
    assert not uses_tls_or_is_local("postgresql+asyncpg://u:p@db.example/d")
    assert not uses_tls_or_is_local("postgresql+asyncpg://u:p@db.example/d?ssl=disable")


def test_settings_accept_the_hosted_string_as_given() -> None:
    settings = make_settings(database_url=NEON)
    assert settings.database_url is not None
    assert settings.database_url.get_secret_value().startswith("postgresql+asyncpg://")
    assert "channel_binding" not in settings.database_url.get_secret_value()


def test_production_refuses_an_unencrypted_remote_database() -> None:
    with pytest.raises(ValidationError) as caught:
        make_settings(
            environment="production",
            database_url="postgresql://u:p@db.example/d",
            sec_contact_email="a@b.test",
        )
    assert "TLS" in str(caught.value)
    assert "p@db.example" not in str(caught.value)  # the password never reaches the message
