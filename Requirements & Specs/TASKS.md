# Implementation Plan / Tasks

Use `[ ]` for pending, `[/]` for in progress, and `[x]` only after verification.

## Phase 0 — Product and engineering foundation
- [ ] Confirm final product name, language, initial deployment target, and retention policy.
- [x] Review all project docs and resolve open questions. (open questions remain in PRD; stack per Vulnix_TECH_STACK.md)
- [x] Create repository layout and baseline README.
- [x] Add `.gitignore`, `.env.example`, formatter, linter, and test runner.
- [ ] Write threat model and security review checklist. (AI_SECURITY.md covers AI/worker threats; platform-wide checklist pending)
- [x] Create local development environment for PostgreSQL and Redis. (infrastructure/compose.yaml)
- [ ] Establish CI for linting and unit tests.

## Phase 1 — API and persistence
- [x] Implement database migrations for users/workspaces/memberships/projects/scans/findings/tool runs/audit events.
- [x] Implement authentication integration and workspace authorization. (Supabase JWT verify + RBAC; dev mode for local)
- [x] Implement project CRUD.
- [x] Implement scan creation and status endpoints. (+ cancel, idempotency keys)
- [x] Implement upload validation and private object-storage integration. (local + S3 adapter)
- [x] Implement queue dispatch, idempotency, retry, and cancellation rules. (Celery + eager mode; retry policy pending)
- [x] Add API schema validation and stable error responses.
- [x] Add unit and integration tests for authorization and ownership.

## Phase 2 — Secure scan pipeline
- [x] Implement safe ZIP inspection and extraction.
- [x] Add archive traversal, symlink, file-count, nesting, and decompression-bomb tests.
- [x] Implement worker isolation and resource/time limits. (timeouts, minimal env, argv-only exec; container isolation pending)
- [x] Integrate one static-analysis tool behind an adapter. (Semgrep, Bandit)
- [x] Normalize scanner findings and persist tool run metadata.
- [x] Add scanner fixture tests and timeout/failure tests. (fake adapter; real-tool tests require installed binaries)
- [x] Add scan progress and partial-failure behavior.
- [x] Confirm user-submitted code is never executed.

## Phase 3 — Findings and reports
- [x] Build scan list/detail pages. (redesigned against the real API, loading/error/empty states)
- [x] Build findings table with severity/category/status filters. (filters drive the API query params)
- [x] Build finding detail panel with evidence and source location. (evidence rendered as escaped text)
- [x] Implement finding triage and notes.
- [x] Implement Markdown and JSON report exports.
- [x] Escape source evidence in UI and report output. (report output)
- [x] Add report authorization tests. (covered by scan-level authz tests)

## Phase 4 — Additional scanners and AI
- [x] Integrate secret scanner. (Gitleaks adapter, --redact)
- [x] Integrate dependency vulnerability checks. (pip-audit, Trivy adapters)
- [x] Define AI input/output schema and provider interface.
- [x] Implement snippet minimization and secret redaction.
- [x] Add AI prompt-injection-resistant instructions and output validation.
- [x] Add AI explanation endpoint with quota/rate limit.
- [x] Add tests for malformed AI output, uncertainty, and no unsupported claims.
- [x] Clearly label AI-generated explanation.
- [x] Make hosted AI (Groq) a working provider, not fallback-only. (single credential; provider union
      widened; `/ready` reports credential presence only)
- [x] Let a workspace switch reviewer models. (catalog built by probing each provider's own model list;
      clients may send only a catalog entry id, re-validated on every write and every call; see ADR-008)
- [x] Record which model actually answered. (`provider`/`model` vs the requested `model_id`; a local
      primary can fall through to a hosted model and the API, stored record and UI all say so)
- [x] Persist AI usage as a per-day credit ledger. (`ai_usage_events`: counters and identifiers only, never
      prompts or output; one succeeded call = one credit; failed calls consume quota without earning credit)
