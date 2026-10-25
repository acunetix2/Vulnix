"""Queue dispatch for scan jobs and integration deliveries.

Eager mode runs the work inline (development/tests). Once Redis is available,
set VULNIX_CELERY_EAGER=false and jobs go through Celery.
"""

import logging

from app.core.config import settings

logger = logging.getLogger("vulnix.queue")


def enqueue_scan(scan_id: str) -> None:
    if settings.celery_eager:
        from app.workers.tasks import run_scan_task

        run_scan_task(scan_id)
        return
    from app.workers.celery_app import celery_app

    celery_app.send_task("vulnix.run_scan", args=[scan_id])
    logger.info("scan_enqueued scan_id=%s", scan_id)


def enqueue_integration_delivery(delivery_id: str) -> None:
    """Hand one outbox row to a worker. Eager mode sends inline (dev/tests)."""
    if settings.celery_eager:
        from app.workers.tasks import run_integration_delivery_task

        run_integration_delivery_task(delivery_id)
        return
    from app.workers.celery_app import celery_app

    celery_app.send_task("vulnix.deliver_integration", args=[delivery_id])
    logger.info("delivery_enqueued delivery_id=%s", delivery_id)
