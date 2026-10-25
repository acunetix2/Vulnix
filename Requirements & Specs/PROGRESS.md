# Project Progress

**Last updated:** 2026-10-22
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

## In progress
- [ ] CI pipeline for lint and tests.
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
3. Add GitHub Actions workflow running `ruff check` and `pytest`.
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
