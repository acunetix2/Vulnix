"""Status history. The scheduler writes the observations; the page only reads them.

The check runs in the beat process and reaches the public API over HTTPS from
outside it. That ordering is the whole design: a process cannot honestly report
its own death, so when the API is down it simply stops writing, and the gap in
the record is what the status page shows. Nothing in a row is user data, which is
why the history can be public while the act of recording stays operator-only.
"""

import logging
import time
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError
from app.db.models import StatusProbe

logger = logging.getLogger("vulnix.status")

WINDOWS = {"6h": 6, "24h": 24, "7d": 168}
DEFAULT_WINDOW = "24h"
BUCKET_COUNT = 60
RETENTION_DAYS = 14

# Which failures cost the product, and which cost a feature of it.
_REQUIRED_DOWN = ("database",)
_LIMITING_DOWN = ("redis",)

_GOOD = {"up", "enabled", "configured", "ready"}
_OFF = {"disabled", "not_configured", "unregistered"}
_BROKEN = {"error", "degraded"}
_DEAD = {"down"}

_RANK = {"operational": 0, "degraded": 1, "outage": 2}
_BY_RANK = {value: name for name, value in _RANK.items()}


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _aware(value: datetime) -> datetime:
    # SQLite drops tzinfo on read; every comparison here is against _utcnow().
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


def _base_url() -> str:
    base = settings.status_probe_url.rstrip("/")
    if not base:
        raise AppError(
            "STATUS_PROBE_NOT_CONFIGURED",
            "This deployment has not named an origin to check, so no history is recorded.",
            412,
        )
    return base


def component_state(value: str) -> str:
    """One word from /ready, in terms a visitor can act on.

    "not_enabled" is kept separate from "degraded" on purpose: an optional
    reviewer or integration that was never switched on is not an incident, and
    colouring it amber on a public page claims otherwise.
    """
    if value in _GOOD:
        return "operational"
    if value in _OFF:
        return "not_enabled"
    if value in _BROKEN:
        return "degraded"
    if value in _DEAD:
        return "outage"
    return "unknown"


def overall_state(reachable: bool, components: dict[str, str]) -> str:
    if not reachable:
        return "outage"
    if any(components.get(key) in _DEAD for key in _REQUIRED_DOWN):
        return "outage"
    states = [component_state(value) for value in components.values()]
    # A stalled queue means a service that works less, not one that stopped; a
    # value this code does not recognise is treated the same - worth looking at,
    # not worth an alarm.
    if any(components.get(key) in _DEAD for key in _LIMITING_DOWN) or any(
        state in ("degraded", "unknown", "outage") for state in states
    ):
        return "degraded"
    return "operational"


def _as_dict(row: StatusProbe) -> dict:
    return {
        "checked_at": _aware(row.checked_at).isoformat(),
        "reachable": row.reachable,
        "http_status": row.http_status,
        "latency_ms": row.latency_ms,
        "error_code": row.error_code,
    }


def probe(db: Session) -> dict:
    """Fetch the public readiness endpoint once and store what came back.

    The target is an operator setting, never a request parameter, so it is used
    as given. Every outcome is stored, failures included: a check that could not
    complete is a fact about the service, not a reason to write nothing.
    """
    base = _base_url()
    started = time.perf_counter()
    reachable = False
    http_status: int | None = None
    error_code: str | None = None
    components: dict[str, str] = {}

    try:
        with httpx.Client(timeout=settings.status_probe_timeout_seconds, follow_redirects=False) as client:
            response = client.get(f"{base}/ready")
        http_status = response.status_code
        if response.is_success:
            try:
                payload = response.json()
            except ValueError:
                payload = None
            if isinstance(payload, dict):
                components = {
                    str(key): str(value) for key, value in payload.items() if isinstance(value, str)
                }
                reachable = True
            else:
                error_code = "BAD_BODY"
        else:
            error_code = f"HTTP_{http_status}"
    except httpx.HTTPError as exc:
        # The class of the failure is enough. An httpx message can carry the
        # target URL, which is configuration and has no business in a stored row.
        error_code = "UNREACHABLE"
        logger.info("Status check did not complete: %s", type(exc).__name__)

    row = StatusProbe(
        checked_at=_utcnow(),
        reachable=reachable,
        http_status=http_status,
        latency_ms=int((time.perf_counter() - started) * 1000),
        components=components,
        error_code=error_code,
    )
    db.add(row)
    db.commit()
    # Pruning is housekeeping around a row that is already safely written, so a
    # failure here must not turn a recorded check into an error for the scheduler.
    try:
        prune(db)
    except Exception:  # noqa: BLE001 - the observation above is the point of this
        logger.warning("Status history could not be pruned")
    return _as_dict(row)


