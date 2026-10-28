"""Background tasks. The job payload is untrusted: re-load and re-validate."""

import logging

from app.scanning.pipeline import execute_scan

logger = logging.getLogger("vulnix.worker")


def run_scan_task(scan_id: str) -> None:
    # Scan/project relationship is re-checked inside the pipeline.
    execute_scan(scan_id)


def run_integration_delivery_task(delivery_id: str) -> None:
    from app.db.session import SessionLocal
    from app.modules.integrations.service import process_delivery

    db = SessionLocal()
    try:
        process_delivery(db, delivery_id)
    finally:
        db.close()


def drain_integration_outbox_task(limit: int = 50) -> int:
    """Periodic sweep for rows whose backoff has elapsed."""
    from app.db.session import SessionLocal
    from app.modules.integrations.service import deliver_due

    db = SessionLocal()
    try:
        return deliver_due(db, limit)
    finally:
        db.close()


def probe_status_task() -> int:
    """Record one check of the public API for the status page.

    Returns 0 when this deployment has named no origin. A scheduler with nothing
    to probe should report a clean run every minute, not a failing task.
    """
    from app.core.errors import AppError
    from app.db.session import SessionLocal
    from app.modules.status.service import probe

    db = SessionLocal()
    try:
        try:
            probe(db)
        except AppError as exc:
            if exc.code == "STATUS_PROBE_NOT_CONFIGURED":
                return 0
            raise
        return 1
    finally:
        db.close()


try:
    from app.workers.celery_app import celery_app

    @celery_app.task(name="vulnix.run_scan", bind=True)
    def celery_run_scan(self, scan_id: str) -> None:  # noqa: ANN001
        run_scan_task(scan_id)

    @celery_app.task(name="vulnix.deliver_integration", bind=True)
    def celery_deliver_integration(self, delivery_id: str) -> None:  # noqa: ANN001
        run_integration_delivery_task(delivery_id)

    @celery_app.task(name="vulnix.drain_integration_outbox", bind=True)
    def celery_drain_integration_outbox(self, limit: int = 50) -> int:  # noqa: ANN001
        return drain_integration_outbox_task(limit)

    @celery_app.task(name="vulnix.probe_status", bind=True)
    def celery_probe_status(self) -> int:  # noqa: ANN001
        return probe_status_task()
except ImportError:  # celery not installed in some test environments
    pass
