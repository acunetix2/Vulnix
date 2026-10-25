# Data Model

PostgreSQL is the proposed relational store. Use UUID primary keys and UTC timestamps. Add migrations for every schema change. This is a logical starting point; adapt it to the chosen auth provider.

## Entity relationships
- A user can belong to many workspaces.
- A workspace has many members and projects.
- A project has many scans.
- A scan has many tool runs and findings.
- A finding belongs to one scan; finding triage may be stored on the finding for MVP.
- Audit events belong to a workspace and optionally reference an actor/project/scan.
- A workspace has at most one integration configuration per provider (`slack`, `jira`).
- A workspace has at most one `oauth_connections` row per provider (`slack`, `jira`, `github`): who consented, to what scope, and the tokens that consent left behind.
- A workspace has many webhook endpoints.
- Every outbound event becomes one `integration_deliveries` row per matched target; the row is the queue, the retry schedule and the audit trail at the same time.
- A workspace has at most one `workspace_ai_settings` row: its chosen reviewer model.
- Every AI explanation attempt becomes one `ai_usage_events` row, attributed to a user and a workspace and bucketed by UTC day.

## Tables

### `users`
Managed by the chosen authentication provider. If mirrored locally:
- `id UUID PRIMARY KEY` — matches auth subject.
- `email TEXT UNIQUE NOT NULL`
- `display_name TEXT`
- `created_at TIMESTAMPTZ NOT NULL`
Do not store passwords if a managed auth provider handles credentials.

### `workspaces`
- `id UUID PRIMARY KEY`
- `name TEXT NOT NULL`
- `created_by UUID NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

### `workspace_members`
- `workspace_id UUID NOT NULL REFERENCES workspaces(id)`
- `user_id UUID NOT NULL`
- `role TEXT NOT NULL CHECK (role IN ('owner','admin','member','viewer'))`
- `created_at TIMESTAMPTZ NOT NULL`
- Primary key: `(workspace_id, user_id)`

### `projects`
- `id UUID PRIMARY KEY`
- `workspace_id UUID NOT NULL REFERENCES workspaces(id)`
- `name TEXT NOT NULL`
- `description TEXT`
- `source_type TEXT NOT NULL CHECK (source_type IN ('zip_upload','git_import'))`
- `default_branch TEXT`
- `created_by UUID NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`
- `archived_at TIMESTAMPTZ`
Index: `(workspace_id, updated_at DESC)`

### `uploads`
- `id UUID PRIMARY KEY`
- `project_id UUID NOT NULL REFERENCES projects(id)`
- `object_key TEXT NOT NULL UNIQUE`
- `original_filename TEXT NOT NULL` (store as display metadata only; never as a filesystem path)
- `size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0)`
- `sha256 TEXT NOT NULL`
- `status TEXT NOT NULL CHECK (status IN ('quarantined','validated','rejected','deleted'))`
- `created_by UUID NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `expires_at TIMESTAMPTZ`

### `scans`
- `id UUID PRIMARY KEY`
- `project_id UUID NOT NULL REFERENCES projects(id)`
- `upload_id UUID REFERENCES uploads(id)`
- `status TEXT NOT NULL CHECK (status IN ('queued','running','completed','completed_with_errors','failed','cancelled'))`
- `requested_by UUID NOT NULL`
- `commit_ref TEXT`
- `started_at TIMESTAMPTZ`
- `completed_at TIMESTAMPTZ`
- `error_code TEXT`
- `summary JSONB NOT NULL DEFAULT '{}'`
- `created_at TIMESTAMPTZ NOT NULL`
Indexes: `(project_id, created_at DESC)`, `(status, created_at)`

### `tool_runs`
- `id UUID PRIMARY KEY`
- `scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE`
- `tool_name TEXT NOT NULL`
- `tool_version TEXT`
- `status TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed','timed_out','skipped'))`
- `exit_code INTEGER`
- `duration_ms BIGINT`
- `finding_count INTEGER NOT NULL DEFAULT 0`
- `error_code TEXT`
- `created_at TIMESTAMPTZ NOT NULL`
- `completed_at TIMESTAMPTZ`

