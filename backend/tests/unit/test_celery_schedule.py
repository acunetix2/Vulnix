"""Queue wiring: what a deployed worker needs before a delivery can be retried."""

from app.core.config import settings
from app.integrations.queue import dispatch
from app.workers import tasks  # importing this registers the task names on the app
from app.workers.celery_app import celery_app


def test_the_outbox_sweep_is_both_scheduled_and_registered() -> None:
    # A delivery that fails into backoff is only ever claimed by this sweep, so a
    # deployment whose beat process is missing would quietly stop retrying every
    # notification without any error surfacing on the API.
    entry = celery_app.conf.beat_schedule["drain-integration-outbox"]
    assert entry["task"] == "vulnix.drain_integration_outbox"
    assert entry["task"] in celery_app.tasks


def test_eager_mode_still_runs_the_scan_inline(monkeypatch) -> None:
    monkeypatch.setattr(settings, "celery_eager", True)
    ran: list[str] = []
    monkeypatch.setattr(tasks, "run_scan_task", ran.append)
    dispatch.enqueue_scan("scan-1")
    assert ran == ["scan-1"]


def test_a_broker_sends_the_job_instead_of_running_it(monkeypatch) -> None:
    monkeypatch.setattr(settings, "celery_eager", False)
    sent: list[tuple[str, list]] = []
    monkeypatch.setattr(celery_app, "send_task", lambda name, args=None, **kwargs: sent.append((name, args)))
    dispatch.enqueue_scan("scan-2")
    assert sent == [("vulnix.run_scan", ["scan-2"])]
