import asyncio
import json
from types import SimpleNamespace

from fastapi import HTTPException
from starlette.requests import Request

import server


def _request(path, method="POST"):
    return Request({
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("utf-8"),
        "query_string": b"",
        "headers": [],
        "client": ("testclient", 123),
        "server": ("testserver", 80),
        "root_path": "",
    })


def test_error_text_redacts_passwords_and_authorization_tokens():
    jwt = ".".join(["a" * 12, "b" * 12, "c" * 12])
    text = (
        "password=private 'owner_password': 'otherprivate' "
        "authorization=Bearer abc123 token=xyz789 "
        f"mongodb://user:dbpass@db.example/{jwt}"
    )

    redacted = server._redact_error_text(text)

    assert "private" not in redacted
    assert "otherprivate" not in redacted
    assert "abc123" not in redacted
    assert "xyz789" not in redacted
    assert "dbpass" not in redacted
    assert jwt not in redacted


def test_logged_server_error_has_reference_and_no_request_payload(monkeypatch):
    records = []

    class ErrorLogs:
        async def insert_one(self, record):
            records.append(record)

    monkeypatch.setattr(server, "platform_db", SimpleNamespace(error_logs=ErrorLogs()))
    request = SimpleNamespace(
        url=SimpleNamespace(path="/api/write"),
        method="POST",
        body=b'{"password":"do-not-log"}',
        headers={"authorization": "Bearer do-not-log"},
    )

    asyncio.run(server._record_server_error(
        request, 500, "reference-123", "Database operation failed",
        "Traceback: Database operation failed",
    ))

    assert len(records) == 1
    record = records[0]
    assert record["reference_id"] == "reference-123"
    assert record["detail"].startswith("Reference reference-123:")
    assert record["traceback"] == "Traceback: Database operation failed"
    assert "body" not in record
    assert "headers" not in record


def test_http_4xx_details_remain_meaningful():
    request = SimpleNamespace(state=SimpleNamespace(reference_id="reference-123"))
    request = _request("/api/write")
    request.state.reference_id = "reference-123"

    response = asyncio.run(server.http_exception_handler(
        request, HTTPException(status_code=422, detail="Trip date is required"),
    ))

    assert response.status_code == 422
    assert response.body == b'{"detail":"Trip date is required"}'


def test_http_5xx_returns_safe_message_and_logs_exception(monkeypatch):
    logged = []

    async def record_error(*args):
        logged.append(args[1:])

    monkeypatch.setattr(server, "_record_server_error", record_error)
    request = SimpleNamespace(state=SimpleNamespace(reference_id="reference-500"))
    request = _request("/api/write")
    request.state.reference_id = "reference-500"

    response = asyncio.run(server.http_exception_handler(
        request, HTTPException(status_code=500, detail="Database connection failed"),
    ))

    assert response.status_code == 500
    assert b"Database connection failed" not in response.body
    assert b"reference-500" in response.body
    assert logged == [(500, "reference-500", "Database connection failed",
                       "HTTPException: Database connection failed")]


def test_middleware_logs_failed_write_safely_without_request_data(monkeypatch):
    records = []

    class ErrorLogs:
        async def insert_one(self, record):
            records.append(record)

    monkeypatch.setattr(server, "platform_db", SimpleNamespace(error_logs=ErrorLogs()))
    request = SimpleNamespace(
        state=SimpleNamespace(),
        url=SimpleNamespace(path="/api/trips/123"),
        method="PATCH",
        body=b'{"password":"request-secret"}',
        headers={"authorization": "Bearer request-token"},
    )
    response = SimpleNamespace(
        status_code=422,
        headers={},
        body=json.dumps({"detail": [
            {"loc": ["body", "amount"], "msg": "Input should be greater than 0",
             "input": "sensitive-input", "ctx": {"private": "also-sensitive"}},
        ]}).encode(),
    )
    request = _request("/api/trips/123", "PATCH")

    result = asyncio.run(server.log_failures(request, lambda _: _return(response)))

    assert result is response
    assert len(records) == 1
    record = records[0]
    assert record["method"] == "PATCH"
    assert record["path"] == "/api/trips/123"
    assert record["status"] == 422
    assert record["reference_id"]
    assert record["detail"].startswith(f"Reference {record['reference_id']}: amount: Input should be greater than 0")
    serialized_record = json.dumps(record)
    assert "request-secret" not in serialized_record
    assert "request-token" not in serialized_record
    assert "sensitive-input" not in serialized_record
    assert "also-sensitive" not in serialized_record
    assert "body" not in record and "headers" not in record and "query" not in record


def test_middleware_does_not_log_auth_login_401(monkeypatch):
    records = []

    class ErrorLogs:
        async def insert_one(self, record):
            records.append(record)

    monkeypatch.setattr(server, "platform_db", SimpleNamespace(error_logs=ErrorLogs()))
    request = SimpleNamespace(
        state=SimpleNamespace(),
        url=SimpleNamespace(path="/api/auth/login"),
        method="POST",
        body=b'{"username":"owner","password":"invalid"}',
        headers={"authorization": "Bearer token"},
    )
    response = SimpleNamespace(
        status_code=401,
        headers={},
        body=b'{"detail":"Wrong username or password"}',
    )
    request = _request("/api/auth/login")

    result = asyncio.run(server.log_failures(request, lambda _: _return(response)))

    assert result is response
    assert records == []


async def _return(value):
    return value