### `findings`
- `id UUID PRIMARY KEY`
- `scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE`
- `tool_run_id UUID REFERENCES tool_runs(id)`
- `fingerprint TEXT NOT NULL`
- `rule_id TEXT`
- `title TEXT NOT NULL`
- `category TEXT NOT NULL`
- `severity TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low','info'))`
- `confidence TEXT NOT NULL CHECK (confidence IN ('high','medium','low','unknown'))`
- `file_path TEXT`
- `start_line INTEGER`
- `end_line INTEGER`
- `evidence TEXT`
- `scanner_message TEXT`
- `impact TEXT`
- `remediation TEXT`
- `ai_explanation JSONB`
- `status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted_risk','false_positive','fixed'))`
- `triage_note TEXT`
- `triaged_by UUID`
- `triaged_at TIMESTAMPTZ`
- `created_at TIMESTAMPTZ NOT NULL`
Unique constraint: `(scan_id, fingerprint)`
`ai_explanation` stores the validated model output plus its provenance: `generated_by`, `provider`, `model`, `model_id`, `prompt_version`, `validation`, `generated_at`, `latency_ms`. `provider`/`model` record who actually replied and `model_id` the catalog entry that was asked for, so a hosted answer reached through failover cannot be attributed to the local model. It never stores a prompt, a full file, or a credential.

### `audit_events`
- `id UUID PRIMARY KEY`
- `workspace_id UUID NOT NULL REFERENCES workspaces(id)`
- `actor_id UUID`
- `action TEXT NOT NULL`
- `resource_type TEXT NOT NULL`
- `resource_id UUID`
- `metadata JSONB NOT NULL DEFAULT '{}'`
- `created_at TIMESTAMPTZ NOT NULL`
Metadata must not contain source code, secrets, tokens, or full prompts.

### `integration_configs`
- `id UUID PRIMARY KEY`
- `workspace_id UUID NOT NULL REFERENCES workspaces(id)`
- `provider TEXT NOT NULL` — `slack` or `jira`
- `enabled BOOLEAN NOT NULL DEFAULT false`
- `config JSONB NOT NULL DEFAULT '{}'` — non-secret settings only: channel name, mention group, Jira base URL, project key, account email, issue type, priority, severity floor
- `secret_enc TEXT` — Fernet ciphertext of the credential
- `secret_hint VARCHAR(16)` — last four characters, safe to display
- `created_at` / `updated_at TIMESTAMPTZ NOT NULL`
Unique constraint: `(workspace_id, provider)`
The plaintext credential never exists in a column, a response, or a log. A workspace with `secret_enc` set but no decryption key available for it fails as `DECRYPT_FAILED` and must be re-entered.
Where an `oauth_connections` row exists for the same provider, its token is used and `secret_enc` stays empty: the row is the fallback for deployments where the provider cannot do a consent window (a self-hosted Jira, say).

### `oauth_connections`
What a completed consent window left behind. Kept separate from `integration_configs` because the two facts change on different schedules: who approved, to what scope and until when belongs to the account, while where to post a message belongs to the configuration.
- `id UUID PRIMARY KEY`
- `workspace_id UUID NOT NULL REFERENCES workspaces(id)`
- `provider TEXT NOT NULL` — `slack`, `jira`, or `github`
- `account_label VARCHAR(160) NOT NULL` — the login, workspace or site name the provider answered with, so a wrong account is visible in the console. Never a secret.
- `scope VARCHAR(512) NOT NULL DEFAULT ''` — the scope the provider actually granted
- `access_expires_at TIMESTAMPTZ` — null when the token does not expire (a Slack bot token, a GitHub OAuth token)
- `access_enc TEXT` / `refresh_enc TEXT` — Fernet ciphertext. A refresh token is present only where the provider issues one (Jira with `offline_access`).
- `details JSONB NOT NULL DEFAULT '{}'` — provider-owned, non-secret facts: Jira site ids and URLs, the Slack team id, the GitHub repositories this workspace selected. Never a token and never a client secret.
- `connected_by UUID NOT NULL`
- `created_at` / `updated_at TIMESTAMPTZ NOT NULL`
Unique constraint: `(workspace_id, provider)`
Deleting the row is the only way to disconnect, and it clears any `secret_enc` beside it, so a revoked consent cannot keep delivering through a leftover hand-pasted credential. An expired connection with no refresh token is reported as `OAUTH_CONNECTION_EXPIRED` and asked to be redone rather than retried forever.

### `webhook_endpoints`
- `id UUID PRIMARY KEY`
- `workspace_id UUID NOT NULL REFERENCES workspaces(id)`
- `name VARCHAR(120) NOT NULL`
- `url VARCHAR(1024) NOT NULL` — normalized HTTPS URL; re-validated and re-resolved before every request
- `events JSONB NOT NULL DEFAULT '[]'` — subset of the published event types, or `["*"]`
- `secret_enc TEXT` / `secret_hint VARCHAR(16)` — the signing key is generated by Vulnix when the endpoint is created and is returned once; rotation replaces it and returns the new value once. A caller may still supply its own.
- `enabled BOOLEAN NOT NULL DEFAULT true`
- `created_by UUID NOT NULL`
- `created_at` / `updated_at TIMESTAMPTZ NOT NULL`

