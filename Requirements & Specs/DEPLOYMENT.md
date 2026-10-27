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
   reached the deployment - the catalog only offers names a provider confirms.
4. Upload a ZIP. Then in the R2 dashboard, confirm an object under
   `<project-id>/<uuid>.zip`. A `500` at this step is almost always the storage
   token or the endpoint, and the API log line says which.
5. Watch the worker's log, not the API's: `scan_enqueued` on the API, then the
   pipeline's own step lines on the worker. An audit that stays `queued` means no
   worker is listening on the default queue.
6. With integrations enabled, fail a delivery on purpose (a bad webhook host) and
   confirm the retry happens within a minute - that is the sweeper, and it only runs
   if the `vulnix-scheduler` service is up.

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