- [ ] Build the credits consumption heatmap on `GET /workspaces/{id}/ai/usage`. (response rows are sparse
      and oldest-first, so the client zero-fills the gap days)

## Phase 5 — Hardening and release
- [x] Add audit events and structured metrics. (audit events; metrics pending)
- [x] Implement outbound integrations. (Slack, Jira and signed webhooks behind
      `/api/v1/workspaces/{id}/integrations` and `/webhooks`; Fernet-encrypted write-only credentials,
      retrying outbox with dead-lettering, SSRF guards, egress off by default; see ADR-007)
- [x] Add integration security tests. (25 egress-guard cases, 16 mocked-transport sender cases,
      15 API/outbox tests: tenant isolation, role checks, redaction, blocked internal targets,
      retry/backoff/dead-letter/redelivery)
- [x] Review data retention and delete flows. (upload delete done; `expires_at` set via `upload_retention_days`; sweep job pending)
- [x] Add request limits, scan quotas, and concurrency limits. (upload/scan rate limits and the AI
      per-minute limiter are in-process; the AI daily quota is counted from stored rows, so it survives a
      restart — replace the rest before a multi-process deploy)
- [ ] Run dependency, secret, and static-analysis scans on the platform itself.
- [x] Perform tenant-isolation tests and threat-model review. (tenant-isolation tests pass)
- [ ] Test backup/restore and worker cleanup.
- [ ] Write deployment, incident response, and user documentation.
- [ ] Conduct usability review and accessibility checks.
- [ ] Prepare MVP release notes and known limitations.

## Requested 2026-10-22 — connect flows and console ergonomics
Scope beyond the current PRD, so each item below needs a decision recorded in `DECISIONS.md` before it ships.

- [ ] Replace pasted integration tokens with OAuth connect flows. (authorize redirect, callback code
      exchange, Fernet-encrypted access+refresh reusing `integration_configs.secret_enc`, silent refresh,
      one-click disconnect; webhook signing secret auto-generated, shown once, rotatable)
- [ ] Add GitHub as a linked provider with a repository picker. (PRD puts GitHub in Phase 4; the
      chosen scope is link → grant access to selected repos → scan, no PR comments)
- [x] Standardize buttons. (one `xs/sm/default/lg` ladder across Button/Input/SelectTrigger, `block`
      replacing `className="w-full"`, the code-chrome copy control and `CopyButton` moved onto the
      primitive; scale documented in DESIGN.md. Remaining known exception: the topbar account pill,
      handled with the account work below)
- [ ] Make the sidebar collapsible with nested collapsible groups, Integrations containing
      Slack/Jira/GitHub/Webhooks, and a thin scoped scrollbar instead of the wide global one.
- [ ] Build a real account page and fix the topbar menu. (`/app/profile` does not exist; `Settings.jsx`
      is read-only inputs with no API calls; the account dropdown markup exists but does not open)
- [ ] Ship the credits consumption heatmap. (month labels, horizontal scroll, hover tooltip with the ISO
      date and credits, emerald intensity ramp, legend)

## Requested 2026-10-24 — autonomous agent review
- [x] Add provider-neutral `read_file` and literal `search` investigation turns, cross-file evidence
      validation, last-good-review preservation, trace steps and audit activity metrics. (ADR-012)
- [x] Make file, byte, call, investigation and context budgets opt-in. Zero is the unlimited default;
      positive operator caps still work, and manifest confinement, evidence checks, the audit deadline
      and AI quota remain independent. (ADR-013; 300 backend tests passing)
- [ ] Complete the external GitHub App setup: register the integration and Supabase callbacks, grant
      Account Email addresses read-only, and allow the console `/auth/callback` in Supabase. Backend
      callback generation and the shared client id are verified; provider settings require the operator.

## Working agreement
Do not start the next phase merely because the previous phase's code exists. Confirm tests, acceptance criteria, security review, and documentation updates first.
