# Project Progress

**Last updated:** 2026-10-27
**Overall status:** Backend MVP implemented and verified (Phase 1–4 backend scope); console UI redesigned; Slack/Jira/webhook integrations implemented end-to-end and off by default; consent-window (OAuth) connections for Slack, Jira and GitHub plus GitHub repository import implemented in the backend; AI review works against a hosted Groq model with a switchable per-workspace selection and a durable credit ledger; the console has a working account surface and a collapsible, nested sidebar
**Current milestone:** OAuth backend shipped (ADR-010); the Connect-button UI and the credits heatmap remain

## Completed
- [x] Initial product concept documented.
- [x] MVP scope and exclusions drafted.
- [x] Proposed architecture and trust boundaries documented.
- [x] Initial data model and API contract drafted.
- [x] Acceptance criteria, UX direction, and engineering guardrails drafted.
- [x] FastAPI backend scaffold with modular layout, config, stable error shapes.
- [x] Alembic migration for the full schema (verified with `alembic upgrade head`).
- [x] Supabase-style JWT auth (HS256/JWKS), workspace RBAC, dev mode for local use.
- [x] Workspaces, projects, uploads, scans, findings, reports, audit endpoints per API_SPEC.
- [x] Safe ZIP intake: size caps, traversal/symlink/bomb/nesting rejection, quarantine storage.
- [x] Scanner adapters (Semgrep, Bandit, Gitleaks, pip-audit, Trivy) with normalization,
      fingerprint dedupe, tool-run records, partial-failure handling.
- [x] Scan pipeline with eager (inline) and Celery modes, cancellation checks, temp-dir cleanup.
- [x] AI layer: secret redaction, prompt-injection-resistant prompts, strict schema validation,
      rate limit + daily quota (disabled by default).
- [x] JSON/Markdown report export with escaping; audit events for sensitive actions.
- [x] Tests: 37 passing (archive safety, normalization, redaction, AI schema, report
      escaping, full API flow, tenant isolation, role checks). Ruff clean.
- [x] Console UI: all 26 `/app/*` pages redesigned against real API shapes, with emerald as the
      single primary and dev-only, clearly-labelled sample content.
- [x] Slack / Jira / outbound webhook integrations: routes, tables, migration, encrypted write-only
      credentials, guarded egress, retrying outbox worker, event emission, tests and documentation.
- [x] AI review as a switchable hosted/local model: probed catalog, per-workspace selection,
      hosted failover, answering-model provenance, and a durable per-day credit ledger.
- [x] Autonomous agent investigation: bounded read-only repository tools, cross-file evidence
      validation, preserved last-good reviews, live investigation steps and audit activity metrics
      (ADR-012).
- [x] Standard console control scale: one `xs/sm/default/lg` ladder shared by `Button`, `Input` and
      `SelectTrigger`, a `block` prop replacing per-page `w-full`, and no page-level height overrides
      left in `/app` (documented in DESIGN.md "Control standards").
- [x] Collapsible sidebar: a persisted icon rail, collapsible groups, nested destinations under
      Integrations (Slack/Jira/Webhooks, with GitHub listed as not-yet-available), a thin
      pointer-triggered scrollbar, and tooltips for every rail control.
- [x] Account surface: `/app/profile` over `GET|PATCH /auth/me` and `PUT /auth/password`, the topbar
      menu fixed (its label crashed the app), real workspace roles, and the header identity following
      a rename without a reload (ADR-009).
- [x] OAuth backend: `oauth_connections` table and migration, signed expiring state, the provider
      callback, silent token refresh, disconnect, the Slack/Jira/GitHub resource pickers, a
      generated-and-rotatable webhook signing secret, and `POST /projects/{id}/uploads/github`, which
      streams a selected repository's archive into the same quarantined intake as an upload (ADR-010,
      which supersedes the ADR-007 alternative that rejected consent flows).
- [x] Deployment shape: the console builds as a static SPA for Cloudflare Pages with its own history
      fallback and header policy, and the backend deploys on Render as an API plus a Celery worker, a beat
      sweeper and a private Redis, with quarantined archives in an S3-compatible bucket. `render.yaml`,
      `backend/requirements.txt`, `frontend/public/_redirects`, `frontend/public/_headers` and the runbook in
      `DEPLOYMENT.md` (ADR-022 to ADR-025). Authored and validated against the vendors' documented formats;
      no real deploy has been executed yet.
- [x] Continuous integration: `.github/workflows/ci.yml` runs on every push, every pull request and manual
      dispatch, in two jobs. `backend` installs `.[dev,postgres]` on Python 3.14 and runs ruff then pytest;
      `frontend` installs from the lockfile on Node 22 and runs eslint, `vite build`, and an assertion that
      the Pages config files reached `dist`. No repository secret is needed or used — the suite pins its own
      environment. Both lint steps report findings without failing the run until the debt in `TASKS.md` is
      paid, which is the only place `continue-on-error` appears. (ADR-026)

## In progress
- [ ] Make the two CI `Lint` steps blocking, once 9 ruff findings and 39 eslint errors are gone (TASKS.md).
- [ ] Cover the two Linux-only paths the suite still does not reach: `sandbox_env()`'s non-`nt` branch, and
      extraction of an archive that actually contains a symlink entry (TASKS.md, ADR-026 consequence).
- [ ] OAuth connect UI: Connect/Disconnect buttons in place of every pasted token, the channel/site/
      project/repository pickers, the one-time webhook secret reveal, and `/app/integrations/github`.
- [ ] Daily credits heatmap on the AI usage ledger.

## Blocked / undecided
- Final product name.
- Production hosting, object storage, and queue provider.
- AI provider/data-processing terms for hosted models — Groq now works and is the default failover,
  so this is a review-terms question rather than a capability question; the local option remains.
- Upload retention period and hard-delete policy.
- Worker container isolation design for production.

## Next actions
1. Build the OAuth connect UI over the endpoints that now exist, including the GitHub screen and route.
2. Build the daily credits heatmap on `GET /workspaces/{id}/ai/usage` (sparse rows; client zero-fills).
3. Deploy the stack: create the Render blueprint from `render.yaml`, the Cloudflare Pages project from
   `frontend`, then set the two hostnames and the CORS allowlist that only exist after the first deploy.
4. Containerize the worker with resource limits and network restrictions.
5. Run Vulnix against its own backend code as a dogfood scan.
6. Define retention/deletion policy and audit-log retention.

## Update protocol
Update this file at the end of a work session. Only mark work complete after implementation and verification. Record test commands and outcomes where relevant.

## Verification log (2026-10-22, sidebar ergonomics and account surface)

- Backend: `python -m pytest -q` — **163 passed, 1 failed**. The failure is the same environmental one as
  the previous round: this machine has `C:\Users\iddyc\.local\bin\semgrep.exe` installed, so Semgrep runs and
  exits non-zero (`NONZERO_EXIT`) where `test_scan_without_available_scanners_fails_gracefully` expects
  `TOOL_UNAVAILABLE`/`EXEC_FAILED`. Not claimed passing.
