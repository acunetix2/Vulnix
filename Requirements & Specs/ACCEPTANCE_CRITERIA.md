# Acceptance Criteria and Testing Strategy

## 1. MVP acceptance criteria

### Authentication and authorization
- [ ] Unauthenticated requests to protected endpoints return `401`.
- [ ] A user cannot read, modify, export, or cancel another workspace's resources.
- [ ] Authorization is checked server-side on every request; hiding UI controls is not sufficient.
- [ ] Role restrictions are tested for workspace administration and audit logs.

### Upload safety
- [ ] Oversized uploads are rejected before extraction.
- [ ] ZIP entries containing absolute paths or `..` traversal are rejected.
- [ ] Unsafe symlinks, excessive nesting, excessive file counts, and suspicious expansion ratios are rejected.
- [ ] Files are extracted only beneath a fresh temporary scan directory.
- [ ] A failed or cancelled scan cleans up temporary files.
- [ ] Uploaded source code is never executed, and package lifecycle scripts are never run.

### Scan lifecycle
- [ ] A valid scan moves through `queued` to `running` and a terminal state.
- [ ] A scanner timeout is recorded as `timed_out`; the worker remains healthy.
- [ ] One scanner failure does not discard successful results from other scanners.
- [ ] Duplicate findings from the same scan are deduplicated by fingerprint.
- [ ] Tool name, version, status, duration, and error category are recorded.

### Findings
- [ ] Each finding displays severity, confidence, category, rule/source, path and line range when available, evidence, and remediation.
- [ ] Missing fields are represented clearly rather than fabricated.
- [ ] Users can filter by severity, category, and triage status.
- [ ] Triage changes persist and include actor/time.
- [ ] Source snippets are escaped and cannot execute HTML or script.
- [ ] Report access follows the same authorization rules as scan access.

### AI explanation
- [ ] AI output is validated against a strict schema.
- [ ] Code comments that contain instructions do not override system/developer guidance.
- [ ] Likely secrets are redacted before external model calls.
- [ ] AI output is labelled as AI-assisted and does not replace scanner evidence.
- [ ] Unsupported claims are rejected or returned with uncertainty.
- [ ] Rate limits and provider failures are handled without breaking findings access.

### Reports
- [ ] Markdown and JSON reports include scan timestamp, tool versions, summary, and findings.
- [ ] Reports do not expose internal paths, credentials, tokens, or unrelated workspace data.
- [ ] Malicious file names and scanner messages cannot inject active content into reports.

## 2. Test pyramid
- **Unit tests:** validators, archive path checks, finding normalization, severity mapping, fingerprints, redaction, schema validation.
- **Integration tests:** database migrations, auth and workspace permissions, queue state transitions, object-storage permissions, report generation.
- **Security tests:** IDOR/cross-tenant access, ZIP slip, symlink escape, decompression bomb, command injection attempts, XSS payloads, prompt injection, secret leakage.
- **End-to-end tests:** create project → upload fixture → start scan → view findings → triage → export report.
- **Operational tests:** worker timeout, queue retry, cancellation, dependency outage, cleanup after crash.

## 3. Safe test fixtures
Use tiny, intentionally vulnerable sample files created specifically for testing. Never use real customer source code or live secrets in fixtures. Use fake placeholder secrets only.

## 4. Definition of done
A feature is done when:
1. Its acceptance criteria are covered.
2. Tests run successfully in the relevant environment.
3. Security impact and failure behavior have been reviewed.
4. API/data/UI documentation is updated.
5. Logs and metrics avoid sensitive content.
6. `TASKS.md` and `PROGRESS.md` accurately reflect the result.

## 5. Release gates
Do not release publicly until tenant isolation, upload safety, worker isolation, secret redaction, report escaping, dependency checks, and deletion/retention behavior have been tested.
