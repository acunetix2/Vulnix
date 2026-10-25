"""AI explanation service.

Builds a minimized, redacted context from scanner evidence, calls the
configured provider, and validates the response before storing it.
"""

import io
import logging
import time
import zipfile
from datetime import UTC, datetime
from typing import NoReturn

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.ai import catalog
from app.ai.prompts import PROMPT_VERSION, SYSTEM_PROMPT, build_user_prompt
from app.ai.providers.ollama import ProviderResult, provider_for
from app.ai.redaction import redact
from app.ai.schema import AIExplanation
from app.core.config import settings
from app.core.errors import AppError
from app.core.rate_limit import check_rate_limit
from app.db.models import AiUsageEvent, Finding, Scan, Upload, WorkspaceAiSetting
from app.integrations.storage import get_storage
from app.scanning.archive import validate_entry_name

logger = logging.getLogger("vulnix.ai")


def _today() -> str:
    return datetime.now(UTC).date().isoformat()


def used_today(db: Session, user_id: str) -> int:
    """Credits spent today: calls that answered.

    A failure, a timeout or a retry that eventually worked spends no credit, so
    the number the quota is checked against is the same number the heatmap
    draws. Both count succeeded rows only.
    """
    day = _today()
    return int(
        db.scalar(
            select(func.count())
            .select_from(AiUsageEvent)
            .where(
                AiUsageEvent.user_id == user_id,
                AiUsageEvent.day == day,
                AiUsageEvent.status == "succeeded",
            )
        )
        or 0
    )


def check_quota(db: Session, user_id: str) -> None:
    """Daily AI credit budget, shared by explanations and by the review agent."""
    check_rate_limit(f"ai:{user_id}", settings.ai_rate_per_minute, 60)
    # Read from stored events, not a process-local counter: the daily quota and
    # the credit heatmap must mean the same thing and survive a restart.
    if used_today(db, user_id) >= settings.ai_daily_quota_per_user:
        raise AppError("QUOTA_EXCEEDED", "Today's credits are spent. They reset at midnight UTC.", 429)


def record_usage(
    db: Session,
    *,
    workspace_id: str | None,
    user_id: str,
    finding_id: str | None,
    entry: catalog.ModelEntry,
    provider_name: str,
    result: ProviderResult | None,
    latency_ms: int,
    error_code: str | None,
) -> None:
    """Persist one attempt. Counters and identifiers only, never prompt content."""
    db.add(
        AiUsageEvent(
            workspace_id=workspace_id,
            user_id=user_id,
            finding_id=finding_id,
            provider=(result.provider if result else provider_name),
            model=(result.model if result else entry.model),
            day=_today(),
            status="failed" if error_code else "succeeded",
            error_code=error_code,
            prompt_tokens=result.prompt_tokens if result else None,
            completion_tokens=result.completion_tokens if result else None,
            latency_ms=latency_ms,
        )
    )
    db.commit()


def _fetch_snippet(
    upload: Upload, file_path: str | None, start_line: int | None, end_line: int | None
) -> str:
    """Read a small excerpt for the finding's location straight from the ZIP."""
    if not file_path:
        return ""
    try:
        safe_name = validate_entry_name(file_path)
        with get_storage().open_read(upload.object_key) as raw:
            # The whole archive, not one entry's cap: a ZIP is read from its
            # central directory at the end, so a short read is a corrupt file.
            data = raw.read((upload.size_bytes or 0) + 1)
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            try:
                info = zf.getinfo(safe_name)
            except KeyError:
                return ""
            if info.file_size > settings.upload_max_entry_bytes:
                return ""
            text = zf.read(info).decode("utf-8", errors="replace")
    except (AppError, zipfile.BadZipFile, OSError):
        return ""

    lines = text.splitlines()
    center = max((start_line or 1) - 1, 0)
    half = settings.ai_max_snippet_lines // 2
    span = (end_line or start_line or 1) - (start_line or 1) + 1
    window = lines[max(center - half, 0) : center + half + span]
    excerpt = "\n".join(window)
    # Hard cap bytes sent to the provider.
    return redact(excerpt[:4000])


def _validate_output(data: dict, finding: Finding) -> AIExplanation:
    try:
        explanation = AIExplanation.model_validate(data)
    except Exception:
        raise AppError("AI_INVALID_OUTPUT", "The reviewer's answer did not hold together.", 502) from None
    if explanation.finding_id != finding.id:
        raise AppError("AI_INVALID_OUTPUT", "The reviewer answered about a different finding.", 502)
    # Evidence references must point at real, known identifiers only.
    allowed = {finding.id}
    if finding.rule_id:
        allowed.add(finding.rule_id)
    explanation.evidence_refs = [r for r in explanation.evidence_refs if r in allowed]
    return explanation