- New account coverage — `tests/integration/test_auth_me.py`, 10 tests, all passing: roles listed across two
  workspaces, `"  Ada Lovelace  "` → `"Ada Lovelace"` round trip, `""` and `"   "` → 422 (the second needed a
  `mode="before"` trim validator, because `min_length` counts spaces), 401 when `auth_disabled` is forced off,
  the forwarded provider URL/payload/`Authorization` header asserted against an httpx stub, 401 without a
  bearer token, a provider 422 surfaced, 429 on the sixth rotation inside 15 minutes, and a short password
  refused before any provider call is made.
- `python -m ruff check app` — clean. No migration: the profile row already had `display_name`.
- `npx eslint src` — 13 errors, 1 warning, all in the pre-existing landing files; none in
  `Sidebar.jsx`, `Header.jsx`, `Layout.jsx`, `Profile.jsx`, `Settings.jsx` or `dropdown-menu.jsx`.
  `npx vite build` — succeeded.
- Browser probe on `http://localhost:5199` with `?sample=1`, so no request reached the deployment backend:
  - Rail collapse persists `vulnix.rail.collapsed` as `1`/`0` and moves all three regions together — aside
    `w-60` ↔ `lg:w-16`, main `lg:pl-60` ↔ `lg:pl-16`, header `lg:left-60` ↔ `lg:left-16`. Collapsed rail:
    0 labelled links and 18 tooltip triggers; expanded: 18 labelled links and 0 tooltips.
  - Group and sub-group state persists in `vulnix.nav.groups`; a deliberate collapse outranks the active
    route. GitHub renders as a static "Coming soon" row because no screen or endpoint is behind it.
  - Rename round trip: typing `  Ada Lovelace  ` enabled Save, submit produced the success toast, rewrote
    `user_data` with the trimmed name, re-seeded the input and disabled Save again, and the topbar monogram
    changed `DE` → `AL` with no reload — the `refresh()` path working as intended.
  - The account menu opens and leaves the page mounted. It previously looked dead because
    `DropdownMenuLabel` mounted Base UI's `GroupLabel` without a `Group` ancestor, which threw and took the
    whole tree down; the component now owns its `Group`.
- Not verified live: the password form. It renders because the dev proxy's `/ready` reports
  `supabase_auth: configured`, but `:8000` is the user's own backend and identity provider, so it was never
  submitted — that write path rests on the stubbed test only.
- Environment limit, restated for future probes: this webview reports `document.visibilityState === "hidden"`,
  so CSS transitions and some layout reads go stale and `take_screenshot` fails with
  `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`. The grid-collapse assertions were made by forcing
  `transition: none` and reading computed `grid-template-rows`, not by observing motion.
- Spec updates: ADR-009 records who owns the name versus the credential, and API_SPEC gained the
  `GET|PATCH /auth/me` and `PUT /auth/password` contract. Settings' two now-false claims ("no password-change
  route", "the API has no route to update a profile") were replaced with links to the profile page.
- Not done here: OAuth connect flows and the daily credits heatmap.

## Verification log (2026-10-22, AI model selection, hosted provider and credit ledger)

- `python -m pytest tests -q` — **153 passed, 1 failed**. The failure is
  `tests/integration/test_flow.py::test_scan_without_available_scanners_fails_gracefully`, which expects
  `TOOL_UNAVAILABLE`/`EXEC_FAILED` but this machine has `C:\Users\iddyc\.local\bin\semgrep.exe` installed, so
  Semgrep runs and exits non-zero (`NONZERO_EXIT`). Environmental and pre-existing; not claimed passing.
- New AI coverage: 9 unit catalog tests, 13 provider tests, 13 service tests, 10 API tests — including
  that a bare model name, an unknown provider, an un-pulled model and an empty string are all refused, and
  that the response names the answering provider rather than the requested entry after a failover.
- `python -m ruff check app tests` — clean.
- `alembic upgrade head` on a fresh temporary SQLite — `workspace_ai_settings` and `ai_usage_events` created
  with all columns and both `(user|workspace, day)` indexes; `alembic downgrade -1` removed both tables and
  returned the database to `b4d1f0a92c17`. Scratch file deleted afterwards.
- Live proof against the real Groq account, on a throwaway SQLite file only — never the deployment database:
  the catalog probed 4 reachable entries (1 local, 3 hosted); a switch persisted and survived a backend
  restart; an explanation was attributed to `groq · openai/gpt-oss-20b`; with the local model selected the
  call timed out locally and fell through, and the record showed `provider=groq`,
  `model=qwen/qwen3.8-27b`, `model_id=ollama:qwen3.5:4b`. Credits read 5/100 from the ledger after that
  restart, which is the point of deriving the quota from stored rows instead of process memory.
- Availability finding, recorded because it contradicts the request: this Groq key's `GET /models` exposes
  **no general Llama chat model** — only 512-token `llama-prompt-guard` safety models. Llama is therefore not
  offered; Qwen 3.8 27B and two GPT-OSS sizes are. The catalog reports what the provider answers rather than
  what was asked for.
- Browser probe (`http://localhost:5199` against a scratch backend on `127.0.0.1:8124`, using the new
  `VITE_API_PROXY_TARGET` so the deployment backend on `:8000` was never touched): switch →
  `PUT /ai/settings` 200 → checked radio, header pill, and stored explanation all updated; the failover
  banner rendered its substitution notice. Screenshots were unavailable in this environment
  (`NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`), so verification used the accessibility snapshot, DOM assertions
  and the network log. Note for future probes: a CDP click on the visually-hidden radio hits a 1px clipped
  target and does nothing — the row/label is the hit area, and clicking it works.
- `npx eslint src` — 13 errors, 1 warning, all in pre-existing landing files
  (`Landing.jsx`, `landing/components/*`, `ui/hover-border-gradient.jsx`); none in the AI files.
- `npx vite build` — succeeded.
- Not done here: the credits heatmap UI, OAuth connect flows, button standardization, the collapsible
  sidebar, and the account page. `Requirements & Specs/.env.example` now documents the full AI variable set.

## Verification log (2026-10-22, integrations + console redesign)
Console UI:
- Redesigned all 26 authenticated `/app/*` pages against the real API shapes; emerald is the single
  console primary and violet survives only on genuinely AI-labelled actions. Seed content is confined
  to a dev-only, clearly-labelled layer; pages with no backing endpoint state that honestly rather than
  faking a save.
- Landing pages were explicitly out of scope and still carry 13 pre-existing `eslint` errors
  (unused imports, one `set-state-in-effect`). They are out of the redesign boundary and were not touched.

