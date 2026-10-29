# Deployment

How Vulnix runs outside a laptop. Two hosts and two managed services:

| Piece | Where | Why there |
| --- | --- | --- |
| Console (React SPA) | Cloudflare Pages | Static build output, global CDN, no server to run |
| API | Render web service | Long-lived Python process with a health check |
| Audit worker + queue sweeper | Render background workers | An audit outlives a web request (ADR-024) |
| Queue and result store | Render Key Value (Redis) | Same private network as the services above |
| Database | Supabase Postgres (existing project) | Already holds the data; migrations own its schema |
| Sign-in and tokens | Supabase Auth | The API verifies its JWTs, it does not issue them |
| Quarantined archives, avatars | Cloudflare R2 | Rebuilt filesystems cannot hold them (ADR-023) |

Secrets are only ever pasted into a host's environment settings. Nothing here, and
no file in this repository, holds one. `Requirements & Specs/DECISIONS.md` records why
each choice is what it is; this file is the runbook.

## Before the first deploy

1. **Supabase project** - note its region, its Project URL, the `anon` key, the
   service role key, and the JWT signing key / JWKS URL. For the connection string,
   use the pooled one: the API opens a connection per request thread and a worker per
   process, so direct connections reach the project's ceiling quickly. Alembic runs
   over either.
2. **R2 bucket** - one private bucket, e.g. `vulnix-quarantine`. Create an API token
   scoped to that bucket with `Object Read & Write`. Its endpoint is
   `https://<account-id>.r2.cloudflarestorage.com`. Nothing in this bucket is ever
   handed to a browser: an archive is read server-side, by the audit pipeline and by
   the reviewer path, and the console only ever sees an upload's metadata.
3. **Render** - the repo connected once. `render.yaml` at the repository root defines
   the four services; Blueprint creation prompts for every variable marked
   `sync: false`.
4. **Reviewer credentials** - at least one hosted reviewer key, otherwise AI
   explanation and the agent's review pass have nothing to call.

Pick one Render region and keep every service in it. Put it near the Supabase
project: database latency is paid on every request, and a cross-region queue is paid
on every step of an audit.

## Backend on Render

Create the environment from the Blueprint (`render.yaml`), then fill the prompted
values. The ones people get wrong:

| Variable | Must be |
| --- | --- |
| `VULNIX_APP_ENV` | `production` - with it, `VULNIX_AUTH_DISABLED=true` is refused at startup |
| `VULNIX_DATABASE_URL` | `postgresql+psycopg://...` - the driver extra is installed by the build |
| `VULNIX_DB_AUTO_CREATE` | `false` - the schema comes from `migrations/`, not from first traffic |
| `VULNIX_CELERY_BROKER_URL` | wired automatically to the Redis service; leave the blueprint in charge |
| `VULNIX_CELERY_EAGER` | `false` - the blueprint sets it; if it is ever `true` the API runs audits in-request again |
| `VULNIX_STORAGE_BACKEND` | `s3`, with the R2 endpoint, bucket and token |
| `VULNIX_S3_REGION` | `auto` (the default) unless the bucket is real Amazon S3 |
| `VULNIX_CORS_ALLOW_ORIGINS` | the console's origin, exact, no trailing slash |
| `VULNIX_CONSOLE_BASE_URL` | the same console origin - where an OAuth callback lands |
| `VULNIX_OAUTH_REDIRECT_BASE_URL` | this API's own origin, which is what each provider must allow |

Order matters on the first run, because two hostnames do not exist until something is
deployed: the API's `*-onrender.com` address and the console's Pages URL. Deploy the
blueprint, deploy the console, then go back and set `VULNIX_CORS_ALLOW_ORIGINS` to the
console origin, `VULNIX_CONSOLE_BASE_URL` to the same, `VULNIX_OAUTH_REDIRECT_BASE_URL`
to the API origin, and each provider's allowed redirect to
`{api-origin}/api/v1/integrations/oauth/{provider}/callback`.

