"""Status history: what a check records, and what the public page is told."""

from datetime import UTC, datetime, timedelta

import httpx
import pytest

from app.core.config import settings
from app.core.errors import AppError
from app.db.models import StatusProbe
from app.db.session import SessionLocal
from app.modules.status import service


@pytest.fixture()
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


class _Client:
    """Stands in for httpx.Client so a check never needs a listening server."""

    response = None
    raises = None
    urls: list[str] = []

    def __init__(self, *args, **kwargs):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        return False

    def get(self, url, timeout=None):
        type(self).urls.append(url)
        if type(self).raises is not None:
            raise type(self).raises
        return type(self).response


def _answer(monkeypatch, *, response=None, raises=None) -> None:
    _Client.response = response
    _Client.raises = raises
    _Client.urls = []
    monkeypatch.setattr(service.httpx, "Client", lambda *args, **kwargs: _Client())
    monkeypatch.setattr(settings, "status_probe_url", "https://api.test/api/v1")


def _ready(**overrides) -> dict:
    body = {"status": "ready", "database": "up", "redis": "up", "ai": "enabled", "integrations": "enabled"}
    body.update(overrides)
    return body


def _record(db, *, reachable=True, components=None, minutes_ago=0, seconds_ago=0) -> StatusProbe:
    row = StatusProbe(
        checked_at=datetime.now(UTC) - timedelta(minutes=minutes_ago, seconds=seconds_ago),
        reachable=reachable,
        http_status=200 if reachable else 503,
        latency_ms=180,
        components=components if components is not None else _ready(),
        error_code=None if reachable else "HTTP_503",
    )
    db.add(row)
    db.commit()
    return row


# ── making a check ────────────────────────────────────────────────────────────


def test_a_check_is_refused_until_the_operator_names_an_origin(db, monkeypatch) -> None:
    monkeypatch.setattr(settings, "status_probe_url", "")
    with pytest.raises(AppError) as caught:
        service.probe(db)
    assert caught.value.code == "STATUS_PROBE_NOT_CONFIGURED"
    assert db.query(StatusProbe).count() == 0


def test_a_check_stores_what_the_api_answered(db, monkeypatch) -> None:
    _answer(monkeypatch, response=httpx.Response(200, json=_ready(redis="down")))

    returned = service.probe(db)
    row = db.query(StatusProbe).one()

    assert _Client.urls == ["https://api.test/api/v1/ready"]
    assert returned["reachable"] is True
    assert isinstance(returned["latency_ms"], int)
    assert row.components["redis"] == "down"


def test_a_check_that_never_completed_is_stored_as_a_gap(db, monkeypatch) -> None:
    _answer(monkeypatch, raises=httpx.ConnectError("connection refused"))
    service.probe(db)

    row = db.query(StatusProbe).one()

    assert row.reachable is False
    assert row.error_code == "UNREACHABLE"
    # The message that came with the failure could name the probe target, which
    # is configuration; nothing of it belongs in a row a page can read.
    assert row.components == {}


def test_a_refusal_is_attributed_to_the_service_not_the_network(db, monkeypatch) -> None:
    _answer(monkeypatch, response=httpx.Response(503, text="unavailable"))
    service.probe(db)

    row = db.query(StatusProbe).one()

    assert row.reachable is False
    assert row.http_status == 503
    assert row.error_code == "HTTP_503"


def test_an_answer_that_is_not_readiness_data_is_not_treated_as_up(db, monkeypatch) -> None:
    _answer(monkeypatch, response=httpx.Response(200, json=["not", "a", "map"]))
    service.probe(db)

    row = db.query(StatusProbe).one()

    assert row.reachable is False
    assert row.error_code == "BAD_BODY"


def test_a_check_prunes_only_history_past_retention(db, monkeypatch) -> None:
    old = _record(db, minutes_ago=(service.RETENTION_DAYS + 1) * 24 * 60)
    recent = _record(db, minutes_ago=5)
    _answer(monkeypatch, response=httpx.Response(200, json=_ready()))

    service.probe(db)

    assert db.get(StatusProbe, old.id) is None
    assert db.get(StatusProbe, recent.id) is not None


# ── what the page is told ─────────────────────────────────────────────────────


def test_the_history_needs_no_session_and_says_when_it_starts_empty(client) -> None:
    response = client.get("/api/v1/status")

    assert response.status_code == 200
    body = response.json()
    assert body["probing_enabled"] is False
    assert body["overall"] == "unknown"
    assert body["latest"] is None
    assert len(body["buckets"]) == service.BUCKET_COUNT


def test_a_window_nobody_offered_is_refused_rather_than_guessed(client) -> None:
    assert client.get("/api/v1/status?window=fortnight").status_code == 400


def test_a_service_left_off_is_not_reported_as_an_incident(db) -> None:
    _record(db, components=_ready(ai="disabled", integrations="not_configured"))

    out = service.summary(db)

    assert out["components"]["ai"] == "not_enabled"
    assert out["overall"] == "operational"
    assert out["incidents"] == []


def test_a_queue_that_is_down_limits_the_product_without_stopping_it(db) -> None:
    _record(db, components=_ready(redis="down"))

    assert service.summary(db)["overall"] == "degraded"


def test_a_dead_database_is_the_end_of_the_line(db) -> None:
    _record(db, components=_ready(database="down", status="not_ready"))

    out = service.summary(db)

    assert out["overall"] == "outage"
    assert out["incidents"][0]["ongoing"] is True


def test_a_check_that_did_not_complete_outweighs_a_healthy_response(db) -> None:
    _record(db, reachable=False, components={})

    out = service.summary(db)

    assert out["overall"] == "outage"
    assert out["latest"]["error_code"] == "HTTP_503"


def test_the_window_chosen_bounds_the_checks_returned(db) -> None:
    _record(db, minutes_ago=6 * 60 + 30)
    _record(db, minutes_ago=1)

    assert service.summary(db, "6h")["total_checks"] == 1
    assert service.summary(db, "7d")["total_checks"] == 2


def test_a_bucket_shows_the_worst_check_inside_it(db) -> None:
    span = service.WINDOWS["6h"] * 3600 / service.BUCKET_COUNT
    _record(db, seconds_ago=int(span / 3))
    _record(db, reachable=False, seconds_ago=1)

    out = service.summary(db, "6h")

    last = out["buckets"][-1]
    assert last["state"] == "outage"
    assert last["probes"] == 2
    assert last["outage_probes"] == 1
    assert out["buckets"][0]["state"] == "nodata"


def test_two_failures_divided_by_a_success_are_two_incidents(db) -> None:
    _record(db, reachable=False, minutes_ago=10)
    _record(db, minutes_ago=5)
    _record(db, reachable=False, minutes_ago=1)

    incidents = service.summary(db)["incidents"]

    assert len(incidents) == 2
    assert incidents[0]["ongoing"] is False
    assert incidents[1]["ongoing"] is True


def test_the_probe_endpoint_answers_only_to_the_operator(client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "status_probe_url", "")

    response = client.post("/api/v1/status/probe")

    assert response.status_code == 412
    assert response.json()["error"]["code"] == "STATUS_PROBE_NOT_CONFIGURED"