Integrations (Slack, Jira, outbound webhooks) implemented for real:
- New `/api/v1` integrations router: 12 endpoints for provider configs, credentials test, webhook CRUD,
  the delivery log and explicit redelivery. Reads need `viewer`, writes/tests/redelivery need `admin`.
- Three tables plus migration `b4d1f0a92c17_integration_outbox`
  (`integration_configs`, `webhook_endpoints`, `integration_deliveries`).
- Credentials are Fernet-encrypted per workspace and write-only: no response, audit record or log line
  ever carries the value, only `configured` and a last-four hint.
- Persisted outbox with atomic claim, exponential backoff capped at 1h, `dead` dead-lettering, and a
  worker task (`vulnix.deliver_integration`) plus a retry sweep (`vulnix.drain_integration_outbox`).
  Eager mode keeps dev and tests inline.
- SSRF guard in `app/core/egress.py` runs on every attempt: HTTPS only, ports 443/8443, no URL
  credentials, resolve-then-refine for private/loopback/link-local/multicast/reserved/unspecified/
  CGNAT/IPv4-mapped addresses, no redirects, no proxy env, request body cap, no URL/payload logging.
  `integration_allow_private_targets` exists but defaults to off and is documented as development-only.
- Event payloads are built from identifiers and counters, with free text whitespace-normalized,
  secret-redacted and clipped to 300 characters; provider error strings are sanitized to `[A-Z0-9_]`.
- Jira opens one issue per completed scan above a severity floor. No per-finding tickets, no status
  sync, no transitions — and the UI says so instead of claiming it.
- Fixed two pre-existing pagination bugs surfaced by the new tests: cursors compared an ISO string
  against a `DATETIME` column, and `next_cursor` was taken from `rows[limit]`, silently skipping the
  first row of every subsequent page.
- Documented in `API_SPEC.md` (endpoints, error codes, security requirements), `DATA_MODEL.md`
  (three tables, relationships, data rules), `DECISIONS.md` (ADR-007, including the residual
  DNS-rebinding/TOCTOU risk) and `.env.example` (seven new `VULNIX_INTEGRATION*` keys).

Commands run and outcomes:
- `python -m pytest tests/integration/test_integrations.py tests/unit -q` — 100 passed.
- `python -m pytest -q` (full suite) — 1 failure,
  `tests/integration/test_flow.py::test_scan_without_available_scanners_fails_gracefully`: it asserts
  `error_code in ("TOOL_UNAVAILABLE", "EXEC_FAILED")` but this machine has
  `C:\Users\iddyc\.local\bin\semgrep.exe` installed, so Semgrep runs and exits non-zero
  (`NONZERO_EXIT`). Environmental and pre-existing, unrelated to integrations. Not claimed passing.
- `python -m ruff check app tests` — clean. `ruff check migrations` reports 6 issues in the
  pre-existing generated `628759b7406c_initial_schema.py`; the new migration matches that convention.
- `alembic upgrade head` on a temporary SQLite database — three tables and all columns created.
- `python -c "import app.main"` — 12 integration routes registered.
- `npx eslint src` — clean for every integration file; remaining errors are the landing pages above.
- `npx vite build` — succeeded (2925 modules).
- Not done: no browser probe of the three rewired pages against a running backend, and no live call to
  a real Slack/Jira endpoint. All outbound behaviour is verified through `httpx.MockTransport` tests.

## Verification log (2026-10-18, spec re-audit round)
- Re-audited all specs against the implementation; closed 12 gaps:
  1. `workspace_members.role` CHECK constraint.
  2. `uploads.size_bytes >= 0` CHECK constraint.
  3. Fingerprints include tool identity; provenance stamped via `ScannerAdapter.normalize()`.
  4. `uploads.expires_at` set from `upload_retention_days` (default 7).
  5. Rate limits on upload and scan creation (`upload_rate_per_hour`, `scan_rate_per_hour`, 429 RATE_LIMITED).
  6. `scan.started` audit event.
  7. `supported_file_types` declared on all five adapters.
  8. Scanner fixture tests for all five adapters (known output plus empty/malformed cases).
  9. `prompt_version` and validation result stored with AI explanations.
  10. Prompt-injection suite: secret redaction, `<untrusted_code>` delimiting, wrong `finding_id`/malformed output rejected, invented evidence refs filtered, AI disabled -> 503.
  11. Findings endpoint filter by `tool`.
  12. Scan completion duration logged (`scan_finished ... duration_ms=...`).
- GitHub/GitLab integrations confirmed out of MVP scope (PRD Phase 4); `git_import` kept only as data-model enum placeholder, no endpoints.
- `python -m ruff check app tests` — clean.
- `python -m pytest -q` — 53 passed.
- `python -m alembic revision --autogenerate` + `upgrade head` — migration regenerated with new CHECK constraints.

## Verification log (2026-10-22, OAuth backend)

- New module `app/modules/integrations/oauth.py` (providers, signed state, token exchange and refresh,
  resource reads, guarded archive streaming) plus `connections.py` (row storage, silent refresh,
  `DeliveryCredential` precedence), `oauth_routes.py` (13 routes), `app/schemas/oauth.py`,
  `OAuthConnection` in `app/db/models.py`, migration `d9f4c2b7e1a3_oauth_connections.py`.
- Migration verified on a scratch SQLite file only: `alembic upgrade head` reached `d9f4c2b7e1a3` and
  created `oauth_connections` with all 13 columns; `alembic downgrade -1` dropped the table and returned
  to `c7a3e5d21b48`; re-`upgrade head` restored it. `backend/.data/vulnix.db` was not touched — it is
  still at `628759b7406c` with no `oauth_connections` table, which is what proves the run was isolated.
- `tests/integration/test_oauth.py` — 18 tests, all passing: state signature/expiry/replay and
  provider-mismatch, `providers` reporting both unconfigured reasons then a real redirect URI and scopes,
  connect requiring admin and storing nothing, the callback sealing tokens (`access_enc != plaintext`,
  `decrypt_secret` round trip) and `302`-ing with `connected=1`, forged/mismatched/missing-code callbacks
  landing on `oauth_error=…` with no row written, silent refresh with Jira's rotated refresh token,
  `OAUTH_CONNECTION_EXPIRED` with none, disconnect clearing a hand-pasted secret, a consent alone making
  a delivery succeed with `Authorization: Bearer <consented token>`, Jira refusing an ungranted `site_id`
  with 403, repository selection re-reading ids from the provider and refusing an unknown one, the GitHub
  import landing in quarantine as `web_trunk.zip` and then scanning to `completed` through the existing
  pipeline, the same import refusing an unselected repo (409 before any fetch) and a `../../` ref (422
  before any fetch), `archive_target` rejecting 10 path-shaped names and refs, and the webhook secret
  generated once, absent from every later read, and rotatable.
