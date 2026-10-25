# API Specification

**Base path:** `/api/v1`  
**Format:** JSON unless downloading a report.  
**Authentication:** bearer/session token from the chosen auth provider.  
**Status:** proposed contract; update alongside implementation.

## Conventions
- IDs are UUID strings.
- Timestamps are UTC ISO 8601.
- All endpoints require authentication except health/readiness endpoints.
- Every resource lookup must enforce workspace membership and role permissions.
- Paginated lists use `limit` (default 20, max 100) and `cursor` where appropriate.
- Never return raw stack traces, secrets, full source files, or internal object-storage credentials.

## Common error response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request could not be validated.",
    "request_id": "uuid",
    "details": []
  }
}
```

## Endpoints

### Health
- `GET /health` — liveness check; no sensitive operational detail.
- `GET /ready` — readiness check for required dependencies. Reports each component as `enabled` or `disabled`; `integrations` reflects whether outbound delivery is switched on and able to store credentials. `ai` reflects the local provider, `ai_fallback` whether failover is armed, and `ai_groq` only the *presence* of a Groq credential — which models that credential can reach is decided per request by the catalog, never asserted here.

### Auth and account
- `GET /auth/me` — the verified identity: id, email, display name, creation date, and the workspaces this user belongs to with their role. Roles are read from membership rows, never from a client claim.
- `PATCH /auth/me` — rename the account. Body `{"display_name": "…"}`, 1–120 characters after trimming; a blank or spaces-only name is `422`. Writes the local profile row only.
- `PUT /auth/password` — rotate the credential through the identity provider using the bearer token on this request. Vulnix does not store or log the password. Rate limited per user; `502` when the provider cannot be reached and its status sanitized otherwise.
- Email and sign-in method are read-only here — changing them happens in the provider. See ADR-009.

### Workspaces
- `GET /workspaces` — workspaces accessible to current user.
- `POST /workspaces` — create workspace.
- `GET /workspaces/{workspace_id}` — workspace details.
- `PATCH /workspaces/{workspace_id}` — update workspace name; owner/admin only.

### Projects
- `GET /workspaces/{workspace_id}/projects?limit=20&cursor=...`
- `POST /workspaces/{workspace_id}/projects`
  ```json
  {"name":"Payment API","description":"Optional project description","source_type":"zip_upload"}
  ```
- `GET /projects/{project_id}`
- `PATCH /projects/{project_id}` — update name/description.
- `DELETE /projects/{project_id}` — archive project, not immediate hard delete.

### Uploads
- `POST /projects/{project_id}/uploads`
  - Create a constrained upload session or accept multipart upload.
  - Validate content length, allowed archive type, quota, and project access.
  - Response:
  ```json
  {"id":"uuid","status":"quarantined","upload_url":null,"expires_at":"2026-10-19T00:00:00Z"}
  ```
- `GET /uploads/{upload_id}` — status and safe metadata.
- `DELETE /uploads/{upload_id}` — request deletion if not used by an active scan.
- `POST /projects/{project_id}/uploads/github` — fetch a selected repository's archive into quarantine. Requires the `member` role, a `github` connection (see OAuth below) and `409 OAUTH_NOT_CONNECTED` without one.
  ```json
  {"repo_id": 1234567890, "ref": "release/2.4"}
  ```
  `repo_id` must be one of the repositories this workspace stored through the selection endpoint, or `422 GITHUB_REPO_NOT_SELECTED`; there is no URL or clone target in this body. `ref` is optional and defaults to the repository's own default branch, and is rejected as `422 GITHUB_REF_INVALID` before any connection is opened if it is not a plain branch, tag or commit name. The response is the same `Upload` object as a multipart upload, `status: quarantined`, and a scan is created from its `upload_id` exactly the same way. Size, quota, magic-number and archive-entry checks are identical to the upload path; nothing is cloned or executed.

### Scans
- `POST /projects/{project_id}/scans`
  ```json
  {"upload_id":"uuid","options":{"static_analysis":true,"secrets":true,"dependencies":true}}
  ```
  Response `202 Accepted`:
  ```json
  {"id":"uuid","status":"queued","created_at":"2026-10-18T18:00:00Z"}
  ```
- `GET /projects/{project_id}/scans?limit=20&cursor=...`
- `GET /scans/{scan_id}` — status, summary, tool-run status.
  - `summary.agent` describes the agent-first review. Alongside file, finding, call, retry and suggestion
    counts, `investigations`, `follow_ups`, `context_reads`, `searches` and `investigation_failures`
    record cross-file investigation activity. `prompt_version` identifies the review protocol. Agent
    coverage and investigation budgets are optional: their `VULNIX_AGENT_*` settings default to `0`
    (unlimited), while a positive value caps that dimension. The scan deadline and AI quota still apply.
  - Investigation uses only server-mediated `read_file` and literal `search` actions over the validated
    source-file manifest. Search hits are leads, not citable evidence. Findings are accepted only when
    their exact path and line range were visible to the last successful model answer; unsupported or
    unlocatable findings increment `dropped_findings` instead of being stored.
  - A failed follow-up increments `investigation_failures` and preserves the last supported review. It
    does not discard initial findings or turn an otherwise successful audit into a failed one.
- `POST /scans/{scan_id}/cancel` — cancel queued/running scan where supported.
- `GET /scans/{scan_id}/findings?severity=high&status=open&category=secrets&limit=50`
- `GET /scans/{scan_id}/report?format=markdown|json` — authorized report download.

### Findings
- `GET /findings/{finding_id}` — full finding details.
- `PATCH /findings/{finding_id}`
  ```json
  {"status":"false_positive","triage_note":"Reviewed with the team"}
  ```
- `POST /findings/{finding_id}/explanation`
  - Generate or refresh an AI explanation based on minimized, redacted evidence.
  - Uses the workspace's selected model; requires the workspace `member` role.
  - Rate limited; return `429` when the per-minute limit or the daily credit quota is exceeded.
  - Every attempt is recorded as one usage event. A failed call counts against quota but is never credited.
  - Response:
  ```json
  {
    "finding_id":"uuid",
    "generated_by":"ai",
    "provider":"groq",
    "model":"qwen/qwen3.8-27b",
    "model_id":"ollama:qwen3.5:4b",
    "generated_at":"2026-10-22T10:56:49Z",
    "summary":"Potential unsafe query construction.",
    "impact":"An attacker may influence query behavior if the input is untrusted.",
    "remediation_steps":["Use parameterized queries.","Validate input according to business rules."],
    "verification_steps":["Re-scan the project and confirm the rule no longer matches."],
    "confidence":"medium",
    "limitations":"Review the surrounding code and confirm data flow.",
    "evidence_refs":["svc/client.py:12"]
  }
  ```
  `model` and `provider` name the model that actually replied; `model_id` is the catalog entry that was asked for. When a local primary falls through to a hosted one these disagree, and clients must present the answering pair as the fact.

### AI
Model names are never taken from a client. The catalog is built by asking each configured provider what it can serve right now, so a caller may only choose an entry id that this endpoint returned. Reads require `viewer`; selecting a model requires `member`; the workspace-wide usage view requires `admin`.

- `GET /workspaces/{workspace_id}/ai/models` — selectable entries, cheapest source first.
  ```json
  [
    {
      "id": "ollama:qwen3.5:4b",
      "provider": "ollama",
      "model": "qwen3.5:4b",
      "label": "Qwen 3.5 4B (local)",
      "note": "Runs on the Vulnix host. Nothing leaves the machine.",
      "source": "local"
    }
  ]
  ```
  An empty list means no provider answered, not that AI is disabled — the response never asserts a model that was not reported.
- `GET /workspaces/{workspace_id}/ai/settings` — selection plus the caller's quota state.
  ```json
  {
    "enabled": true,
    "selected": "groq:qwen/qwen3.8-27b",
    "default": "ollama:qwen3.5:4b",
    "models": [],
    "daily_quota": 100,
    "used_today": 5
  }
  ```
  `selected` falls back to `default` when a stored preference stops being offered (a model un-pulled locally, or a key that no longer reaches it).
- `PUT /workspaces/{workspace_id}/ai/settings`
  ```json
  {"model_id": "groq:qwen/qwen3.8-27b"}
  ```
  Returns the same body as `GET`. A bare model name, an unknown provider, or an id outside the current catalog is refused with `AI_MODEL_UNAVAILABLE` (422); the id is re-validated on every call, not only on write. Selecting a model writes an audit event carrying provider and model identity only.
- `GET /workspaces/{workspace_id}/ai/usage?days=365&scope=user|workspace` — the credit history.
  ```json
  {
    "scope": "user",
    "since_day": "2025-10-23",
    "until_day": "2026-10-22",
    "total_credits": 5,
    "days": [{"day": "2026-10-22", "credits": 5, "prompt_tokens": 1800, "completion_tokens": 620}]
  }
  ```
  `days` is 1–370. One successful explanation is one credit. The list is sparse and oldest-first: a day appears only if it has at least one credited call, so a heatmap or similar view fills the gap days with zero itself. `scope=workspace` needs `admin` and counts every member's calls; `scope=user` is always the caller's own. `days` bounds the window, `since_day`/`until_day` are the inclusive UTC range actually applied.

### Integrations
Reads require the workspace `viewer` role; every write, test and redelivery requires `admin`. Credentials are write-only: no response ever returns a stored secret, only `configured` plus a masked `secret_hint`. `configured` is true when either a hand-stored credential or a consent connection exists, and `connected` reports which.

- `GET /workspaces/{workspace_id}/integrations` — provider configurations that exist for this workspace.
  ```json
  [
    {
      "provider": "slack",
      "enabled": true,
      "configured": true,
      "secret_hint": "...7f3a",
      "config": {"channel": "security", "mention_group": "@security-team", "notify_triage": false},
      "updated_at": "2026-10-18T18:00:00Z"
    }
  ]
  ```
- `GET /workspaces/{workspace_id}/integrations/{provider}` — `slack` or `jira`; `404` with `INTEGRATION_NOT_CONFIGURED` when absent.
- `PUT /workspaces/{workspace_id}/integrations/{provider}` — upsert. Omit `secret` to keep the stored credential; `clear_secret: true` deletes it.
  ```json
  {
    "enabled": true,
    "secret": "xoxb-...",
    "clear_secret": false,
    "channel": "#security",
    "mention_group": "@security-team",
    "notify_triage": false,
    "base_url": "https://company.atlassian.net",
    "project_key": "SEC",
    "user_email": "vulnix-bot@company.com",
    "auto_create": true,
    "min_severity": "high",
    "issue_type": "Task",
    "priority": "High"
  }
  ```
  Slack requires `channel`. Jira requires `base_url`, `project_key` and `user_email`, and `base_url` must be HTTPS on port 443 or 8443 without credentials. `secret` is 8–4096 characters.
  When a consent connection exists for the provider, `secret` may be omitted entirely and `user_email` is not required — the token came from the provider, not from the form. For a connected Jira, `base_url` must be one of the site URLs that connection was granted, or `403 JIRA_SITE_NOT_GRANTED`. A write that carries no secret needs only the encryption key, so it works while outbound delivery is switched off; choosing where to post sends nothing.
- `DELETE /workspaces/{workspace_id}/integrations/{provider}` — removes the configuration and its encrypted credential.
- `POST /workspaces/{workspace_id}/integrations/{provider}/test` — sends one probe through the normal delivery pipeline so it is recorded in the log. A Jira test checks credentials only and never creates an issue.
  ```json
  {"delivery": {"id":"uuid","status":"succeeded","attempts":1,"last_error_code":null}, "ok": true}
  ```
- `GET /workspaces/{workspace_id}/integrations/deliveries?channel=slack|jira|webhook&status=pending|succeeded|failed|dead&limit=25&cursor=...` — the outbox log, newest first.
- `POST /workspaces/{workspace_id}/integrations/deliveries/{delivery_id}/redeliver` — requeue a failed or dead-letter delivery.

### OAuth connections
The consent window described in ADR-010. Reads need `viewer`, every connect and disconnect needs `admin`. No endpoint here accepts a token, a client secret or a code: those cross the boundary between this server and the provider only.

- `GET /workspaces/{workspace_id}/integrations/providers` — what this server can actually do, so the console never renders a dead button.
  ```json
  [
    {
      "provider": "github",
      "oauth_available": true,
      "reason": "",
      "redirect_uri": "https://vulnix.example.com/api/v1/integrations/oauth/github/callback",
      "scopes": [],
      "connected": true,
      "account_label": "acme-octocat"
    }
  ]
  ```
  `reason` is `OAUTH_APP_NOT_CONFIGURED` when the environment has no client id and secret for that provider, or `OAUTH_REDIRECT_NOT_CONFIGURED` when `VULNIX_OAUTH_REDIRECT_BASE_URL` is unset. `redirect_uri` is the value the operator must register as the app's callback; it is built here and never read from a request. `scopes` is empty for GitHub by design: the credential is a **GitHub App**, which takes its permissions from the app's own settings (Contents and Metadata read-only today; Pull requests read-write once the agent opens fix PRs) rather than from a scope in the authorize URL, so the URL carries no `scope` parameter at all. When the same app serves Supabase sign-in, its Account permissions must also grant Email addresses read-only, and both this integration callback and `{supabase_url}/auth/v1/callback` must be registered as separate GitHub App callback URLs.
- `POST /workspaces/{workspace_id}/integrations/{provider}/connect` — returns the provider's own authorize URL plus a signed, expiring state. Nothing is stored and nothing is sent. `412` with the reason above when the app is not configured; rate-limited per user.
  ```json
  {"provider":"slack","authorize_url":"https://slack.com/oauth/v2/authorize?client_id=...&state=...","redirect_uri":"https://vulnix.example.com/api/v1/integrations/oauth/slack/callback","scopes":["chat:write","channels:read"],"expires_in":600}
  ```
- `GET /integrations/oauth/{provider}/callback?code=...&state=...` — the provider's redirect, reached by the browser and never by the console. Unauthenticated by nature: the signed state is the only authority it has, and it must name this same provider. Success stores the sealed tokens and `302`s to `{console_base_url}/app/integrations/{provider}?connected=1`; any failure `302`s to the same page with `oauth_error=<code>` and stores nothing. A code the provider will not exchange, a forged or expired state, and a state whose nonce is already spent all land in that second branch.
- `GET /workspaces/{workspace_id}/integrations/connections` — every live connection with its `account_label`, granted `scope` and expiry. Never a token, and never a hint of one.
- `DELETE /workspaces/{workspace_id}/integrations/{provider}/connection` — `204`. Revokes locally and clears any hand-stored credential for the same provider, because a revoked consent must not keep delivering. Revoking at the provider itself is done in that provider's own UI.
- `GET /workspaces/{workspace_id}/integrations/slack/channels` — the channels the bot can see, from Slack. `409 OAUTH_NOT_CONNECTED` without a connection.
- `GET /workspaces/{workspace_id}/integrations/jira/setup?site_id=...` — the sites this consent covers, and the projects inside one of them. `site_id` selects from the provider's list and nothing else: an unknown id is `403 JIRA_SITE_NOT_GRANTED`, and the site URL used for the project call is the provider's own rather than anything the client named.
- `GET /workspaces/{workspace_id}/integrations/github/repositories?page=1` — the repositories the consent can read, each tagged `selected` when it is in this workspace's stored allowlist. Read through the GitHub App's own installations (`/user/installations`, then `/user/installations/{id}/repositories`) rather than through the user's account, because an app can only read where it was installed; the wider listing would offer repositories whose archive fetch is then answered `404`. Installations are walked as one continuous list, so paging still reaches every account the workspace granted. An app that has not been installed anywhere lists nothing.
- `PUT /workspaces/{workspace_id}/integrations/github/repositories` — `{"repo_ids":[123,456]}`. Every id is re-read from GitHub's own listing before it is kept, so the selection can only ever narrow what the consent already allows; an id that is not there is `422 GITHUB_REPO_NOT_AVAILABLE`. The stored list is the only source a repository import may name.

A token that has run out is renewed silently when the provider issued a refresh token; otherwise the call reports `409 OAUTH_CONNECTION_EXPIRED` and the connection must be redone. A GitHub App user token lasts eight hours and always rotates, so this renewal is the normal path there rather than an edge case: with "Expire user authorization tokens" enabled on the app, a connection survives overnight without a fresh consent. Tokens that cannot be decrypted under the current `VULNIX_INTEGRATION_SECRET_KEY` report `409 OAUTH_TOKEN_UNREADABLE`, which is an operator problem and not something the console can fix.

### Webhooks
- `GET /workspaces/{workspace_id}/webhooks`
- `POST /workspaces/{workspace_id}/webhooks`
  ```json
  {
    "name": "Security desk inbox",
    "url": "https://desk.example.com/vulnix",
    "events": ["scan.completed", "finding.triaged"],
    "secret": "at-least-8-characters",
    "enabled": true
  }
  ```
  `events` accepts `scan.completed`, `scan.failed`, `finding.triaged`, `integration.test` or `*` (all of them), 1–8 entries. `url` is normalized: HTTPS only, ports 443/8443, no credentials, and an address that resolves to a private, loopback, link-local, multicast, reserved or metadata range is refused with `TARGET_BLOCKED`.
  `secret` is optional: when it is omitted Vulnix generates one. The create response is the only place it ever appears, as `{"secret":"whsec_..."}` alongside the normal endpoint fields, so the console can show it once and then never again. Every later read returns `configured` and a masked hint only.
- `PATCH /workspaces/{workspace_id}/webhooks/{webhook_id}` — partial update; `clear_secret: true` deletes the signing secret.
- `POST /workspaces/{workspace_id}/webhooks/{webhook_id}/rotate-secret` — replaces the signing key and returns the new one once, in the same shape as the create response. Deliveries already queued keep the signature they were sent with.
- `DELETE /workspaces/{workspace_id}/webhooks/{webhook_id}`
- `POST /workspaces/{workspace_id}/webhooks/{webhook_id}/test` — delivers one `integration.test` event.

Webhook delivery is a JSON POST with `x-vulnix-event`, `x-vulnix-delivery`, `x-vulnix-timestamp` and, when a signing secret is set, `x-vulnix-signature: v1=<hmac-sha256 of the raw body>`. Redirects are never followed, the response body is capped, requests time out, and neither URL query strings nor payloads are logged.

Events are built from identifiers and counters only. Free text that originates from a project name, finding title or scanner output is whitespace-normalized, secret-redacted and truncated to 300 characters before it is queued.

### Audit
- `GET /workspaces/{workspace_id}/audit-events?limit=50&cursor=...` — owner/admin only.

## Status codes
- `200` successful read/update.
- `201` resource created synchronously.
- `202` asynchronous work accepted.
- `204` successful deletion/cancellation with no response body.
- `400` malformed request.
- `401` unauthenticated.
- `403` authenticated but unauthorized.
- `404` resource missing or intentionally hidden due to access policy.
- `409` state conflict or idempotency conflict.
- `413` upload too large.
- `415` unsupported upload format.
- `422` valid JSON with invalid semantic fields.
- `429` rate/quota limit.
- `500` unexpected server error; no stack trace.
- `503` dependency unavailable.

## Integration error codes
API refusals use the common error envelope:
`INTEGRATIONS_DISABLED` (409), `INTEGRATION_KEY_MISSING` (503), `INTEGRATION_NOT_CONFIGURED` (404 read, 409 test), `INTEGRATION_CONFIG_INCOMPLETE` (422), `INVALID_WEBHOOK_URL` (422), `UNKNOWN_EVENT_TYPE` (422), `VALIDATION_ERROR` (422).

Consent refusals also use the envelope, and the callback reports them to the browser as an `oauth_error` query parameter rather than a body:
`OAUTH_APP_NOT_CONFIGURED` (412, the environment has no client id and secret for this provider), `OAUTH_REDIRECT_NOT_CONFIGURED` (412, no public callback origin), `OAUTH_STATE_INVALID` (400, forged, spent, or naming another provider), `OAUTH_STATE_EXPIRED` (400), `OAUTH_CODE_MISSING` (400, the provider returned no approval), `OAUTH_REJECTED` (400, the provider refused the exchange), `OAUTH_BAD_RESPONSE` (502), `OAUTH_TIMEOUT` / `OAUTH_UNREACHABLE` (502), `OAUTH_RESOURCE_UNAVAILABLE` (502, a provider resource read failed), `RATE_LIMITED` (429, too many connect or callback attempts), `OAUTH_NOT_CONNECTED` (409, the provider data was asked for before any consent), `OAUTH_TOKEN_UNREADABLE` / `OAUTH_CONNECTION_EXPIRED` (409, reconnect), `OAUTH_TOKEN_REVOKED` (401, revoked at the provider), `JIRA_SITE_NOT_GRANTED` (403), `GITHUB_REPO_NOT_AVAILABLE` (404 or 422), `GITHUB_REPO_NOT_SELECTED` / `GITHUB_REPO_INVALID` / `GITHUB_REF_INVALID` (422), `UNSUPPORTED_FORMAT` (415, the archive fetched was not a ZIP).

Delivery failures are stored on the delivery row in `last_error_code` rather than returned to a caller:
`TARGET_BLOCKED` (address resolved to an internal range), `TARGET_UNREACHABLE`, `TARGET_TIMEOUT`, `REDIRECT_REFUSED`, `PAYLOAD_TOO_LARGE`, `DECRYPT_FAILED`, `CONFIG_INCOMPLETE`, `TARGET_MISSING`, `HTTP_<status>`, `TARGET_SERVER_ERROR`, and provider-derived codes such as `SLACK_CHANNEL_NOT_FOUND` (sanitized from the untrusted provider response). Retried codes: `TARGET_SERVER_ERROR`, `TARGET_UNREACHABLE`, `TARGET_TIMEOUT`, `SLACK_RATE_LIMITED`. Everything else is terminal and parks the delivery as a dead letter.

## AI error codes
`AI_DISABLED` (503, no provider reachable or AI switched off), `AI_MODEL_UNAVAILABLE` (422, an entry id outside the live catalog), `AI_UNAVAILABLE` (503, transport failure — the provider's own error text is never passed through), `AI_MISCONFIGURED` (503, a required base URL or credential is missing), `AI_INVALID_OUTPUT` (502, the reply was not parseable, not an object, failed schema validation, or referenced a different finding), `QUOTA_EXCEEDED` (429, per-minute limit or daily credit quota).

Only `AI_UNAVAILABLE` and `AI_MISCONFIGURED` can trigger a hosted failover. A malformed or schema-invalid reply is a model-quality problem and is reported as such rather than silently retried against another provider.

## Security requirements

- Validate request bodies and query parameters.
- Use idempotency keys for scan creation where practical.
- Apply rate limits per user/workspace/IP.
- Prevent insecure direct object references by authorizing every resource.
- Avoid reflecting untrusted values into HTML.
- Do not allow arbitrary scanner names, executable paths, CLI arguments, or AI model names from clients.
- Never return a stored integration credential, in whole or in part beyond the masked hint.
- Treat every client-supplied outbound URL as untrusted: normalize it, resolve it, and refuse internal addresses before sending. Egress stays disabled by default and is opt-in per deployment.
