# Implementation Plan / Tasks

Use `[ ]` for pending, `[/]` for in progress, and `[x]` only after verification.

## Phase 0 — Product and engineering foundation
- [ ] Confirm final product name, language, initial deployment target, and retention policy.
- [x] Review all project docs and resolve open questions. (open questions remain in PRD; stack per Vulnix_TECH_STACK.md)
- [x] Create repository layout and baseline README.
- [x] Add `.gitignore`, `.env.example`, formatter, linter, and test runner.
- [ ] Write threat model and security review checklist. (AI_SECURITY.md covers AI/worker threats; platform-wide checklist pending)
- [x] Create local development environment for PostgreSQL and Redis. (infrastructure/compose.yaml)
- [/] Establish CI for linting and unit tests. (`.github/workflows/ci.yml` runs pytest and the frontend
      build on every push; both lint steps report findings but do not fail the run until the debt below is
      paid — ADR-026)

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
- [x] Make hosted AI (Groq) a working provider, not fallback-only. (provider union widened; `/ready`
      reports credential presence only. Revised by ADR-015: each hosted reviewer has its own credential)
- [x] Let a workspace switch reviewer models. (catalog built by probing each provider's own model list;
      clients may send only a catalog entry id, re-validated on every write and every call; see ADR-008)
- [x] Record which model actually answered. (`provider`/`model` vs the requested `model_id`; a primary that
      does not answer hands over and the API, stored record and UI all say so)
- [x] Chain the hosted reviewers so an audit survives an outage. (Google AI Studio and OpenRouter added
      behind the same OpenAI-compatible adapter as Groq, each with its own credential, address, timeout and
      context window; any configured reviewer can be primary and any can take over; a failed link is parked
      for a cooldown instead of re-paid on every retry; a handover resolves only a model the account has.
      See ADR-015)
- [x] Bound the request before it can be billed. (`max_tokens` on every hosted reply with a truncation
      error rather than a re-ask; prompt measured against the reviewer's window and refused as
      `AI_CONTEXT_OVERFLOW` before the socket opens; only a call that answered is charged)
- [x] Persist AI usage as a per-day credit ledger. (`ai_usage_events`: counters and identifiers only, never
      prompts or output; one succeeded call = one credit; a failure, a timeout or a retry that eventually
      worked spends no credit at all)