**Migrations.** `render.yaml` carries a commented `preDeployCommand: alembic upgrade
head` for the API service. Render only allows a pre-deploy command on a paid instance
type, so uncomment it when the plan says so and it will run after the build and before
the new instance takes traffic. Until then, open the API service's Shell and run
`alembic upgrade head` after each deploy that changes `migrations/`. Never from both
places at once, and never from the worker.

**Check it.** `GET /health` answers liveness and is what Render polls. `GET
/api/v1/ready` reports on the dependencies. A `404` on `/v1/models` is not Vulnix:
nothing in this product serves that path.

## Three processes, one set of variables

The API, the audit worker and the scheduler are separate Render services built from the same
code, and each reads its own environment. A variable that exists on one does not exist on the
next, and a process with a blank value does not say so - it behaves as if the feature were
turned off, which reads as a bug in whatever the blank value was supposed to power.

Every credential in `render.yaml` is marked `sync: false` and carries no value in the repo, so
the env group is the only place they exist. **A hand-created service that is not attached to
the `vulnix-backend` group starts with all of them blank**, and that is the single most common
way to build a worker that looks healthy and fails every audit. The API in the current
deployment was created in the dashboard rather than from the blueprint, so if its variables
were typed onto that service instead of bound through the group, a second service inherits none
of them, and copying one at a time is how a service ends up with the database, the queue and
the bucket but no reviewer key. Binding all three services to one group is the fix; a list of
variables to keep in sync by hand is not.

The other thing a hand-created service gets wrong by leaving a variable out is the queue
switch. `VULNIX_CELERY_EAGER` is **`true` in the code and in `.env.example`**, and the `false`
that makes a worker the thing that runs audits exists only in this blueprint's env group. An
API that never received the variable therefore runs the whole audit inside the request that
asked for it - so audits appear to work, produce findings, and die at Render's ~100-second
limit long before `VULNIX_SCAN_TOTAL_TIMEOUT_SECONDS` (900) is reached. A deployment can look
like it has a functioning scan pipeline while having no worker at all, and the only visible
trace is that the pipeline's log lines come from the web service. Set the variable explicitly;
do not rely on a blank meaning "off".

| Variable | API | Worker | Scheduler | What a blank value looks like |
| --- | --- | --- | --- | --- |
| `vulnix-backend` group | yes | yes | yes | every row below is blank on that service |
| `VULNIX_DATABASE_URL` | yes | yes | yes | the service cannot start |
| `VULNIX_CELERY_BROKER_URL` | yes | yes | yes | the shipped default is `redis://localhost:6379/0`, so a worker with no value publishes and consumes nothing and its log stays clean |
| `VULNIX_SUPABASE_*` | yes | to boot, never read | to boot, never read | the console signs in, every authorized call 401s |
| `VULNIX_AI_*` keys | yes | yes | no | the process that runs the review has no credential for the reviewer it picked, and audits end `completed_with_errors` carrying `AI_MISCONFIGURED` |
| `VULNIX_STORAGE_BACKEND` + `VULNIX_S3_*` | yes | yes | no | upload lands, the audit cannot read it back |
| `VULNIX_CELERY_EAGER` | must be `false` | - | - | blank means the code default, `true`: the audit runs inside the request Render ends at about 100 seconds, and no worker is needed for scans to appear to work |
| `VULNIX_STATUS_PROBE_URL` | yes | yes | no | the status page shows a live look and no history |
| `VULNIX_INTEGRATION_SECRET_KEY`, `VULNIX_INTEGRATIONS_ENABLED` | yes | yes | yes | connections cannot be stored or delivered |
| `VULNIX_CORS_ALLOW_ORIGINS`, `VULNIX_CONSOLE_BASE_URL`, `VULNIX_OAUTH_REDIRECT_BASE_URL` | yes | no | no | the console fails in the browser while `curl` succeeds |

Migrations run from the API only, never from the worker or the scheduler.

