import logging
from typing import Any, cast

import pytest
from httpx import AsyncClient


def error_of(response_json: dict[str, object]) -> dict[str, object]:
    error = response_json["error"]
    assert isinstance(error, dict)
    return error  # pyright: ignore[reportUnknownVariableType]


async def test_unknown_route_uses_the_error_shape(client: AsyncClient) -> None:
    response = await client.get("/nope")
    assert response.status_code == 404
    error = error_of(response.json())
    assert error["code"] == "not_found"
    assert error["request_id"] == response.headers["X-Request-ID"]


async def test_wrong_method_is_405(client: AsyncClient) -> None:
    response = await client.post("/healthz")
    assert response.status_code == 405
    assert error_of(response.json())["code"] == "method_not_allowed"


async def test_app_errors_map_to_their_status_and_code(client: AsyncClient) -> None:
    missing = await client.get("/__test/missing")
    assert missing.status_code == 404
    assert error_of(missing.json())["code"] == "not_found"
    assert error_of(missing.json())["message"] == "No such thing."

    conflict = await client.get("/__test/conflict")
    assert conflict.status_code == 409
    assert error_of(conflict.json())["code"] == "conflict"


async def test_validation_errors_list_each_problem(client: AsyncClient) -> None:
    response = await client.post("/__test/items", json={"name": "", "quantity": 0})
    assert response.status_code == 422
    error = error_of(response.json())
    assert error["code"] == "validation_error"
    details = cast("list[dict[str, Any]]", error["details"])
    locations = {tuple(detail["loc"]) for detail in details}
    assert locations == {("body", "name"), ("body", "quantity")}


async def test_validation_errors_never_echo_what_the_client_sent(client: AsyncClient) -> None:
    response = await client.post(
        "/__test/items",
        json={"name": "ok", "quantity": 1, "password": "hunter2-my-real-password"},
    )
    assert response.status_code == 422  # extra fields are forbidden
    assert "hunter2" not in response.text


async def test_unexpected_crashes_are_generic_and_leak_nothing(client: AsyncClient) -> None:
    response = await client.get("/__test/boom")
    assert response.status_code == 500
    assert error_of(response.json())["code"] == "internal_error"
    assert error_of(response.json())["message"] == "Something went wrong."
    assert "hunter2" not in response.text
    assert "RuntimeError" not in response.text
    assert "Traceback" not in response.text
    assert error_of(response.json())["request_id"] == response.headers["X-Request-ID"]


async def test_unexpected_crashes_are_logged_with_the_request_id(
    client: AsyncClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.ERROR, logger="app.request"):
        response = await client.get("/__test/boom")

    crash = [record for record in caplog.records if record.getMessage() == "unhandled error"]
    assert len(crash) == 1
    assert crash[0].exc_info is not None
    assert getattr(crash[0], "request_id", None) == response.headers["X-Request-ID"]
