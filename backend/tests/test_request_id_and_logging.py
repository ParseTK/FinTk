import json
import logging
import re

import pytest
from httpx import AsyncClient

from app.core.logging import JsonFormatter


async def test_a_request_id_is_generated(client: AsyncClient) -> None:
    response = await client.get("/healthz")
    assert re.fullmatch(r"[0-9a-f]{32}", response.headers["X-Request-ID"])


async def test_ids_are_unique_per_request(client: AsyncClient) -> None:
    first = await client.get("/healthz")
    second = await client.get("/healthz")
    assert first.headers["X-Request-ID"] != second.headers["X-Request-ID"]


async def test_a_plain_incoming_id_is_kept_so_it_can_flow_from_the_frontend(
    client: AsyncClient,
) -> None:
    response = await client.get("/healthz", headers={"X-Request-ID": "web-1234-abcd"})
    assert response.headers["X-Request-ID"] == "web-1234-abcd"


@pytest.mark.parametrize(
    "bad_id",
    [
        "short",  # too short
        "x" * 65,  # too long
        "has spaces in it",
        "semi;colon=injection",
        "<script>alert(1)</script>",
    ],
)
async def test_an_untrustworthy_incoming_id_is_replaced(client: AsyncClient, bad_id: str) -> None:
    response = await client.get("/healthz", headers={"X-Request-ID": bad_id})
    assert response.headers["X-Request-ID"] != bad_id
    assert re.fullmatch(r"[0-9a-f]{32}", response.headers["X-Request-ID"])


async def test_the_request_log_has_the_id_and_never_the_query_string(
    client: AsyncClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.INFO, logger="app.request"):
        response = await client.get("/healthz?token=super-secret-value")

    lines = [record for record in caplog.records if record.getMessage() == "request"]
    assert len(lines) == 1
    record = lines[0]
    fields = record.fields  # pyright: ignore[reportAttributeAccessIssue,reportUnknownVariableType,reportUnknownMemberType]
    assert fields["path"] == "/healthz"
    assert fields["method"] == "GET"
    assert fields["status"] == 200
    assert getattr(record, "request_id", None) == response.headers["X-Request-ID"]
    assert "super-secret-value" not in json.dumps(fields)
    # Only our server's own log lines count here (the test client logs the URL it called).
    ours = [r for r in caplog.records if r.name == "app.request"]
    assert all("super-secret-value" not in r.getMessage() for r in ours)
    assert all("super-secret-value" not in str(getattr(r, "fields", "")) for r in ours)


async def test_the_request_log_counts_forwarded_addresses_without_recording_them(
    client: AsyncClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.INFO, logger="app.request"):
        await client.get("/healthz", headers={"X-Forwarded-For": "203.0.113.7, 198.51.100.2"})
        await client.get("/healthz")

    fields: list[dict[str, object]] = [
        r.fields  # pyright: ignore[reportAttributeAccessIssue,reportUnknownMemberType]
        for r in caplog.records
        if r.name == "app.request" and r.getMessage() == "request"
    ]
    assert [f["forwarded_entries"] for f in fields] == [2, 0]
    assert "203.0.113.7" not in json.dumps(fields)


def test_the_json_formatter_emits_one_json_object_per_line() -> None:
    record = logging.LogRecord("x", logging.INFO, __file__, 1, "hello %s", ("world",), None)
    record.request_id = "abc"
    record.fields = {"status": 200}
    parsed = json.loads(JsonFormatter().format(record))
    assert parsed["message"] == "hello world"
    assert parsed["level"] == "INFO"
    assert parsed["request_id"] == "abc"
    assert parsed["status"] == 200