Two of these rows are about *starting*, not using. Every process builds the same settings object,
and with `VULNIX_APP_ENV=production` that object refuses to exist unless there is a
`VULNIX_SUPABASE_JWKS_URL` or `VULNIX_SUPABASE_JWT_SECRET`, and unless
`VULNIX_INTEGRATIONS_ENABLED=true` comes with an `VULNIX_INTEGRATION_SECRET_KEY`
(`app/core/config.py:234`). A worker or scheduler missing those does not degrade, it exits at boot
with a `ValueError`. The useful corollary when a service *is* up: it holds the values the
validator checks, so a worker that runs audits but fails them at the review step is missing a
reviewer key and nothing else.

**Beat posts; a worker runs.** The two scheduled jobs - `vulnix.probe_status` and
`vulnix.drain_integration_outbox` - are ordinary Celery tasks that the scheduler only sends to
the queue, so every periodic job needs **both** processes alive. A scheduler on its own ticks
merrily every minute and changes nothing, because the job it posted has no consumer. That is
why `VULNIX_STATUS_PROBE_URL` belongs on the worker: the value is read where the task runs, and
a blank there makes the worker return 0 as a success.

## Proving which process is missing what

Each symptom points at a different process, so check them in this order:

1. Establish **which process ran the audit** before believing anything about its environment.
   Search the API's log for `scan_enqueued`. If it is absent while audits still produce
   findings, the web service ran them inline because `VULNIX_CELERY_EAGER` was never set, and
   there is no worker - every scan log line is in the API. If it is present and the audit never
   leaves `queued`, the API published and nothing consumed it.
2. An audit that stays `queued` forever is the worker: either nothing consumes the queue, or
   the worker resolves a broker URL of its own. Jobs already queued survive, because the Redis
   instance uses `noeviction`, and start the moment a real consumer appears.
3. `GET /api/v1/ready` reports **the process that answered** - the API - and only **presence**.
   `ai_hosted_primary: configured` is `bool(api_key and base_url)`; it never asks the provider
   anything. A revoked key, one from another project, or one typed with a stray space all read
   as configured. So all three reviewers being "configured" there is compatible with an audit
   whose credential is refused, and it says nothing about the worker either way.
4. An audit that runs and reports `AI_MISCONFIGURED` has three sources, all of them in the
   review step of whichever process ran it, and only that process's log separates them:
   - `No reviewer is configured here.` - the process holds no key for the reviewer it picked: a
     blank on the worker, or a workspace selection that names a reviewer nobody configured.
   - `That reviewer reports no models this account can use.` - a key is present and the
     provider's listing for this account came back empty.
   - `The reviewer rejected that request.` - the provider answered with a non-retryable status:
     `401`/`403` for a key that is present and wrong, `400` for a model name the endpoint will
     not accept. This is the only one that means "the credential is in place and refused", and
     it is logged as `ai_provider_refused provider=… status=… reason=…`.
   None of these three messages reaches the browser: the scan row stores `error_code` alone, so
   the console can only ever show the code, never the reason.
5. A status page with no history is the scheduler and the worker together. `GET
   /api/v1/status` answers `probing_enabled: true` with `latest: null` and `probes: 0` in every
   bucket when the probe URL is set on the API but **no row has ever been written**. Three
   causes produce that same payload, and the two logs separate them: the scheduler's log has no
   `Sending due task probe-status` lines, so Beat is not running; it posts and no worker
   consumes, so the job queues and dies nowhere; or a worker runs it with a blank
   `VULNIX_STATUS_PROBE_URL` and reports a clean success every minute while writing nothing.
   The third is the easiest to miss, because nothing anywhere looks like an error.
   (`probing_enabled` is only `bool(VULNIX_STATUS_PROBE_URL)` on the API, so it says the API was
   configured - nothing about whether the check has ever run.)
6. To prove the probe path itself while the scheduler is still missing, call
   `POST /api/v1/status/probe` signed in. It makes the same check once, writes the row, and the
   page fills on its next poll. It exists so an operator can watch a row land instead of
   waiting for a tick and guessing.

## Frontend on Cloudflare Pages