def prune(db: Session) -> int:
    """Drop observations past the retention window and report how many went."""
    cutoff = _utcnow() - timedelta(days=RETENTION_DAYS)
    result = db.execute(delete(StatusProbe).where(StatusProbe.checked_at < cutoff))
    db.commit()
    return int(result.rowcount or 0)


def _incidents(rows: list[StatusProbe]) -> list[dict]:
    """Runs of failed checks, oldest first.

    A successful check between two failures ends the run: a service that comes
    and goes reads as separate incidents, which is what someone comparing them
    wants to see.
    """
    runs: list[dict] = []
    for index, row in enumerate(rows):
        if overall_state(row.reachable, row.components) != "outage":
            continue
        when = _aware(row.checked_at)
        previous = runs[-1] if runs else None
        if previous is not None and previous["last_index"] == index - 1:
            previous["end"] = when
            previous["probes"] += 1
            previous["last_index"] = index
        else:
            runs.append({"start": when, "end": when, "probes": 1, "last_index": index})

    return [
        {
            "started_at": run["start"].isoformat(),
            "ended_at": run["end"].isoformat(),
            "duration_seconds": int((run["end"] - run["start"]).total_seconds()),
            "probes": run["probes"],
            # Ongoing means the newest check in the window failed. A gap in the
            # record reads the same way, and honestly: the last thing known about
            # the service is that it had stopped answering.
            "ongoing": run["last_index"] == len(rows) - 1,
        }
        for run in runs
    ]


def summary(db: Session, window: str = DEFAULT_WINDOW) -> dict:
    """The newest observation, plus one bucket per slice of the window."""
    if window not in WINDOWS:
        raise AppError(
            "INVALID_WINDOW",
            f"Unknown window. Choose one of: {', '.join(sorted(WINDOWS))}.",
            400,
        )
    hours = WINDOWS[window]
    now = _utcnow()
    since = now - timedelta(hours=hours)
    rows = list(
        db.scalars(
            select(StatusProbe).where(StatusProbe.checked_at >= since).order_by(StatusProbe.checked_at)
        )
    )

    span = hours * 3600 / BUCKET_COUNT
    buckets = [
        {
            "started_at": (since + timedelta(seconds=index * span)).isoformat(),
            "state": "nodata",
            "probes": 0,
            "outage_probes": 0,
            "rank": -1,
        }
        for index in range(BUCKET_COUNT)
    ]
    for row in rows:
        offset = (_aware(row.checked_at) - since).total_seconds()
        bucket = buckets[min(max(int(offset // span), 0), BUCKET_COUNT - 1)]
        state = overall_state(row.reachable, row.components)
        bucket["probes"] += 1
        if state == "outage":
            bucket["outage_probes"] += 1
        # A slice of history is only as good as the worst check inside it: a
        # one-minute outage in a sixteen-minute bucket still happened.
        bucket["rank"] = max(bucket["rank"], _RANK[state])
    for bucket in buckets:
        bucket["state"] = _BY_RANK[bucket["rank"]] if bucket["probes"] else "nodata"
        del bucket["rank"]

    latest = rows[-1] if rows else None
    failed = sum(1 for row in rows if overall_state(row.reachable, row.components) == "outage")
    components = latest.components if latest else {}
    return {
        "probing_enabled": bool(settings.status_probe_url),
        "window": window,
        "generated_at": now.isoformat(),
        "retention_days": RETENTION_DAYS,
        "latest": _as_dict(latest) if latest else None,
        "overall": overall_state(latest.reachable, components) if latest else "unknown",
        "components": {key: component_state(value) for key, value in components.items()},
        "buckets": buckets,
        "incidents": _incidents(rows),
        "total_checks": len(rows),
        "bucket_seconds": span,
        "uptime_percent": round(100 * (len(rows) - failed) / len(rows), 2) if rows else None,
    }