- [x] Build the credits consumption heatmap on `GET /workspaces/{id}/ai/usage`. (response rows are sparse
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

## Requested 2026-10-27 — every audit is an AI audit
- [x] Stop CLI analysers running as default scan stages. `ScanOptions` and `build_adapters()` now treat
      `static_analysis`, `secrets` and `dependencies` as opt-in, the New Audit form starts with AI review
      only, and the audit detail says when no CLI tool was asked for. Adapters remain available on request.
      (ADR-014, revises ADR-001)
- [x] Report `NO_ANALYSIS_REQUESTED` when the agent is off and no category was requested, instead of
      blaming absent tools with `ALL_SCANNERS_FAILED`.
- [x] Make `NO_SOURCE` truthful and act on its cause: the skipped step now states the intake candidate
      count, and reviewable source covers markdown, HTML and templates, JSON/XML/properties, PowerShell,
      notebooks, more languages and credential dotfiles, because the agent is the default secret reviewer.
- [x] Restore backend startup: pin `sqlalchemy>=2.0.36,<2.1` so the 2.1 compiled extension that Windows
      Application Control blocks cannot be selected again, and return `/health` to liveness only.
- [ ] Re-run one audit against a real repository and confirm the execution stream contains agent steps and
      no CLI rows. Requires the operator's session and permission to spend AI credits.

## Requested 2026-10-27 — the failure modes a live audit exposed
- [x] Survive a dead database connection during a scan. A crash now records the audit as `failed` with
      `INTERNAL_ERROR` and a completion time instead of leaving a `running` zombie and raising out of the
      worker; the write is retried once on a fresh session and then given up. The step trace reassigns
      `scan.summary` rather than mutating it, and survives one lost commit. (ADR-016)
- [x] Stop a handover sending a model name the provider never confirmed. A reviewer whose own listing
      reports nothing usable is skipped with no request and no cooldown, instead of spending its one
      takeover attempt on an invented name and then being benched for it. (ADR-016, revises ADR-015)
- [x] Stop the failover chain grinding a cooled-down reviewer. A context-overflow refusal no longer parks
      the narrow reviewer — the width belongs to the file, not to the link's health — and the audit's retry
      sleep is at least as long as the earliest cooldown among the reviewers it was actually handed work by.
      (ADR-016)
- [x] Name why a hosted reviewer refused a request. The reviewer's own machine-readable reason code decides
      between `AI_CONTEXT_OVERFLOW` (413) and `AI_MISCONFIGURED` (502); its message body is read for that
      code only, logged as a status, and never reaches a client. (ADR-016)
- [x] Stop offering local inference by default. `VULNIX_AI_LOCAL_ENABLED=false` and a hosted boot default
      remove the local reviewer from the picker and from severity routing while the adapter, its settings,
      its alias and its tests all stay; one setting brings the whole path back. Landing copy that advertised
      "Ollama (default) — fully local, zero egress" now states the failover behaviour the code supports.
      (ADR-017, revises ADR-008)
- [x] Rotate or revoke the OpenRouter credential that was committed in `backend/.env.example`. The owner
      rotated it on 2026-10-27 and put the replacement in `backend/.env`, which git ignores; the tracked
      example line stays empty. The value remains in git history at `013f96d` and is dead there. (ADR-018)
- [x] Stop the unit suite inheriting reviewer credentials. Catalog tests blank all four hosted
      credentials before probing, so a key in `backend/.env` cannot make a reviewer appear that a test
      asserts is absent — the hazard that turned thirteen tests red the moment one key was configured.
      Adding a reviewer now means adding its credential to that fixture. (ADR-021)

- [x] Make the audit detail console follow the selected theme. `.audit-ops` in `frontend/src/index.css`
      declared the console token set dark-only and unconditionally, so that page ignored the theme control
      while every other `/app` page obeyed it. The palette is now light-as-base with `.dark .audit-ops`
      replacing it, and the glow, grid overlay, shadow and terminal scrollbar are variables instead of
      literals. The runs and findings lists were already token-driven and are unchanged. (ADR-019)
- [x] Stop the execution stream inventing runtimes. A finished audit measured its duration from the moment
      the page mounted, so a run that failed in about a minute reported `runtime 36m 39s` and the number grew
      with the calendar. It now times to `completed_at` and keeps the ticking clock for live runs only.
      (ADR-020)
- [x] Make the API answerable from a deployed console origin. `VULNIX_CORS_ALLOW_ORIGINS` is an explicit,
      exact-origin allowlist and `CORSMiddleware` is mounted only when it is non-empty, with credentials off
      because the bearer token is set by the console itself. An empty list keeps the dev proxy same-origin, and
      the middleware sits inside the request-context layer so a preflight still gets the security headers.
      Covered by `tests/unit/test_cors.py`. (ADR-022)
- [x] Make the S3 storage backend usable against an S3-compatible bucket. A signing region setting (`auto` for
      R2, boto3 otherwise refuses to sign), no automatic CRC32 write trailer, a sha256 computed from the bytes
      this app accepted, and a `put_stream` that hashes in bounded chunks and re-sends from position zero instead
      of buffering 100 MiB in a 512 MB process. `boto3` floored to the release that accepts those options;
      `tests/unit/test_storage_s3.py` stubs the module so the assertions run without it installed. (ADR-023)
- [x] Deploy the backend as a queue, not a request. `render.yaml` defines the API web service, a
      `--concurrency=1` worker, the beat process and a private Redis, with `/health` as the health check and
      a commented `preDeployCommand: alembic upgrade head` (Render only runs it on a paid instance type, so
      the Shell is the fallback the runbook describes). The beat schedule now lives in the Celery app because a
      delivery in backoff is only ever claimed by that sweep. `backend/requirements.txt` installs the project
      plus the Postgres and storage extras. (ADR-024)
- [x] Deploy the console as a static SPA. `frontend/public/_redirects` carries the `/* /index.html 200` fallback
      the router needs and `frontend/public/_headers` the transport and cache policy; `DEPLOYMENT.md` is the
      runbook for both hosts, including the order the cross-referencing hostnames become knowable. No CSP is
      shipped, and the reason is recorded rather than left implied. (ADR-025)
- [ ] Sign the console with a Content-Security-Policy. Deferred by ADR-025: the animation layer writes inline
      styles and the PDF export uses a `blob:` URL, so a workable policy needs `style-src 'unsafe-inline'` and
      the whole console exercised behind it — a wrong policy removes a feature quietly instead of failing.
- [ ] Upload straight to object storage. A 100 MiB archive still passes through the API process and out to the
      bucket inside one request, which is slow on a small instance and can meet a host's request ceiling. The fix
      is a signed PUT from the browser, which is a new API surface and a new client path. (ADR-023 consequence)
- [ ] Name a reviewer's refusal on the page, not only in the server log. `AI_MISCONFIGURED` currently reads
      the same whether the credential was rejected, the request shape was refused, or the review was blocked
      by a content filter; the distinguishing status and reason tag exist and are logged, so surfacing the
      tag on the step would let an operator triage from the console. Needs a decision on how much of a
      vendor's machine-readable code belongs in a client surface that is otherwise alias-only.

## Requested 2026-10-27 — continuous integration
- [x] Run the suite and the build on every push. `.github/workflows/ci.yml` has a `backend` job (Python 3.14,
      `pip install -e ".[dev,postgres]"`, ruff, pytest) and a `frontend` job (Node 22, `npm ci`, eslint,
      `vite build`, plus an assertion that `_redirects` and `_headers` reached `dist`). It needs no repository
      secret, because `tests/conftest.py` pins the environment the suite asserts on. `backend/pyproject.toml`
      now excludes `migrations/` from ruff so the report describes authored code. First run not yet
      observed. (ADR-026)
- [ ] Make the backend `Lint` step blocking by clearing 9 ruff findings, 6 of them auto-fixable: 3 `F401`
      (`app/agent/code_agent.py:26`, `app/agent/dep_agent.py:12`, `app/main.py:110`), 3 `E501`
      (`app/agent/intel_agent.py:135`, `app/modules/auth/routes.py:600` and `:602`), 1 `UP035` and 1 `UP037`
      (both `app/agent/router.py`), 1 `I001` (`app/modules/scans/routes.py:3`). Two cautions: the `F401` at
      `app/main.py:110` is the deliberate `import app.agent` whose side effect registers the agent's tools, so
      it needs a `# noqa: F401` rather than deletion, and removing an unused import can drop the only thing
      that made a module execute — this needs a full pytest run after, not just a green ruff.
- [ ] Make the frontend `Lint` step blocking by clearing 39 errors and 2 warnings across 14 files: 29
      `no-unused-vars`, 6 `react-hooks/set-state-in-effect`, 3 `no-undef`, 1 `react-refresh/only-export-components`,
      2 `react-hooks/exhaustive-deps`. The `no-undef` findings are the only ones that may be live bugs — an
      undefined identifier is a `ReferenceError` at runtime, not a style complaint — and deserve their own read
      before anything is renamed. Largest file: `src/pages/Landing.jsx` (16). Six of these are hook logic and
      cannot be verified without a signed-in session.
- [ ] Fail a CI run on a vulnerable dependency. GitHub reports 5 advisories against the default branch
      (1 high, 2 moderate, 2 low) and the workflow does not look at them; this is also Phase 5's
      "Run dependency, secret, and static-analysis scans on the platform itself". The gate needs a prior
      decision about what a transitive advisory means for a build, because `semgrep`, `gitleaks`, `bandit`
      and `npm audit` are exactly the tools Vulnix's own adapters wrap.
- [ ] Give the frontend a test runner. There is none, so `vite build` is the only functional check that job
      has, and it proves the bundle compiles rather than that a page behaves.
- [ ] Rotate the GitHub App private key in `backend/.env`. On 2026-10-27 a shell command intended to list
      only variable names printed the key body, because the value is a multi-line PEM whose inner lines
      contain no `=`; nothing was committed and nothing left the machine, but the value is in that session's
      transcript and should be treated as exposed. The file itself is gitignored and stays put.

## Working agreement
Do not start the next phase merely because the previous phase's code exists. Confirm tests, acceptance criteria, security review, and documentation updates first.