- `python -m pytest -q` — **181 passed, 1 failed**. The one failure is the same environmental case as the
  previous two rounds: `C:\Users\iddyc\.local\bin\semgrep.exe` exists here, so
  `test_scan_without_available_scanners_fails_gracefully` sees `NONZERO_EXIT` where it expects
  `TOOL_UNAVAILABLE`/`EXEC_FAILED`. Not claimed passing.
- One existing contract changed, deliberately: `POST /webhooks` now returns a generated signing secret
  once, so `test_webhook_validation_and_crud`'s old `configured is False / "secret" not in hook`
  assertion was replaced with the new one (generated on create, absent from the list read).
- `python -m ruff check app tests` — clean. `python -c "import app.main"` — clean. Nine operations are
  registered (eight workspace-scoped: `providers`, `{provider}/connect`, `{provider}/connection` DELETE,
  `connections`, `slack/channels`, `jira/setup`, `github/repositories` GET and PUT; plus the public
  `integrations/oauth/{provider}/callback`). Their literal paths are mounted before
  `/integrations/{provider}` so they win the match.
- Not verified live: no provider round trip was performed. Client credentials were never requested,
  echoed or written by this agent; `VULNIX_*_CLIENT_ID/SECRET` are operator `.env` values and the
  example entries are placeholders. No browser check: the UI does not use these endpoints yet.
