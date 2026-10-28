"""Cross-origin policy: only a listed browser origin may read the API."""

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import create_app


def _client(monkeypatch, origins: str) -> TestClient:
    monkeypatch.setattr(settings, "cors_allow_origins", origins)
    return TestClient(create_app())


def test_the_allowlist_ignores_padding_and_blank_entries(monkeypatch) -> None:
    monkeypatch.setattr(settings, "cors_allow_origins", " https://a.example , ,https://b.example ")
    assert settings.cors_origins == ["https://a.example", "https://b.example"]


def test_an_unset_allowlist_leaves_the_api_same_origin_only(monkeypatch) -> None:
    # This is the shipped default: the dev proxy and any server-side client are
    # same-origin, and a page we have not named gets no readable response.
    response = _client(monkeypatch, "").get("/health", headers={"Origin": "https://console.example"})
    assert response.headers.get("access-control-allow-origin") is None


def test_a_listed_origin_is_answered_without_credentials(monkeypatch) -> None:
    client = _client(monkeypatch, "https://console.example")

    preflight = client.options(
        "/health",
        headers={
            "Origin": "https://console.example",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == "https://console.example"
    assert "authorization" in preflight.headers["access-control-allow-headers"].lower()
    # A preflight is answered by the CORS layer without reaching a route, so it is
    # the response least likely to carry the usual headers. It does, because this
    # middleware sits inside the request-context one.
    assert preflight.headers["x-content-type-options"] == "nosniff"
    assert preflight.headers["x-frame-options"] == "DENY"

    response = client.get("/health", headers={"Origin": "https://console.example"})
    assert response.headers["access-control-allow-origin"] == "https://console.example"
    # The bearer token is set by the console itself, never a cookie the browser
    # attaches, so credentialed requests stay refused even for a listed origin.
    assert response.headers.get("access-control-allow-credentials") is None


def test_an_unlisted_origin_gets_no_cors_headers(monkeypatch) -> None:
    response = _client(monkeypatch, "https://console.example").get(
        "/health", headers={"Origin": "https://another.example"}
    )
    assert response.headers.get("access-control-allow-origin") is None


def test_starting_an_audit_may_ask_for_the_idempotency_key(monkeypatch) -> None:
    # An audit POST carries an Idempotency-Key, so the browser preflights for it. A
    # preflight naming a header outside the allowlist is answered 400 by the CORS
    # layer before routing, which reads as a broken endpoint, not a missing setting.
    client = _client(monkeypatch, "https://console.example")
    preflight = client.options(
        "/api/v1/projects/00000000-0000-0000-0000-000000000000/scans",
        headers={
            "Origin": "https://console.example",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type,idempotency-key",
        },
    )
    assert preflight.status_code == 200
    assert "idempotency-key" in preflight.headers["access-control-allow-headers"].lower()


def test_a_header_the_console_never_sends_is_still_refused(monkeypatch) -> None:
    # The allowlist stays a list, not a wildcard: widening it for the one header
    # above must not turn into mirroring back whatever a page asks for.
    client = _client(monkeypatch, "https://console.example")
    preflight = client.options(
        "/health",
        headers={
            "Origin": "https://console.example",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "x-arbitrary-client-header",
        },
    )
    assert preflight.status_code == 400
