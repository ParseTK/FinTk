import pytest

from scripts.check_migration_target import check
from tests.conftest import make_settings

REMOTE = "postgresql://u:placeholder-word@ep-example.us-east-2.aws.neon.tech/appdb?sslmode=require"


def test_a_remote_encrypted_database_is_allowed_and_only_the_host_is_returned() -> None:
    host = check(make_settings(database_url=REMOTE))
    assert host == "ep-example.us-east-2.aws.neon.tech"


@pytest.mark.parametrize("local", ["127.0.0.1:5433", "localhost:5432"])
def test_a_local_database_is_refused(local: str) -> None:
    with pytest.raises(SystemExit, match="local"):
        check(make_settings(database_url=f"postgresql://u:p@{local}/d"))


def test_an_unencrypted_remote_database_is_refused() -> None:
    with pytest.raises(SystemExit, match="not encrypted") as caught:
        check(make_settings(database_url="postgresql://u:placeholder-word@db.example/d"))
    assert "placeholder-word" not in str(caught.value)


def test_a_missing_url_is_refused() -> None:
    with pytest.raises(SystemExit, match="not set"):
        check(make_settings())
