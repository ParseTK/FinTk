"""Turning a hosted database's connection string into the form our async driver wants.

Hosts such as Neon hand out ``postgresql://user:pass@host/db?sslmode=require&channel_binding=require``.
asyncpg understands neither the scheme-less driver nor those two query options, so the string is
rewritten once, at startup: the scheme gains ``+asyncpg``, ``sslmode`` becomes ``ssl`` (asyncpg's
name for the same setting), and ``channel_binding`` is dropped. Everything else is kept as given.
Nothing here logs or echoes the URL: it contains the password.
"""

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

DRIVER_SCHEME = "postgresql+asyncpg"
_PLAIN_SCHEMES = ("postgresql", "postgres")
_DROPPED_OPTIONS = frozenset({"channel_binding"})
LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})


def normalise_database_url(raw: str) -> str:
    parts = urlsplit(raw.strip())
    scheme = DRIVER_SCHEME if parts.scheme in _PLAIN_SCHEMES else parts.scheme
    options = [
        ("ssl" if name == "sslmode" else name, value)
        for name, value in parse_qsl(parts.query, keep_blank_values=True)
        if name not in _DROPPED_OPTIONS
    ]
    return urlunsplit((scheme, parts.netloc, parts.path, urlencode(options), parts.fragment))


def uses_tls_or_is_local(url: str) -> bool:
    """True when the connection is encrypted (an ``ssl`` option, not disable) or stays local."""
    parts = urlsplit(url)
    if parts.hostname in LOCAL_HOSTS:
        return True
    ssl = dict(parse_qsl(parts.query)).get("ssl")
    return ssl is not None and ssl not in {"disable", "allow", "prefer", "false", "0"}