def selected_entry(db: Session, workspace_id: str, requested: str | None = None) -> catalog.ModelEntry:
    """Resolve which model answers: explicit request, then workspace choice, then default.

    ``requested`` is matched against the live catalog, so an id that is not
    currently offered - invented, stale, or from another provider - is refused
    before a provider is ever contacted.
    """
    entries = catalog.list_models()
    if not entries:
        raise AppError("AI_DISABLED", "No reviewer is enabled on this deployment.", 503)

    if requested is not None:
        wanted = str(requested).strip()
        if wanted:
            entry = catalog.resolve(wanted)
            if entry is None:
                raise AppError("AI_MODEL_UNAVAILABLE", "That reviewer is not available right now.", 422)
            return entry

    row = db.get(WorkspaceAiSetting, workspace_id) if workspace_id else None
    if row:
        entry = catalog.resolve(row.model_id)
        # A stored choice can go stale: a local model gets deleted, or the
        # hosted account loses it. Fall through to the default instead of failing.
        if entry is not None:
            return entry
    default = catalog.preferred(entries)
    if default is None:
        raise AppError("AI_DISABLED", "No reviewer is enabled on this deployment.", 503)
    return default


def get_preference(db: Session, workspace_id: str) -> catalog.ModelEntry | None:
    """The workspace's own choice, or None when it follows the server default."""
    row = db.get(WorkspaceAiSetting, workspace_id)
    return catalog.resolve(row.model_id) if row else None


def set_preference(db: Session, workspace_id: str, model_id: str, user_id: str) -> catalog.ModelEntry:
    entry = catalog.resolve(str(model_id).strip())
    if entry is None:
        raise AppError("AI_MODEL_UNAVAILABLE", "That reviewer is not available right now.", 422)
    row = db.get(WorkspaceAiSetting, workspace_id) or WorkspaceAiSetting(
        workspace_id=workspace_id, model_id=entry.id
    )
    row.model_id = entry.id
    row.updated_by = user_id
    row.updated_at = datetime.now(UTC)
    db.add(row)
    db.commit()
    return entry


def _reusable(
    stored: object, entry: catalog.ModelEntry, finding: Finding
) -> AIExplanation | None:
    """The answer already on the finding, when the same reviewer wrote it under
    the instructions now in force.

    Re-asking a question that is already answered costs a credit and returns the
    same text, so the stored explanation is replayed for free. A different
    reviewer, or a prompt that has since changed, is a different answer and does
    cost.
    """
    if not isinstance(stored, dict):
        return None
    if stored.get("model_id") != entry.id or stored.get("prompt_version") != PROMPT_VERSION:
        return None
    try:
        return AIExplanation(
            finding_id=finding.id,
            summary=stored.get("summary") or "",
            why_it_matters=stored.get("why_it_matters") or "",
            attack_preconditions=stored.get("attack_preconditions") or "",
            impact=stored.get("impact") or "",
            confidence=stored.get("confidence") or "medium",
            severity_rationale=stored.get("severity_rationale") or "",
            remediation=stored.get("remediation_steps") or [],
            verification_steps=stored.get("verification_steps") or [],
            false_positive_notes=stored.get("false_positive_notes") or "",
            evidence_refs=stored.get("evidence_refs") or [],
            limitations=stored.get("limitations") or "",
            cached=True,
        )
    except Exception:
        # A row written by an older schema version is simply not reusable.
        return None


def explain_finding(
    db: Session,
    finding: Finding,
    user_id: str,
    workspace_id: str | None = None,
    requested_model: str | None = None,
) -> AIExplanation:
    """Generate, validate, and store an AI explanation for one finding."""
    entry = selected_entry(db, workspace_id or "", requested=requested_model)
    cached = _reusable(finding.ai_explanation, entry, finding)
    if cached is not None:
        return cached
    check_quota(db, user_id)
    started = time.monotonic()

    def _failure(code: str, exc: AppError) -> NoReturn:
        elapsed = int((time.monotonic() - started) * 1000)
        record_usage(
            db,
            workspace_id=workspace_id,
            user_id=user_id,
            finding_id=finding.id,
            entry=entry,
            provider_name=entry.provider,
            result=None,
            latency_ms=elapsed,
            error_code=code,
        )
        raise exc

    try:
        provider = provider_for(entry)
    except AppError as exc:
        _failure(exc.code, exc)

    # Locate the scan's upload for snippet retrieval.
    scan = db.get(Scan, finding.scan_id)
    upload = db.get(Upload, scan.upload_id) if scan and scan.upload_id else None
    snippet = (
        _fetch_snippet(upload, finding.file_path, finding.start_line, finding.end_line)
        if upload
        else ""
    )
    prompt = build_user_prompt(
        finding_id=finding.id,
        rule_id=finding.rule_id,
        title=finding.title,
        category=finding.category,
        severity=finding.severity,
        file_path=finding.file_path,
        start_line=finding.start_line,
        end_line=finding.end_line,
        scanner_message=finding.scanner_message,
        evidence=finding.evidence,
        snippet=snippet,
    )
    try:
        result = provider.generate(SYSTEM_PROMPT, prompt)
        explanation = _validate_output(result.data, finding)
    except AppError as exc:
        _failure(exc.code, exc)

    elapsed = int((time.monotonic() - started) * 1000)
    finding.ai_explanation = {
        "generated_by": "ai",
        # What actually answered, not what settings named at boot - a failover
        # changes this and the record has to show it. These two stay in the row:
        # every response renders them as an alias.
        "provider": result.provider,
        "model": result.model,
        "model_id": entry.id,
        # Computed here, while both halves are known, rather than guessed at by
        # a client that can no longer see either name.
        "fallback": (result.provider, result.model) != (entry.provider, entry.model),
        "prompt_version": PROMPT_VERSION,
        "validation": "passed",  # schema + evidence-reference checks succeeded
        "generated_at": datetime.now(UTC).isoformat(),
        "latency_ms": elapsed,
        "summary": explanation.summary,
        "impact": explanation.impact,
        "why_it_matters": explanation.why_it_matters,
        "attack_preconditions": explanation.attack_preconditions,
        "confidence": explanation.confidence,
        "severity_rationale": explanation.severity_rationale,
        "remediation_steps": explanation.remediation,
        "verification_steps": explanation.verification_steps,
        "false_positive_notes": explanation.false_positive_notes,
        "evidence_refs": explanation.evidence_refs,
        "limitations": explanation.limitations,
    }
    db.commit()
    record_usage(
        db,
        workspace_id=workspace_id,
        user_id=user_id,
        finding_id=finding.id,
        entry=entry,
        provider_name=entry.provider,
        result=result,
        latency_ms=elapsed,
        error_code=None,
    )
    return explanation