- Docs: ADR-010 recorded (and ADR-007's rejected-OAuth alternative marked as superseded); DATA_MODEL
  gained `oauth_connections` and the precedence note; API_SPEC gained the OAuth connections section,
  `POST /projects/{id}/uploads/github`, the connect-gating rules on `PUT /integrations/{provider}`, the
  webhook generate/rotate contract, and the consent error codes; `.env.example` gained the nine OAuth
  variables.

## Verification log (2026-10-23, audit retries and the GitHub App migration)
- **Audit retries (task #61).** A reviewer that throttles, times out or answers with unusable JSON is
  now asked again — up to `VULNIX_AI_MAX_RETRIES` (default 8) with jittered exponential backoff capped
  at 10s — before the file is marked failed. The retry sits on the reviewer call rather than on the
  audit, so an archive is extracted once and a retry never re-reads the whole repository.
- Two bounds, both load-bearing: retries stop when the next backoff would pass the audit's own
  `scan_total_timeout_seconds` deadline (a fast failure beats a slow one), and two consecutive files
  that survived every retry end the review rather than spending the rest of it.
- A refusal is not retried. `_post` in `app/ai/providers/ollama.py` now splits what `raise_for_status`
  collapsed: a busy status (408/409/425/429/5xx) is `AI_UNAVAILABLE` and worth asking again, any other
  4xx is `AI_MISCONFIGURED` and reported at once, because a wrong API key gives the same answer eight
  times and calling that an outage sends whoever fixes it to the wrong machine. A 200 with an
  unreadable body became `AI_INVALID_OUTPUT` instead of an unhandled `JSONDecodeError` that failed the
  whole audit.
- Retries are free: `used_today` counts `status == "succeeded"` only, and `record_usage` still writes
  one row per file rather than per attempt. `AgentOutcome` gained a `retries` counter, reported in
  `summary["agent"]["retries"]` and kept separate from `calls` because a retry is not a unit of work.
  Each attempt is written to that file's own trace step, so the console says "retry 3 of 8" instead of
  spinning with no news.
- **GitHub App migration (task #62, ADR-011).** `OAUTH_APPS["github"].scopes` is now empty and
  `authorize_url` omits the `scope` parameter entirely when an app declares none; `_normalize_tokens`
  records only the scope the provider returned instead of falling back to the compiled-in list, which
  had been writing a `repo` grant GitHub never gave. `github_repositories` lists through
  `/user/installations` and `/user/installations/{id}/repositories` instead of `/user/repos`, capped at
  20 installations, and walks them as one continuous list so paging still reaches every account.
- `tests/unit/test_ai_providers.py` — the `FakeReply` double grew `status_code`/`is_success` for the new
  `_post` path and lost `raise_for_status`, which nothing calls any more; three tests added for the
  busy/refused/unreadable split.
- `tests/integration/test_agent_scan.py` — two tests added: a reviewer that fails twice then answers
  completes the audit with `retries == 2`, `calls == 1` and one credit billed; a reviewer that refuses
  is asked exactly once. The `agent` fixture now pins `ai_max_retries` to 2 and both backoff settings to
  `0.0`, because a test run must not sleep through a backoff to prove one exists — that pin took the
  file from 63s to 19s and the suite from 100s to 53s.
- `tests/conftest.py` — `VULNIX_INTEGRATIONS_ENABLED=false` is now pinned rather than left to its
  default. Its own comment claimed integrations stay off while the value came from the developer's
  `.env`, so enabling GitHub there silently changed what `test_consent_works_while_egress_is_off`
  asserted.
- `tests/integration/test_oauth.py` — `test_github_consent_is_a_github_app_not_an_oauth_app` added:
  no `scope` in the GitHub authorize URL while Slack still sends its two, an exchanged token recording
  an empty scope with a real expiry and refresh token, the picker reading through installations, and no
  request ever reaching `/user/repos`. The old `scopes == ["repo"]` assertion became `== []`.
- `python -m pytest -q -p no:randomly` — **284 passed**, no failures and no skips. The semgrep-installed
  environmental failure recorded in the previous three rounds did not recur.
- `python -m ruff check` on every file touched here — clean. Repo-wide it still reports the same three
  pre-existing import-order errors in `app/modules/scans/routes.py`, which this round did not touch.
- Not verified live: no consent round trip was performed against GitHub. The callback URL that has to be
  registered on the app is derived from `VULNIX_OAUTH_REDIRECT_BASE_URL` and written into `.env` and
  `.env.example` as guidance; no credential value was requested, and none is reproduced here.
- Docs: ADR-011 recorded; API_SPEC's `providers` example and GitHub repository/renewal paragraphs
  updated; `.env.example` and `.env` gained the GitHub App setup block (callback URLs, permissions,
  token expiry).

## Verification log (2026-10-24, autonomous repository investigation)
- **Autonomous review (tasks #63–#66, ADR-012).** The initial per-file review can now request bounded
  `read_file` and literal `search` actions, follow evidence across files, and revise its hypotheses on
  later turns. Only server-mediated reads against the intake manifest are possible; there is no shell,
  arbitrary path, repository execution, package installation, browser or network action.
- A finding's exact path and full cited range must have been visible to the last successful answer.
  Search alone is not citable, and visibility snapshots prevent a failed follow-up from legitimizing an
  earlier guess. A failed follow-up keeps the initial supported findings. Duplicate evidence requests
  stop instead of looping; per-file turns, audit follow-ups, context files, bytes, calls, time and
  credits all retain hard bounds.
- `tests/unit/test_agent_investigation.py` plus `tests/integration/test_agent_scan.py` — **28 passed**.
  Coverage includes path confinement, targeted windows, literal bounded search, context budgets,
  evidence snapshots, cross-file findings, search-only rejection, failed-follow-up preservation,
  final-turn enforcement and duplicate-request stopping. All providers and CLI tools are stubbed; no
  real model call or credit spend occurred.
- `python -m pytest -q -p no:randomly` — **296 passed**, no failures or skips (two upstream deprecation
  warnings). `python -m ruff check` on the agent, configuration and new tests — clean.
- `npx eslint src/pages/AuditRunDetail.jsx` — clean after removing the unused pre-modal export path.
  `npm run build` — succeeded; Vite still reports its existing large-chunk advisory.
- The audit detail renders investigation, follow-up, targeted-read, search and failed-follow-up counts
  from `summary.agent`. A local frontend was started for a browser render check and stopped afterwards;
  it rendered without console errors but redirected to sign-in because the browser had no authenticated
  session. The populated investigation panel was therefore not verified in a live browser, and no real
  model audit was run.
- Docs and configuration: ADR-012, the scan-summary contract and this log updated; `.env.example` now
  lists the agent file, call, investigation, context and related-file budgets.

## Verification log (2026-10-24, unlimited agent coverage defaults)
- **Opt-in budgets (task #67, ADR-013).** `agent_max_files`, `agent_max_bytes_per_file`,
  `agent_max_calls`, `agent_max_investigation_turns`, `agent_max_investigation_calls`,
  `agent_max_context_files` and `agent_related_file_bytes` now default to `0`, explicitly meaning
  unlimited in that dimension. Positive values retain the previous cap behavior.
- Zero-budget semantics were implemented in intake, related-file reads and both investigation loops;
  changing the defaults alone would otherwise have produced an empty review. Duplicate-request stopping,
  manifest-only reads, literal search and evidence snapshots remain. The independent scan deadline,
  provider timeouts, AI rate limit and daily quota were not removed.
- Agent intake, investigation and scan integration tests — **41 passed**, including full unclipped intake,
  more than the old context-file allowance, three follow-ups beyond the old two-turn default, and a
  schema-default assertion covering all seven settings. Existing positive-budget and loop-prevention
  tests still pass.
- `python -m pytest -q -p no:randomly` — **300 passed**, no failures or skips (two upstream deprecation
  warnings). Targeted Ruff checks on the implementation and tests — clean. No real model audit or credit
  spend was performed; this change is backend/configuration-only, so no frontend build was needed.
- `backend/.env.example`, API_SPEC, TASKS, DECISIONS and this log now describe the zero-is-unlimited
  contract. The local `backend/.env` had no `VULNIX_AGENT_*` overrides, so it inherits the new defaults.

## Verification log (2026-10-24, GitHub App sign-in and integration callbacks)
- Traced both reported provider errors without reading or printing credential values. The integration
  callback generated by the backend is `http://localhost:8000/api/v1/integrations/oauth/github/callback`;
  Supabase GitHub sign-in instead returns through
  `https://hizseofgjynbufusyhuy.supabase.co/auth/v1/callback`. Both exact URLs must be registered on the
  GitHub App, and the frontend's `http://localhost:5173/auth/callback` must be allowed in Supabase URL
  Configuration.
- A read-only, unauthenticated Supabase authorize request returned 302 and confirmed its GitHub callback
  URL and that sign-in and repository integration use the same GitHub App client. The post-authorization
  "Error getting user profile from external provider" matches the documented GitHub App setup missing
  Account permissions → Email addresses → Read-only. No backend callback-generation defect was found.
- `python -m pytest tests/integration/test_oauth.py -q -p no:randomly` — **19 passed**, with two upstream
  deprecation warnings. No real consent, sign-in, repository import, credential exchange or provider write
  was performed.
- `backend/.env.example`, the local environment's non-secret setup comments, API_SPEC, DECISIONS and TASKS
  now record both callbacks and the Email addresses permission. Provider-side changes and a real retry
  remain with the operator, so neither live flow is claimed fixed yet.

## Verification log (2026-10-27, autonomous audit console)
- Rebuilt the audit detail as a dark emerald operations console: run-state/file/finding/runtime telemetry,
  the real primary reviewer, only actually dispatched specialist agents, investigation reads/searches/
  retries/suggestions, evidence-validation status, and a chronological terminal view of persisted worker
  checkpoints. No agents, scores, approvals or activity are fabricated.
- The application now uses the installed Geist Mono Variable font globally. The audit surface has scoped
  dark tokens so severity colors, findings, tables and existing dialogs retain their established behavior.
- `npx eslint src/pages/AuditRunDetail.jsx src/components/app/ScanProgressTrace.jsx` — clean;
  `npm run build` — succeeded (the existing large-chunk advisory remains); targeted `git diff --check` —
  clean.
- An isolated Vite server on port 5199 rendered without console errors and computed the global body font as
  Geist Mono Variable, then was stopped. The audit route redirected to sign-in because no backend/session
  was available; the in-app browser also reported a 0x0 hidden viewport. The populated audit page and its
  live interactions are therefore not claimed browser-verified.

## Verification log (2026-10-27, AI-only audits and no-source reporting)
- Root cause of the CLI tools still running: `ScanOptions` defaulted `static_analysis`, `secrets` and
  `dependencies` to `true` **and** `build_adapters()` used `.get(key, True)`, so every audit — including a
  client that sent no options — launched semgrep, bandit, gitleaks, pip-audit and trivy as required stages.
  The frontend New Audit form also switched all four on. Both backend defaults are now `false`, the form
  starts with AI review only, and the CLI rows are labelled optional. Adapters are untouched and still run
  when a caller opts in. Recorded as ADR-014, which revises ADR-001.
- `_decide()` no longer reports `ALL_SCANNERS_FAILED` for a run that asked for nothing: agent off plus no
  CLI category is now `NO_ANALYSIS_REQUESTED`.
- `NO_SOURCE` reporting: the skipped step said only "No reviewable source files". It now states whether the
  archive held no source at all or none of the candidates could be read, with the counts and the audit
  detail explaining the code in plain terms.
- Agent intake could not see whole repositories, which is what made that run look empty while a review
  should have been possible. `.md`, `.html`/`.ejs`/`.hbs`/`.pug`, `.json`, `.xml`, `.properties`, `.ps1`,
  `.proto`, `.graphql`, `.ipynb`, `.svelte`/`.astro`, Elixir/Dart/Lua/Scala/Groovy/Perl/Objective-C/Zig and
  `.env.*`, `.npmrc`, `.pypirc`, `.netrc`, `.git-credentials` are now reviewable, because the agent — not
  gitleaks or pip-audit — is the default secret and dependency reviewer. Lockfiles, minified bundles,
  generated trees and `.env.example` remain excluded.
- Backend startup: SQLAlchemy 2.1.6's compiled `_immutabledict_cy` extension is blocked by Windows
  Application Control on this machine, so `import sqlalchemy` failed before the app could load. Pinned to
  `sqlalchemy>=2.0.36,<2.1` and installed 2.0.55; the app imports and serves `/health`.
- `/health` had been widened to return the agent swarm registry. Reverted to liveness-only `{"status":"ok"}`:
  it is unauthenticated, redundant with `/api/v1/ready`, and it is what the two failing tests asserted.
- `python -m pytest -q -p no:randomly` on `tests/unit/test_agent_intake.py tests/unit/test_adapters.py
  tests/integration/test_flow.py tests/integration/test_agent_scan.py tests/unit/test_health.py` —
  **54 passed**, no failures and no skips. Includes a new `test_default_options_run_the_agent_and_no_cli_tool`
  that asserts a scan created with no options stores exactly one tool run (`agent`) and starts no adapter.
- `npx eslint src/pages/AuditRunDetail.jsx src/pages/NewScan.jsx` — clean; `npm run lint` and
  `npm run build` — succeeded.
- `ruff check app tests` still reports 9 pre-existing findings in files this change did not touch
  (`agent/code_agent.py`, `agent/dep_agent.py`, `agent/intel_agent.py`, `agent/router.py`, `main.py:109`,
  `modules/auth/routes.py`, `modules/scans/routes.py`). None come from the edited lines.
- No real AI call, upload, GitHub import or database write was made. The failed audit that prompted this
  was read from its persisted run; a fresh end-to-end audit against a live repository is not yet verified.

## Verification log (2026-10-27, hosted reviewer chain and the app footer graphic)
- The internal reviewer now has a failover chain instead of one hosted slot. All three hosted reviewers
  share one `_OpenAIChatProvider` request shape, each keeps its own credential and never borrows another's,
  links are opened lazily, and a reviewer that fails is parked for `ai_provider_cooldown_seconds` before it
  is asked again. `FallbackProvider` now wraps any primary, hosted included, and triggers on
  `AI_UNAVAILABLE`, `AI_MISCONFIGURED` and `AI_CONTEXT_OVERFLOW`. Recorded as ADR-015, which revises ADR-008
  decisions 3, 4 and 5.
- Two request bounds that did not exist before: `ai_max_output_tokens` is sent as `max_tokens` so a reply
  cannot be billed open-ended (a truncated reply raises `AI_OUTPUT_TRUNCATED` and is reported, not re-asked
  elsewhere), and `_approx_tokens` refuses an over-wide prompt with `AI_CONTEXT_OVERFLOW` (413) **before** a
  socket opens, so a guaranteed-failure call costs nothing. The audit retry loop continues past both but
  `AI_CONTEXT_OVERFLOW` is deliberately absent from `_RETRYABLE_CODES`, so the 8-attempt loop never re-fires
  a certain overflow.
- The OpenRouter probe matched models by prefix, which would have reported a paid variant as reachable when
  only the `:free` entry exists (or the reverse). It now matches the exact reported id including the suffix.
- A defect introduced by this change and caught only by the full suite: `/api/v1/ready` is typed
  `dict[str, str]`, so the integer `ai_failover_links` field failed FastAPI response serialization and made
  readiness itself the broken component. The field is removed (nothing consumed it), handover depth is
  stated as `ai_fallback` on/off, and `tests/integration/test_flow.py` now asserts every component value is
  a string so this class of breakage cannot return silently.
- Docs and console copy brought in line with the code: API_SPEC `/ready` and the AI error-code section
  (`AI_OUTPUT_TRUNCATED`, `AI_CONTEXT_OVERFLOW`), AI_ENGINE §5.1 selection/handover/provenance, TASKS Phase 4,
  the `/docs` guardrails and error tables — two of which published wrong statuses (`AI_DISABLED` 409 → 503,
  `AI_MODEL_UNAVAILABLE` 503 → 422, `AI_MISCONFIGURED` 500 → 503/502, verified against `ai/service.py` and
  `providers/ollama.py` first) — plus the audit-detail hints and the finding-detail fallback sentence.
- `python -m pytest -q -p no:randomly tests` — **345 passed**, 1 pre-existing upstream deprecation warning,
  no failures, no skips.
- `ruff check app tests` — the same 9 pre-existing findings in files this change did not touch; none on an
  edited line. `npx eslint` on every changed frontend file — clean. `npm run build` — succeeded.
- App footer graphic: the console shell now mounts `VulnixLegalGraphicBanner` through a `banner` prop on
  `VulnixFooter`, only from `components/layout/Layout.jsx`. The shared banner component is untouched and
  renders at its own size, exactly as the landing, legal, help, sign-in and docs pages already mount it.
  An intermediate version narrowed it to a bordered card; that was reverted on feedback, so the only
  remaining diff is the `{banner && <VulnixLegalGraphicBanner />}` line plus the prop.
- Not claimed verified: the console footer itself was never seen rendered. Every `/app/**` route sits behind
  `ProtectedRoute`, and minting a real session against the production identity provider is off-limits, so
  the only browser access available was public pages. `components/app/VulnixFooter.jsx` importing from
  `pages/landing/legal/` is a layering smell worth fixing if the banner is ever shared more widely.
- No real AI call, upload, GitHub import or database write was made. A scratch backend on 127.0.0.1:8124
  with its own throwaway SQLite reported `ai_hosted_primary: configured`, `ai_hosted_secondary: configured`,
  `ai_hosted_tertiary: not_configured` — the operator has a Gemini credential but no OpenRouter key yet, so
  that link is untested against a live provider. All scratch servers and that database were stopped and
  deleted.

## Verification log (2026-10-27, live-run failures, local reviewer withdrawn, console theme)
- Backend suite: `python -m pytest -q -p no:randomly tests` — **363 passed**, 1 upstream deprecation warning,
  no failures, no skips, in 651 s. Covered by this run: the crash-recording and trace-retry tests
  (`tests/unit/test_scan_recovery.py`, 6 tests), the refusal-classification and cooldown-aware retry tests
  (`tests/unit/test_ai_providers.py`, 43 tests), the catalog default-hiding tests
  (`tests/unit/test_ai_catalog.py`, 26 tests), the stale-local-selection fallback
  (`tests/unit/test_ai_service.py`) and an integration test that a crashed scan answers 202 and then reports
  `failed` / `INTERNAL_ERROR` / `completed_at` instead of a 500 and a `running` zombie
  (`tests/integration/test_flow.py`, 12 tests).
- `ruff check app tests` — 9 findings, all pre-existing at HEAD and none on an edited line
  (`agent/code_agent.py:26`, `agent/dep_agent.py:12`, `agent/intel_agent.py:135`, `agent/router.py:22,56`,
  `main.py:109`, `modules/auth/routes.py:600,602`, `modules/scans/routes.py:3`). One unused import this
  change introduced (`mark_healthy` in `tests/unit/test_ai_providers.py`) was removed; the count is back to
  the pre-existing 9.
- The local reviewer is withdrawn, not deleted (`ADR-017`). `VULNIX_AI_LOCAL_ENABLED=false` means
  `GET /api/tags` is never requested — the test asserts no `/api/tags` URL is hit — the boot default is
  `groq`, `Vulnix Edge` is out of severity routing (`info` now prefers `Vulnix Sprint`), and the unused
  duplicate severity map in `app/ai/catalog.py` (`_SEVERITY_ALIAS_ORDER` / `preferred_for_severity()`) was
  deleted so only the one the agent actually uses remains. `OllamaProvider`, `VULNIX_AI_BASE_URL`,
  `VULNIX_AI_NUM_CTX`, `VULNIX_AI_DISABLE_THINK` and the `Vulnix Edge` alias all stay, and the catalog tests
  now set the gate on explicitly, so both the shipped default and the opt-in path are covered.
- `frontend/src/pages/landing/product/AIReview.jsx` no longer advertises "Ollama (default) — fully local,
  zero egress", and its FAQ answers with reviewer failover instead of a provider list. One fabricated
  testimonial that named Ollama on the same page was rewritten vendor-free; the rest of that testimonial
  block is still fake and is still open work (task #34).
- **Open action for the operator:** `backend/.env.example` committed a real-looking OpenRouter key
  (`sk-or-v1-…`, 64 hex) at `013f96d`. It is blanked in the working tree and every tracked file was scanned
  for other credential shapes — the remaining hits are synthetic scanner fixtures — but the value is in git
  history and must be revoked or rotated at the vendor. No history rewrite was attempted and nothing was
  committed or pushed. (ADR-018)
- Audit detail page theme bug (ADR-019): `.audit-ops` in `frontend/src/index.css` declared the console token
  set dark-only and unconditionally, so the page ignored the theme control while every other `/app` page
  followed it. The palette is now light-as-base with `.dark .audit-ops` replacing it, the glow/grid/shadow
  are variables instead of literals, `color-scheme` is set per palette, and the terminal scrollbar uses
  `var(--border-strong)`. Dark values are unchanged value for value.
- How that was verified without a session: `/app/**` is behind `ProtectedRoute` and this agent has no
  credentials, so the real page could not be opened — navigating to it redirected to `/signin`. Verification
  used the built stylesheet against a scratch document reproducing the page's class structure
  (`audit-ops` → `audit-command` → `bg-card` → `bg-primary-subtle text-primary` → `audit-terminal`) and read
  computed styles in both themes. Every measured property changed with the theme — `color-scheme`, the radial
  glow, the border, `--canvas`, card background, foreground, muted text, the primary chip pair and the
  scrollbar thumb — and the list of properties that did **not** change came back empty. Dark read back the
  same values as before (`#070c0a`, `rgb(13,21,17)`, `#41e69a`); light reads `#e8f0eb`, `rgb(255,255,255)`,
  `#047857`. The scratch harness lived outside the repository and was deleted.
- Not claimed verified: the populated audit console (its real trace rows, findings table and popovers) has
  still never been seen rendered by this agent, in either theme. `npm run build` proves the rules compile and
  emit `.audit-ops` and `.dark .audit-ops`; it says nothing about whether the light console looks right at
  real data density. That check is the operator's, on their own logged-in session.
- `npx eslint` clean and `npm run build` succeeded on the changed frontend files
  (`pages/ApiDocs.jsx`, `pages/landing/product/AIReview.jsx`, `src/index.css`).

## Verification log (2026-10-27, a failed live audit read backwards)

An operator pasted a real failed run: reviewer `Vulnix Fast`, two model calls, one retry, every AI
checkpoint `failed AI_MISCONFIGURED`, three optional tools `skipped`, and an execution stream reading
`6/6 checkpoints complete · runtime 36m 39s`. Two separate things came out of it.

- The runtime is a display fault, fixed under ADR-020. `ScanProgressTrace` derived `elapsed` from a
  `now` state that only refreshes while the run is active, so for any finished run it subtracted
  `started_at` from the moment the page mounted. The number was a calendar reading, not a duration, and
  it grew the longer the audit sat in the list — it never implied the retry loop ran for 2199 seconds
  against a 900-second budget. `RunDuration` on the same page already preferred `completed_at`; the
  trace component now does the same, with the ticking clock kept for live runs.
- Contradicting evidence was in the paste all along: the six checkpoint timestamps span 15:07:18 →
  15:08:33, seventy-five seconds. The arithmetic bug was the only thing that made the run look long.
- The failure itself is real and is not yet explained, and this change does not claim to have explained
  it. `AI_MISCONFIGURED` on a per-file row can only be a non-retryable 4xx whose reason tag was absent
  or unrelated to width — 429/5xx and transport failures are classified `AI_UNAVAILABLE`, and context
  refusals are `AI_CONTEXT_OVERFLOW`. Two consecutive refusals trip `_MAX_CONSECUTIVE_FAILURES`, which
  is why the audit stopped at two files instead of walking the repository.
- What settles it is one line the operator owns: `ai_provider_refused provider=groq status=<NNN>
  reason=<TAG>` in the uvicorn console, logged at WARNING. The vendor's message body is deliberately
  never stored, never returned to a client and never written to a scan row, so the database, the API
  and this page cannot name the reason. Reading it requires that log.
- Consistent candidates, none confirmed: a request-shape refusal (the hosted payload always sends
  `response_format: {"type":"json_object"}`, `temperature: 0.1` and `max_tokens`) rejected for the model
  behind `Vulnix Fast` — that fails every file identically, which is what the trace shows; a credential
  refusal, since 401/403 land in the same bucket as a bad request; or a content filter, made likelier by
  the first file being `.env`, which `intake.is_candidate` deliberately treats as reviewable source. The
  retry count of 1 is that file's first attempt having failed retryably before the refusal arrived.
- Nothing was run against a live reviewer. A re-test spends the operator's hosted quota and writes an
  `AiUsageEvent`, so it waits for their go-ahead. The local Postgres container was unreachable
  (`docker ps` could not connect), so no read-only query of the scan row or usage events was possible.
- Verified: `npx eslint` clean on `components/app/ScanProgressTrace.jsx` and `pages/AuditRunDetail.jsx`,
  `npm run build` succeeded. No backend file changed. The corrected figure on a real finished run is not
  observed — `/app/**` needs a session this agent does not have.

## Verification log (2026-10-27, credential isolation in the catalog suite)

- Full backend suite re-run after the ADR-021 fixture fix: **363 passed, 1 warning in 666.27s**. The one
  warning is the pre-existing Starlette `testclient` deprecation notice, not a project finding.
- The thirteen failures that preceded it were a test-isolation bug, not a product bug: `Settings` reads
  `backend/.env` from the working directory, so configuring a real OpenRouter key made `_probe_openrouter()`
  run during unit tests whose fixture had never blanked that credential. The stubbed transport raised on the
  unlisted URL, which also confirms no request reached a vendor from a unit test.
- `ruff check` clean on `tests/unit/test_ai_catalog.py` and `app/ai/catalog.py`.
- Caution for the owner, recorded without the value: a pytest traceback echoed the request headers, so the
  live OpenRouter bearer token appeared in that console output and in this session's log. It is not in any
  tracked file, in `.env.example`, or in the commit described here.

## Verification log (2026-10-27, deployable on Cloudflare Pages and Render)

- Full backend suite: **375 passed, 1 warning in 633.32s**. The warning is the pre-existing Starlette
  `testclient` deprecation notice. Twelve of the new tests are this change's (CORS, S3 storage, queue wiring).
- `npx vite build` succeeded and `dist/` contains `_redirects` and `_headers` at the root, which is the
  evidence that Pages will actually read them: both files are authored in `frontend/public/`, which Vite
  copies into the output directory, and Cloudflare parses them from the output directory only.
- Preflight behaviour was observed, not assumed: an `OPTIONS /health` with a listed `Origin` answers 200 and
  carries `access-control-allow-origin`, the six allowed methods and, because `CORSMiddleware` sits inside the
  request-context middleware, also `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and
  `X-Request-ID`. An unset allowlist adds nothing to any response, so the dev proxy path is untouched. That
  assertion is now in `tests/unit/test_cors.py`.
- `render.yaml` was validated against Render's own published JSON Schema (`render.com/schema/render.yaml.json`):
  every service key, `type`, `plan`, `region` and `runtime` value, all 36 group variables and every
  `fromGroup` / `fromService` reference. Two things the schema corrected while writing it: the service type is
  `worker`, not `backgroundWorker`, and a `keyvalue` service requires `ipAllowList`, which is set to `[]`
  because nothing outside the private network should reach the queue.
- `preDeployCommand` is present but commented out. Render only allows it on a paid instance type, and a
  blueprint that fails validation blocks the whole environment, so the default shape is the one that creates;
  DEPLOYMENT.md says when to uncomment it and what to run by hand until then.
- boto3 is not installed in this venv, which is why the storage tests substitute the module rather than skip:
  the assertions are about the client configuration a real R2 bucket demands, and a skip would have meant no
  coverage of exactly the code that fails in production. `boto3>=1.34.117` is now the `s3` extra's floor, the
  release that accepts `request_checksum_calculation`.
- Two claims in the first draft of DEPLOYMENT.md were wrong and were corrected against the code: there is no
  signed download URL anywhere (an archive is read server-side by `app/scanning/pipeline.py` and by the
  reviewer path; the console sees only upload metadata), and the pooled-versus-direct Supabase advice had no
  basis in this codebase, so it now says only what is true - the API opens a connection per thread and the
  worker one per process.
- Not verified, stated plainly: no Pages project and no Render environment has been created, so the build
  settings, the prompted secret names, the queue wiring and the SPA fallback are unproven against the real
  hosts. Lint debt exists and is not this change's: `npx eslint .` reports 39 errors and 2 warnings across 14
  files, the largest being `src/pages/Landing.jsx` (16) and `src/components/app/ThreatIntelCard.jsx` (6), and
  none of those files is touched here - this change edits no `src/` file at all. `ruff check app tests` reports
  9, in `app/agent/*`, two long lines in `app/modules/auth/routes.py`, an unsorted import block in
  `app/modules/scans/routes.py`, and the deliberate `import app.agent` side-effect at `app/main.py:110`. All of
  them were already present at `854f87e`; every file this change does touch is clean under both linters.

## Verification log (2026-10-27, the CI workflow)

- `.github/workflows/ci.yml` parses, and its shape was read out of the parsed document rather than from the
  text: triggers `push`, `pull_request`, `workflow_dispatch`; `permissions: contents: read`; `concurrency`
  keyed on the ref with `cancel-in-progress`; two jobs with working directories `backend` and `frontend`,
  timeouts 30 and 15; `continue-on-error` present on exactly the two `Lint` steps and nowhere else.
- `ruff check . --output-format=github` was run for real (ruff 0.17.2) and emits `::error file=…,line=…`
  annotations, so the format is supported by the pinned `ruff>=0.7,<1.0` range and the findings will appear on
  the line in the Checks tab instead of only in a log.
- `ruff check .` over the whole `backend` directory reported **25**, and 16 of them are in
  `migrations/versions/*.py`: `I001` on Alembic's generated import block and `E501` on its long
  `sa.Column(...)` lines. Excluding that directory in `pyproject.toml` leaves **9** findings, all in authored
  application code, 6 auto-fixable. `migrations/` is excluded from lint only — `alembic upgrade head` and the
  tests that read the schema are untouched by it.
- `test -f dist/_redirects && test -f dist/_headers` passes against the local build output, which is the same
  assertion the frontend job makes after `vite build`.
- `src/lib/constants.js:33` is `import.meta.env.VITE_API_BASE_URL || '/api/v1'`, so a CI build with no
  environment variable produces a bundle that names no host. This is what makes it safe to run the frontend
  job without secrets.
- Deliberately not run locally: `npm ci`. It deletes `node_modules` before reinstalling, and the owner's dev
  server is live on `:5173` from that directory. The lockfile is committed and `npx vite build` plus
  `npx eslint .` both pass against it, but `npm ci` itself is first exercised by CI.
- Not verified, stated plainly: whether Actions is enabled for the repository was unknown when the file was
  written, and the Linux run resolves a dependency set this venv has never had. The first run then executed
  and both jobs passed - see the log below - but it did not prove the two Linux-only paths, because the suite
  does not exercise `sandbox_env()`'s non-`nt` branch at `app/scanning/adapters/base.py:134` unless a CLI tool
  is asked for, and `tests/unit/test_archive.py` asserts the archive is *rejected* before extraction, so the
  symlink it carries is never created on either platform.
- Observed afterwards, from the first real run (workflow run 40650579036, commit `1c906c3`, event `push`):
  **both jobs completed with conclusion `success`** — `Backend (ruff, pytest)` across 9 steps and
  `Frontend (eslint, build)` across 10, on `ubuntu-latest`. So Python 3.14 and Node 22 install from
  `pyproject.toml` and the lockfile on Linux, the 375-test suite is not Windows-only, `npm ci` works from the
  committed lockfile, the production build succeeds, and the `_redirects` / `_headers` assertion held. The
  two lint steps reported their findings as annotations without failing, which is the behaviour intended.
- Caution for the owner, recorded without the value: a shell command meant to list only the variable *names*
  in `backend/.env` printed the GitHub App private key body, because that value is a multi-line PEM and its
  inner lines contain no `=`. Nothing was committed, nothing left the machine, and the file stays gitignored,
  but the key should be treated as exposed to that session's transcript. Rotation is a row in TASKS.md.
