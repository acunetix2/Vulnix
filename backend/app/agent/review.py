"""The review agent: the scan's primary reader, with CLI tools as optional input.

For each selected file the agent starts with a full review, then may spend a
small, bounded number of follow-up turns reading related files and searching the
repository. Only the last successful answer is reported, and every finding is
checked against the exact paths and line ranges available to that answer. A
provider that cannot answer produces a recorded failure and a partial review,
never a discarded scan.

Nothing about the repository's contents is ever logged or stored as a prompt:
only counters, identifiers, and the validated findings.
"""

import logging
import random
import re
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.agent.intake import SourceFile, select_files
from app.agent.investigation import RepositoryTools
from app.agent.patch import build_patch
from app.agent.prompts import (
    AGENT_PROMPT_VERSION,
    SYSTEM_PROMPT,
    build_investigation_prompt,
    build_review_prompt,
)
from app.agent.schema import AgentFinding, AgentReview
from app.ai.catalog import alias_for
from app.ai.providers.ollama import ProviderResult, provider_for, retry_wait_seconds
from app.ai.redaction import redact
from app.ai.service import check_quota, record_usage, selected_entry
from app.core.config import settings
from app.core.errors import AppError
from app.db.models import Scan
from app.scanning.normalize import NormalizedFinding, clip_text, normalize_severity

logger = logging.getLogger("vulnix.agent")

AGENT_TOOL_NAME = "agent"
StepFn = Callable[[str, str, "str | None"], None]
InvokeFn = Callable[[str, str], AgentReview]

_SLUG = re.compile(r"[^a-z0-9]+")
# Two files in a row that survived every retry mean the reviewer is not coming
# back for this scan; carrying on would only spend the user's time.
_MAX_CONSECUTIVE_FAILURES = 2
# Worth another attempt: the reviewer was busy, or its answer did not parse. A
# refusal is not - a wrong credential gives the same answer eight times, and
# saying so immediately beats saying it slowly.
_RETRYABLE_CODES = frozenset({"AI_UNAVAILABLE", "AI_INVALID_OUTPUT"})
# The subset of failures that mean "this file could not be read" rather than
# "stop the review". A quota or rate trip is the second kind: the next file
# would hit the same wall, so the review ends and says which one it was.
# A truncated answer is the first kind: one long file can exceed the output cap,
# and asking it again would buy the same truncation, so it is recorded and the
# next file is read instead. A file too wide for every configured reviewer is the
# same shape: the next file usually fits.
_CONTINUE_CODES = _RETRYABLE_CODES | {
    "AI_MISCONFIGURED",
    "AI_OUTPUT_TRUNCATED",
    "AI_CONTEXT_OVERFLOW",
}


def _backoff_seconds(retry: int) -> float:
    """Exponential with jitter, so files reviewed in turn do not retry in lockstep."""
    delay = settings.ai_retry_backoff_base_seconds * (2 ** (retry - 1))
    capped = min(delay, settings.ai_retry_backoff_max_seconds)
    return capped * random.uniform(0.8, 1.0)


