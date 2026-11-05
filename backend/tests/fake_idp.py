"""A fake GitHub and Google, served through httpx.MockTransport.

The real provider classes run unchanged against it, so the tests cover our actual request and
response handling without any network or credentials. Each endpoint's reply can be overridden to
simulate failures.
"""

import json
from collections.abc import Callable
from typing import Any
from urllib.parse import parse_qs

import httpx

Reply = Callable[[httpx.Request], httpx.Response]


class FakeIdentityProviders:
    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []
        self.overrides: dict[str, Reply] = {}
        # What the "provider" knows about the person who signs in.
        self.github_user: dict[str, Any] = {
            "id": 4242,
            "login": "octo",
            "name": "Octo Cat",
            "avatar_url": "https://avatars.example/octo.png",
        }
        self.github_emails: list[dict[str, Any]] = [
            {"email": "Octo@Example.com", "primary": True, "verified": True},
            {"email": "other@example.com", "primary": False, "verified": True},
        ]
        self.google_info: dict[str, Any] = {
            "sub": "g-1001",
            "email": "octo@example.com",
            "email_verified": True,
            "name": "Octo Cat",
            "picture": "https://lh3.example/octo.png",
        }

    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self._handle)

    def client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=self.transport())

    def form(self, request_index: int = 0) -> dict[str, str]:
        """The form fields of the nth recorded request (token exchanges are form posts)."""
        body = parse_qs(self.requests[request_index].content.decode())
        return {key: values[0] for key, values in body.items()}

    def _handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        key = f"{request.url.host}{request.url.path}"
        if key in self.overrides:
            return self.overrides[key](request)
        match key:
            case "github.com/login/oauth/access_token" | "oauth2.googleapis.com/token":
                return httpx.Response(200, json={"access_token": "fake-access-token"})
            case "api.github.com/user":
                return httpx.Response(200, json=self.github_user)
            case "api.github.com/user/emails":
                return httpx.Response(200, content=json.dumps(self.github_emails))
            case "openidconnect.googleapis.com/v1/userinfo":
                return httpx.Response(200, json=self.google_info)
            case _:
                return httpx.Response(404)
