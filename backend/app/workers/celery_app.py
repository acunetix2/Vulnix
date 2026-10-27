"""Celery application. Only used when eager mode is disabled."""

from datetime import timedelta

from celery import Celery

from app.core.config import settings

celery_app = Celery("vulnix", broker=settings.celery_broker_url, backend=settings.celery_broker_url)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    worker_prefetch_multiplier=1,  # scans are long-running; avoid hoarding jobs
    task_acks_late=True,
    # A delivery that failed into backoff is claimed only by this sweep - the
    # enqueue path never revisits it - so without a beat process a retried
    # notification would sit pending forever.
    beat_schedule={
        "drain-integration-outbox": {
            "task": "vulnix.drain_integration_outbox",
            "schedule": timedelta(seconds=60),
        },
    },
)

celery_app.autodiscover_tasks(["app.workers"])