Project from the repo, with the build root pointed at the app:

- Production branch: `dev`
- Root directory: `frontend`
- Build command: `npm ci && npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_BASE_URL=https://<api-host>.onrender.com/api/v1`
- Optional but recommended: `NODE_VERSION=22`, so a future change to Pages' default
  image cannot move the toolchain under a build

`VITE_API_BASE_URL` is compiled into the bundle, not read at runtime: changing it
needs a new build, and the console will keep serving the old origin until then. It
also has to appear in the API's `VULNIX_CORS_ALLOW_ORIGINS`, or every authorized call
fails in the browser while working fine with `curl`.

The SPA fallback lives in `frontend/public/_redirects` (one rewrite to
`/index.html`), and cache and security headers in `frontend/public/_headers`. Both
are copied into `dist` by the build; if a deep link like `/app/audits` 404s, that is
the first file to check.

A `*.pages.dev` subdomain is reachable by anyone who guesses it. Use a custom domain
for real use, and add every origin that should be able to call the API to the
allowlist - including the preview URLs you actually use.

## Verifying a deployed stack

Each step produces evidence in a different place, so a failure names its own layer:

1. `GET /health` on the API returns `{"status":"ok"}`.
2. Sign in on the console. A failure here is Supabase (redirect allowlist, JWT
   settings) or `VULNIX_SUPABASE_JWKS_URL`; a `401` from the API means the token was
   issued by a project the API does not trust.
3. Open a workspace's AI model list. An empty list means no reviewer credential
   reached the deployment - the catalog only offers names a provider confirms. A
   full list proves only that the *API* has one: this call and `/ready` are both
   answered by the web service, so the worker can still be keyless and every audit
   end `AI_MISCONFIGURED`.
4. Upload a ZIP. Then in the R2 dashboard, confirm an object under
   `<project-id>/<uuid>.zip`. A `500` at this step is almost always the storage
   token or the endpoint, and the API log line says which.
5. Watch the worker's log, not the API's: `scan_enqueued` on the API, then the
   pipeline's own step lines on the worker. An audit that stays `queued` means no
   worker is listening on the default queue. If the pipeline's step lines appear in
   the **API's** log instead, there is no worker at all and `VULNIX_CELERY_EAGER` is
   unset, so the audit is running inside the request - fix that before reading any
   AI error, because it changes which process's environment you are reasoning about.
6. With integrations enabled, fail a delivery on purpose (a bad webhook host) and
   confirm the retry happens within a minute - that is the sweeper, and it needs
   `vulnix-scheduler` to post the job **and** a worker to run it. A scheduler alone
   retries nothing.

## Known limits of this shape

These are real, not hypothetical, and each has a size or a symptom.

- **A free Render web instance sleeps.** The worker keeps running an audit it has
  already claimed, but nothing new is enqueued while the API is asleep, and the
  console's polling stalls with it. A paid instance is what makes the product feel
  continuous.
- **A 100 MiB archive passes through the API process** and out to R2 inside one
  request. That is slow on a small instance and can hit a host's request ceiling.
  The fix is a signed R2 upload so the browser puts the bytes there directly; it is
  not built yet.
- **Render's free Key Value is not persistent.** A restart loses queued-but-unclaimed
  jobs; the scan row itself survives, so the audit looks stuck rather than lost.
- **CLI analysers are not installed on Render.** `semgrep`, `gitleaks`, `bandit`,
  `pip-audit` and `trivy` are opt-in inputs to the agent (ADR-014) and a worker
  without them reports those tools unavailable. The AI review path does not need
  them. Add them to the build command only if you want them.
- **One worker, one audit at a time.** Concurrency is `1` deliberately. Capacity is
  bought with more worker instances, not more threads per instance.
- **`/tmp` is scratch.** The extracted archive lives there during a run and is gone
  after a rebuild; nothing may depend on it afterwards.
- **Logs.** Never paste a Render traceback that includes request headers into an
  issue or a chat - it prints the caller's bearer token.