@dataclass
class AgentOutcome:
    """What the agent did, in terms the scan record can state honestly."""

    status: str = "skipped"  # succeeded | partial | failed | skipped
    error_code: str | None = None
    duration_ms: int = 0
    findings: list[NormalizedFinding] = field(default_factory=list)
    # The reviewer's alias. The scan record, the tool run, and every export read
    # this field; the vendor name behind it is only ever written to the usage table.
    reviewer: str | None = None
    files_reviewed: int = 0
    files_skipped: int = 0
    calls: int = 0
    # Extra attempts made after a first one failed. Kept separate from `calls`
    # because a retry is not a new unit of work and is never charged.
    retries: int = 0
    dropped: int = 0
    # Findings whose fix the reviewer wrote out and this server could verify.
    suggestions: int = 0
    # Files for which the model chose to investigate beyond the first read, and
    # the extra model calls that work consumed. Both are bounded independently
    # of the initial file coverage.
    investigations: int = 0
    follow_ups: int = 0
    context_reads: int = 0
    searches: int = 0
    investigation_failures: int = 0

    @property
    def usable(self) -> bool:
        return self.status in ("succeeded", "partial")

    def summary(self) -> dict:
        return {
            "status": self.status,
            "error_code": self.error_code,
            "reviewer": self.reviewer,
            "files_reviewed": self.files_reviewed,
            "files_skipped": self.files_skipped,
            "calls": self.calls,
            "retries": self.retries,
            "findings": len(self.findings),
            "dropped_findings": self.dropped,
            "suggestions": self.suggestions,
            "investigations": self.investigations,
            "follow_ups": self.follow_ups,
            "context_reads": self.context_reads,
            "searches": self.searches,
            "investigation_failures": self.investigation_failures,
            "prompt_version": AGENT_PROMPT_VERSION,
        }


def _slug(value: str) -> str:
    return _SLUG.sub("-", (value or "finding").lower()).strip("-")[:60] or "finding"


def _archived_lines(file: SourceFile, start_line: int, end_line: int) -> str:
    """The literal lines the reviewer was shown, for this finding's own range.

    Stored instead of the model's quotation, so what the console renders as
    evidence is text taken from the archive. The reviewer's own words are kept
    alongside it, never in its place.
    """
    lines = file.content.splitlines()
    if not lines:
        return ""
    return "\n".join(lines[start_line - 1 : end_line])


def _to_normalized(item: AgentFinding, file: SourceFile) -> NormalizedFinding | None:
    """Convert one reported finding, refusing anything the clip cannot support."""
    if item.start_line > file.line_count:
        return None
    end_line = min(item.end_line or item.start_line, file.line_count)
    last_line = max(end_line, item.start_line)
    # Clipped by length only: text that strips would lose the indentation of the
    # first line, and the archived source is the record. Redacted because a
    # secret finding stores real source, and a credential must not end up in the
    # database just because it was found.
    archived = redact(_archived_lines(file, item.start_line, last_line))[:2000]
    rule = f"agent/{_slug(item.vulnerability_class or item.title)}"
    # Validated against the archived file, not against the reviewer's quotation:
    # a suggestion that does not match what is really there produces no patch.
    patch = build_patch(
        path=file.path,
        content=file.content,
        start_line=item.start_line,
        end_line=last_line,
        suggestion=item.suggestion,
    )
    return NormalizedFinding(
        rule_id=rule[:255],
        title=item.title[:300],
        category=item.category,
        severity=normalize_severity(item.severity, default="low"),
        # Stamped as the agent so a scanner's identical location stays a
        # separate finding, and so provenance survives in the fingerprint.
        tool=AGENT_TOOL_NAME,
        confidence=item.confidence,
        file_path=file.path,
        start_line=item.start_line,
        end_line=last_line,
        evidence=archived or None,
        # The reviewer's own quotation of what it saw, kept separate from the
        # archived lines above so a disagreement between them stays visible.
        scanner_message=clip_text(item.evidence, 2000),
        impact=clip_text(item.impact, 2000),
        remediation=clip_text(" ".join(item.remediation), 2000) or None,
        suggestion=patch.as_record() if patch else None,
    )


def _stopped(outcome: AgentOutcome, started: float, status: str, code: str | None = None) -> AgentOutcome:
    outcome.status = status
    outcome.error_code = code
    outcome.duration_ms = int((time.monotonic() - started) * 1000)
    return outcome