### `integration_deliveries`
An outbox row: one per (event, target). Written in the same transaction as the event, drained by the delivery worker.
- `id UUID PRIMARY KEY`
- `workspace_id UUID NOT NULL REFERENCES workspaces(id)`
- `channel TEXT NOT NULL` — `slack`, `jira`, or `webhook`
- `target_id UUID` — the configuration or endpoint this attempt was queued for
- `target_label VARCHAR(255) NOT NULL` — display-safe description (`#security`, `SEC @ jira.example.com`, target host); never a token or a full URL
- `event_type VARCHAR(64) NOT NULL`
- `resource_type VARCHAR(32) NOT NULL` / `resource_id UUID`
- `payload JSONB NOT NULL DEFAULT '{}'` — redacted snapshot taken when the event was accepted, so a later edit to the finding cannot change an already-queued message
- `status TEXT NOT NULL` — `pending`, `succeeded`, `failed`, `dead`
- `attempts INTEGER NOT NULL DEFAULT 0`
- `next_attempt_at TIMESTAMPTZ NOT NULL`
- `last_error_code VARCHAR(64)` / `http_status INTEGER`
- `completed_at TIMESTAMPTZ`
Indexes: `(status, next_attempt_at)` for the retry sweep, `(workspace_id, created_at)` for the log.
`failed` means a retry is scheduled with exponential backoff; `dead` means the attempt budget ran out or the failure was terminal, and only an explicit redelivery requeues it. Deleting a target does not delete its delivery history.

### `workspace_ai_settings`
One row per workspace: the reviewer model its members chose.
- `workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE`
- `model_id VARCHAR(160) NOT NULL` — a catalog entry id (`provider:model`), never a bare model name
- `updated_by UUID`
- `updated_at TIMESTAMPTZ NOT NULL`
The stored id is re-validated against the live catalog on every read and every call, so a preference that stops being reachable falls back to the server default instead of failing the request.

### `ai_usage_events`
One row per explanation attempt, and the only credit source.
- `id UUID PRIMARY KEY`
- `workspace_id UUID REFERENCES workspaces(id)`
- `user_id UUID NOT NULL`
- `finding_id UUID`
- `provider VARCHAR(32) NOT NULL` / `model VARCHAR(160) NOT NULL` — who answered, which may differ from the entry that was asked for after a failover
- `day VARCHAR(10) NOT NULL` — UTC calendar day as `YYYY-MM-DD`, the credit bucket
- `status TEXT NOT NULL CHECK (status IN ('succeeded','failed'))`
- `error_code VARCHAR(64)`
- `prompt_tokens INTEGER` / `completion_tokens INTEGER` / `latency_ms BIGINT`
Indexes: `(user_id, day)` for the per-user quota and personal heatmap, `(workspace_id, day)` for the workspace view.
`day` is denormalized so daily aggregation behaves identically on SQLite and PostgreSQL. The table holds counters and identifiers only — never a prompt, snippet, or model output — which is what makes it safe to read a year of rows back in one query. A failed attempt is recorded but not credited: `status='failed'` consumes quota without earning a credit, so a broken provider cannot be farmed for usage.

## Data rules
- All reads and writes must be authorized against workspace membership.
- Avoid cascading deletion of audit records unless a documented retention policy requires it.
- Store only the minimum source evidence needed to explain a finding.
- Use a fingerprint based on stable rule/tool/path/location characteristics, not raw secret values.
- Add indexes after reviewing real query plans.
- Define retention and hard-delete behavior before production.
- Integration payloads may carry identifiers, severities and counters only. Source paths, evidence snippets, file contents and credentials must not enter `integration_deliveries.payload` or any outbound body.
- An outbound URL supplied by a user is data, not a location to fetch blindly: normalize it, resolve it, and refuse private, loopback, link-local, multicast, reserved, CGNAT and metadata addresses at request time.
- Delivery state is authoritative in the database, not in the worker process, so a crashed worker can lose a row but never skip one permanently.
- AI quota and AI credit history read from the same `ai_usage_events` rows. No process-local counter may decide either, so a restart cannot hand out a fresh allowance and the number a user sees today is the number they earned.
