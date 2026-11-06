"""Who is calling, as far as the network can tell. Rate-limits requests that have no account."""

from fastapi import Request

from app.api.deps import get_settings_from

_MAX_ADDRESS_LENGTH = 64


def client_key(request: Request) -> str:
    """The caller's address, trusting ``X-Forwarded-For`` only as far as the proxies we run.

    ``trust_proxy_hops`` is how many proxies sit between the internet and this server. Each one
    appends the address it saw, so the Nth entry from the right is the real client. With no trusted
    proxy the header is ignored entirely, because anyone can send it.
    """
    hops = get_settings_from(request).trust_proxy_hops
    if hops:
        entries = [
            part.strip()
            for part in request.headers.get("x-forwarded-for", "").split(",")
            if part.strip()
        ]
        # Fewer entries than that means a proxy was skipped: nothing in the header can be believed.
        if len(entries) >= hops:
            return entries[-hops][:_MAX_ADDRESS_LENGTH]
    return request.client.host if request.client else "unknown"