def _generate(
    provider,
    prompt: str,
    label: str,
    step: StepFn,
    outcome: AgentOutcome,
    deadline: float,
) -> tuple[ProviderResult, AgentReview]:
    """Ask for one review turn and absorb the failures worth absorbing.

    Every attempt is reported on that turn's own step, so the trace a user is
    watching says "retry 3 of 8" instead of sitting on a spinner with no news.
    Retries stop early once the audit's own time budget is what stands between
    here and the next attempt: trading a fast failure for a slow one helps
    nobody. A call that fails is never charged, so this costs time only.
    """
    attempts = max(settings.ai_max_retries, 0) + 1
    code = "AI_UNAVAILABLE"
    tries = 0
    while True:
        tries += 1
        try:
            result = provider.generate(SYSTEM_PROMPT, prompt)
            return result, AgentReview.model_validate(result.data)
        except AppError as exc:
            if exc.code not in _RETRYABLE_CODES:
                raise
            code = exc.code
        except ValidationError:
            code = "AI_INVALID_OUTPUT"

        if tries >= attempts:
            break
        wait = _backoff_seconds(tries)
        # Sleeping the backoff while every reviewer in the chain rests spends the
        # remaining attempts on closed doors, so wait at least until one wakes. The
        # backoff itself is never shortened - and if the wait runs past the
        # deadline, say so now rather than after seven more requests that never send.
        resting = retry_wait_seconds(provider)
        if resting > wait:
            wait = resting
        if time.monotonic() + wait > deadline:
            step(label, "failed", "Out of time before the next retry")
            break
        outcome.retries += 1
        step(
            label,
            "running",
            f"No usable answer yet - retry {tries} of {attempts - 1} in {wait:.0f}s",
        )
        logger.warning(
            "agent_call_retry step=%s attempt=%s of=%s code=%s wait=%.2fs",
            label,
            tries,
            attempts,
            code,
            wait,
        )
        time.sleep(wait)

    raise AppError(code, f"The reviewer gave no usable answer after {tries} attempts.", 503)


def _investigate(
    file: SourceFile,
    review: AgentReview,
    *,
    tools: RepositoryTools,
    invoke: InvokeFn,
    outcome: AgentOutcome,
    deadline: float,
    step: StepFn,
) -> tuple[AgentReview, dict[str, list[tuple[int, int]]]]:
    """Let the model chase evidence, with the server holding every bound.

    The returned visibility snapshot belongs to the last *successful* answer. If
    a follow-up fails, newly fetched code cannot retroactively legitimise a path
    or line that the previous answer had only guessed at.
    """
    snapshot = tools.visibility()
    seen_requests = set()
    turns = 0
    investigated = False
    max_turns = settings.agent_max_investigation_turns

    while review.actions and (max_turns <= 0 or turns < max_turns):
        if (
            (
                settings.agent_max_investigation_calls > 0
                and outcome.follow_ups >= settings.agent_max_investigation_calls
            )
            or (settings.agent_max_calls > 0 and outcome.calls >= settings.agent_max_calls)
            or time.monotonic() >= deadline
        ):
            break
        request = tuple(
            (action.action, action.path, action.line, action.query)
            for action in review.actions
        )
        if request in seen_requests:
            # Asking for identical evidence again cannot add information. Keep
            # the current review rather than paying for a loop.
            break
        seen_requests.add(request)

        tools.focus(review.findings)
        tools.perform(review.actions)
        turns += 1
        outcome.follow_ups += 1
        if not investigated:
            outcome.investigations += 1
            investigated = True
        final = (
            (max_turns > 0 and turns >= max_turns)
            or (
                settings.agent_max_investigation_calls > 0
                and outcome.follow_ups >= settings.agent_max_investigation_calls
            )
            or (settings.agent_max_calls > 0 and outcome.calls + 1 >= settings.agent_max_calls)
        )
        label = f"Investigate {file.path} ({turns})"
        detail = (
            f"{len(review.actions)} read/search action(s), "
            f"{len(tools.last_hits)} search hit(s)"
        )
        step(label, "running", detail)
        prompt = build_investigation_prompt(
            primary_path=file.path,
            views=tools.views(),
            hits=tools.last_hits,
            notes=tools.last_notes,
            previous=review,
            turn=turns,
            max_turns=max_turns,
            final=final,
        )
        try:
            next_review = invoke(prompt, label)
        except AppError as exc:
            outcome.investigation_failures += 1
            step(label, "failed", exc.code)
            break
        review = next_review
        snapshot = tools.visibility()
        step(label, "done", f"{len(review.findings)} finding(s) after verification")
        if final:
            break

    return review, snapshot


