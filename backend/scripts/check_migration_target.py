"""Refuse to run migrations against the wrong database.

The release workflow runs this before ``alembic upgrade``. It reads the database URL the same way
the API does and stops unless the target is a remote host reached over TLS. A copy-paste slip that
points the secret at localhost (or at an unencrypted address) fails here, before any change.
It prints the host name only: the URL holds the password and must never reach a log.
"""

import sys
from urllib.parse import urlsplit

from app.core.config import Settings
from app.core.database_url import LOCAL_HOSTS, uses_tls_or_is_local


def check(settings: Settings) -> str:
    """Return the host to be migrated, or stop with a reason that contains no secrets."""
    if settings.database_url is None:
        raise SystemExit("VIRELLO_DATABASE_URL is not set.")
    url = settings.database_url.get_secret_value()
    host = urlsplit(url).hostname or ""
    if host in LOCAL_HOSTS or not host:
        raise SystemExit("Refusing to run: the database host is local, not the production one.")
    if not uses_tls_or_is_local(url):
        raise SystemExit(f"Refusing to run: the connection to {host} is not encrypted.")
    return host


def main() -> None:
    host = check(Settings())
    sys.stdout.write(f"Migration target: {host}\n")


if __name__ == "__main__":
    main()
