"""The one place outbound HTTP clients are built, so every call out of the API has the same safety.

Every client gets an explicit timeout (nothing waits forever on a slow vendor) and never follows
redirects (a redirect could send a request, and any key in its headers, to a host nobody chose).
Callers add only what is specific to them: a base URL, headers, a different timeout.
"""

import httpx

DEFAULT_TIMEOUT = httpx.Timeout(10.0, connect=5.0)


def build_client(
    *,
    base_url: str = "",
    headers: dict[str, str] | None = None,
    timeout: httpx.Timeout = DEFAULT_TIMEOUT,
) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=base_url,
        headers=headers,
        timeout=timeout,
        follow_redirects=False,
    )