def usage_window(days: int) -> tuple[str, str]:
    """Inclusive UTC day range for a usage query."""
    until = datetime.now(UTC).date()
    since = datetime.fromordinal(until.toordinal() - (days - 1)).date()
    return since.isoformat(), until.isoformat()


def daily_credits(
    db: Session,
    *,
    user_id: str | None = None,
    workspace_id: str | None = None,
    days: int = 365,
) -> list[dict]:
    """Successful AI calls per UTC day, oldest first. One succeeded call is one credit."""
    since_day, _ = usage_window(days)
    query = (
        select(
            AiUsageEvent.day,
            func.count().label("credits"),
            func.coalesce(func.sum(AiUsageEvent.prompt_tokens), 0).label("prompt_tokens"),
            func.coalesce(func.sum(AiUsageEvent.completion_tokens), 0).label("completion_tokens"),
        )
        .where(AiUsageEvent.day >= since_day, AiUsageEvent.status == "succeeded")
        .group_by(AiUsageEvent.day)
        .order_by(AiUsageEvent.day)
    )
    if user_id:
        query = query.where(AiUsageEvent.user_id == user_id)
    if workspace_id:
        query = query.where(AiUsageEvent.workspace_id == workspace_id)
    return [
        {
            "day": row.day,
            "credits": int(row.credits),
            "prompt_tokens": int(row.prompt_tokens),
            "completion_tokens": int(row.completion_tokens),
        }
        for row in db.execute(query)
    ]


def usage_by_model(
    db: Session,
    *,
    user_id: str | None = None,
    workspace_id: str | None = None,
    days: int = 365,
) -> list[dict]:
    """Attempts grouped by the reviewer that actually replied, busiest first.

    Failures are counted on their own because they spend no credit and store no
    tokens, so a reviewer that timed out every call would otherwise look unused.
    The provider and tag are read here but never returned - a row leaves this
    function under its alias.
    """
    since_day, _ = usage_window(days)
    query = (
        select(
            AiUsageEvent.provider,
            AiUsageEvent.model,
            func.count().label("calls"),
            func.sum(case((AiUsageEvent.status == "succeeded", 1), else_=0)).label("credits"),
            func.sum(case((AiUsageEvent.status == "failed", 1), else_=0)).label("failures"),
            func.coalesce(func.sum(AiUsageEvent.prompt_tokens), 0).label("prompt_tokens"),
            func.coalesce(func.sum(AiUsageEvent.completion_tokens), 0).label("completion_tokens"),
            func.coalesce(func.max(AiUsageEvent.day), "").label("last_day"),
        )
        .where(AiUsageEvent.day >= since_day)
        .group_by(AiUsageEvent.provider, AiUsageEvent.model)
        .order_by(func.count().desc(), AiUsageEvent.model)
    )
    if user_id:
        query = query.where(AiUsageEvent.user_id == user_id)
    if workspace_id:
        query = query.where(AiUsageEvent.workspace_id == workspace_id)
    return [
        {
            "alias": catalog.alias_for(row.provider or "", row.model or ""),
            "calls": int(row.calls),
            "credits": int(row.credits or 0),
            "failures": int(row.failures or 0),
            "prompt_tokens": int(row.prompt_tokens),
            "completion_tokens": int(row.completion_tokens),
            "last_day": row.last_day,
        }
        for row in db.execute(query)
    ]
