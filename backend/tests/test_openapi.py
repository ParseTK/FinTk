from typing import Any

from fastapi import FastAPI


def schema_of(app: FastAPI) -> dict[str, Any]:
    return app.openapi()


def test_the_schema_lists_the_public_routes(app: FastAPI) -> None:
    paths = schema_of(app)["paths"]
    assert {"/healthz", "/readyz", "/api/v1/meta"} <= set(paths)


def test_errors_are_documented_with_the_shared_shape(app: FastAPI) -> None:
    schema = schema_of(app)
    assert "ErrorResponse" in schema["components"]["schemas"]
    for path in ("/healthz", "/api/v1/meta"):
        responses = schema["paths"][path]["get"]["responses"]
        assert responses["422"]["content"]["application/json"]["schema"] == {
            "$ref": "#/components/schemas/ErrorResponse"
        }
        assert responses["500"]["content"]["application/json"]["schema"] == {
            "$ref": "#/components/schemas/ErrorResponse"
        }


def test_the_schema_has_no_leftover_default_validation_error(app: FastAPI) -> None:
    # Clients should see one error shape, not FastAPI's default HTTPValidationError alongside it.
    assert "HTTPValidationError" not in schema_of(app)["components"]["schemas"]


def test_the_schema_is_deterministic(app: FastAPI) -> None:
    # openapi() is cached by FastAPI, so compare against a freshly built app.
    from app.main import create_app
    from tests.conftest import make_settings, test_router

    fresh = create_app(make_settings(), extra_routers=[test_router])
    assert schema_of(fresh) == schema_of(app)
