from httpx import AsyncClient

from tests.conftest import ClientFactory

SECURITY_HEADERS = {
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "cache-control": "no-store",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
}


async def test_every_response_carries_the_security_headers(client: AsyncClient) -> None:
    for path in ("/healthz", "/api/v1/meta", "/nope"):  # success and error responses
        response = await client.get(path)
        for name, value in SECURITY_HEADERS.items():
            assert response.headers[name] == value, f"{name} on {path}"


async def test_hsts_is_only_sent_in_production(
    client: AsyncClient, make_client: ClientFactory
) -> None:
    assert "strict-transport-security" not in (await client.get("/healthz")).headers

    production = await make_client(environment="production")
    header = (await production.get("/healthz")).headers["strict-transport-security"]
    assert "max-age=63072000" in header


async def test_docs_are_available_outside_production_with_a_relaxed_policy(
    client: AsyncClient,
) -> None:
    response = await client.get("/docs")
    assert response.status_code == 200
    assert "content-security-policy" not in response.headers
    assert (await client.get("/openapi.json")).status_code == 200


async def test_docs_and_schema_are_off_in_production(make_client: ClientFactory) -> None:
    production = await make_client(environment="production")
    assert (await production.get("/docs")).status_code == 404
    assert (await production.get("/openapi.json")).status_code == 404


async def test_docs_can_be_switched_on_explicitly(make_client: ClientFactory) -> None:
    production = await make_client(environment="production", docs_enabled=True)
    assert (await production.get("/docs")).status_code == 200


async def test_an_allowed_origin_gets_cors_headers_with_credentials(client: AsyncClient) -> None:
    response = await client.get("/healthz", headers={"Origin": "http://localhost:3000"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert response.headers["access-control-allow-credentials"] == "true"
    assert "X-Request-ID" in response.headers["access-control-expose-headers"]


async def test_a_disallowed_origin_gets_no_cors_headers(client: AsyncClient) -> None:
    response = await client.get("/healthz", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in response.headers
    # Starlette sends Allow-Credentials on every response when credentials are on. It is harmless:
    # a browser blocks the response unless Allow-Origin also matches, and that header is absent.


async def test_the_preflight_for_an_allowed_origin_succeeds(client: AsyncClient) -> None:
    response = await client.options(
        "/api/v1/meta",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "content-type,x-request-id",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "x-request-id" in response.headers["access-control-allow-headers"].lower()
    # The preflight is wrapped too: it has a request id and the security headers.
    assert "X-Request-ID" in response.headers
    assert response.headers["x-content-type-options"] == "nosniff"


async def test_the_preflight_for_a_disallowed_origin_is_rejected(client: AsyncClient) -> None:
    response = await client.options(
        "/api/v1/meta",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


async def test_configured_origins_replace_the_default(make_client: ClientFactory) -> None:
    http = await make_client(cors_origins=("https://app.virello.example",))
    allowed = await http.get("/healthz", headers={"Origin": "https://app.virello.example"})
    denied = await http.get("/healthz", headers={"Origin": "http://localhost:3000"})
    assert allowed.headers["access-control-allow-origin"] == "https://app.virello.example"
    assert "access-control-allow-origin" not in denied.headers