def _visible_target(
    item: AgentFinding,
    primary: SourceFile,
    tools: RepositoryTools,
    snapshot: dict[str, list[tuple[int, int]]],
) -> SourceFile | None:
    path = item.path or primary.path
    target = tools.file(path)
    if target is None or item.start_line > target.line_count:
        return None
    end_line = min(item.end_line or item.start_line, target.line_count)
    if not tools.visible(path, item.start_line, max(end_line, item.start_line), snapshot):
        return None
    return target


def run_agent_review(
    db: Session,
    *,
    scan: Scan,
    src_dir: Path,
    user_id: str,
    workspace_id: str | None,
    step: StepFn,
) -> AgentOutcome:
    """Review every file the budget allows and return what was found."""
    started = time.monotonic()
    # One deadline for the whole review: a file's retries wait inside it rather
    # than extending it, so an audit that is going to time out still says so at
    # the time it promised.
    deadline = started + settings.scan_total_timeout_seconds
    if not settings.agent_enabled:
        step("AI agent review", "skipped", "Disabled on this server")
        return _stopped(AgentOutcome(), started, "skipped", "AGENT_DISABLED")
    if not settings.ai_enabled:
        # No model is configured here, so the agent is simply absent from this
        # scan. That is not a failure to hold against the CLI tools' results.
        step("AI agent review", "skipped", "No reviewer is enabled here")
        return _stopped(AgentOutcome(), started, "skipped", "AI_DISABLED")

    files, intake = select_files(
        src_dir,
        max_files=settings.agent_max_files,
        max_bytes_per_file=settings.agent_max_bytes_per_file,
    )
    outcome = AgentOutcome(
        files_skipped=intake["skipped_binary"] + intake["skipped_empty"] + intake["skipped_over_budget"]
    )
    if not files:
        # Say which of the two honest reasons this is: an archive with no source
        # in it at all, or source that could not be read. Never both at once.
        detail = (
            "Archive contains no source files"
            if not intake["candidates"]
            else f"{intake['candidates']} file(s) found, none readable as source"
        )
        if intake["skipped_binary"]:
            detail += f"; {intake['skipped_binary']} binary"
        if intake["skipped_empty"]:
            detail += f"; {intake['skipped_empty']} empty"
        step("AI agent review", "skipped", detail)
        return _stopped(outcome, started, "skipped", "NO_SOURCE")

    step("AI agent review", "running", f"{len(files)} file(s) to read")
    try:
        entry = selected_entry(db, workspace_id or "")
    except AppError as exc:
        step("AI agent review", "failed", exc.message)
        return _stopped(outcome, started, "failed", exc.code)

    outcome.reviewer = entry.alias

    try:
        provider = provider_for(entry)
    except AppError as exc:
        step("AI agent review", "failed", exc.message)
        return _stopped(outcome, started, "failed", exc.code)

    tools = RepositoryTools(
        files,
        related_file_bytes=settings.agent_related_file_bytes,
        max_context_files=settings.agent_max_context_files,
    )

    def invoke(prompt: str, label: str) -> AgentReview:
        """Make one logical model call and account for it exactly once."""
        call_started = time.monotonic()
        outcome.calls += 1
        try:
            check_quota(db, user_id)
            result, parsed = _generate(provider, prompt, label, step, outcome, deadline)
        except AppError as exc:
            record_usage(
                db,
                workspace_id=workspace_id,
                user_id=user_id,
                finding_id=None,
                entry=entry,
                provider_name=entry.provider,
                result=None,
                latency_ms=int((time.monotonic() - call_started) * 1000),
                error_code=exc.code,
            )
            # Only the step and code are logged - never the prompt or the reply.
            logger.warning("agent_call_failed step=%s code=%s", label, exc.code)
            raise

        record_usage(
            db,
            workspace_id=workspace_id,
            user_id=user_id,
            finding_id=None,
            entry=entry,
            provider_name=entry.provider,
            result=result,
            latency_ms=int((time.monotonic() - call_started) * 1000),
            error_code=None,
        )
        # A failover changes who answered, so the scan is attributed to the
        # reviewer that actually replied, not the one the workspace picked.
        outcome.reviewer = alias_for(result.provider, result.model)
        return parsed

    failures = 0
    stopped_with: str | None = (
        "AGENT_FILE_BUDGET" if intake["skipped_over_budget"] else None
    )
    for file in files:
        if settings.agent_max_calls > 0 and outcome.calls >= settings.agent_max_calls:
            stopped_with = "AGENT_CALL_BUDGET"
            step("AI agent review", "skipped", "Call budget reached")
            break
        if time.monotonic() >= deadline:
            stopped_with = "TIMEOUT"
            step("AI agent review", "skipped", "Scan time budget reached")
            break
        db.refresh(scan)
        if scan.status == "cancelled":
            stopped_with = "CANCELLED"
            break

        tools.begin(file)
        step(file.path, "running")
        try:
            review = invoke(build_review_prompt(file, tools.manifest), file.path)
        except AppError as exc:
            step(file.path, "failed", exc.code)
            outcome.error_code = exc.code
            stopped_with = exc.code
            failures += 1
            if exc.code not in _CONTINUE_CODES:
                break
            if failures >= _MAX_CONSECUTIVE_FAILURES:
                break
            continue

        review, snapshot = _investigate(
            file,
            review,
            tools=tools,
            invoke=invoke,
            outcome=outcome,
            deadline=deadline,
            step=step,
        )
        accepted = 0
        discarded = 0
        with_patch = 0
        for item in review.findings:
            target = _visible_target(item, file, tools, snapshot)
            normalized = _to_normalized(item, target) if target is not None else None
            if normalized is None:
                discarded += 1
                continue
            outcome.findings.append(normalized)
            accepted += 1
            if normalized.suggestion:
                with_patch += 1
        outcome.suggestions += with_patch
        outcome.dropped += discarded
        outcome.files_reviewed += 1
        failures = 0
        detail = f"{accepted} finding(s)" if accepted else "nothing reported"
        if with_patch:
            detail += f", {with_patch} suggested edit(s)"
        if discarded:
            detail += f", {discarded} unsupported or unlocatable discarded"
        step(file.path, "done", detail)

    outcome.context_reads = tools.reads
    outcome.searches = tools.searches

    outcome.duration_ms = int((time.monotonic() - started) * 1000)
    if outcome.files_reviewed == 0:
        outcome.status = "failed"
        outcome.error_code = outcome.error_code or "AGENT_UNAVAILABLE"
        step("AI agent review", "failed", outcome.error_code)
    elif outcome.files_reviewed < len(files) or stopped_with:
        outcome.status = "partial"
        outcome.error_code = outcome.error_code or stopped_with
        detail = f"{outcome.files_reviewed} file(s) reviewed"
        if intake["skipped_over_budget"]:
            detail += f"; {intake['skipped_over_budget']} excluded by file budget"
        step("AI agent review", "partial", detail)
    else:
        outcome.status = "succeeded"
        # A retry that eventually worked is not an error worth reporting.
        outcome.error_code = None
        detail = f"{len(files)} file(s) read"
        if outcome.follow_ups:
            detail += f", {outcome.follow_ups} investigation call(s)"
        step("AI agent review", "succeeded", detail)
    return outcome


__all__ = [
    "AGENT_TOOL_NAME",
    "AgentOutcome",
    "run_agent_review",
]
