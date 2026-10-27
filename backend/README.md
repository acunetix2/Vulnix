# Vulnix Backend

FastAPI backend for the Vulnix security review platform: projects, quarantined
ZIP uploads, asynchronous scans through isolated scanner adapters, normalized
findings, triage, report export, and optional AI explanations.

## Layout

- `app/api/`: HTTP wiring, dependencies, pagination.
- `app/core/`: configuration, error handling, auth/RBAC, rate limiting.
- `app/db/`: SQLAlchemy models, engine, sessions.
- `app/modules/`: domain features (workspaces, projects, uploads, scans,
  findings, reports, audit) with routes plus a thin service layer.
- `app/scanning/`: safe archive handling, scanner adapters, normalization,
  and the scan pipeline.
- `app/ai/`: redaction, prompts, provider abstraction, output validation.
- `app/integrations/`: object storage and queue adapters.
- `app/workers/`: Celery app and the scan task.
- `migrations/`: Alembic migrations.
- `tests/`: unit and integration tests with safe fixtures.

## Quick start (development)

```bash
python -m pip install -e ".[dev]"
copy ..\.env.example .env        # PowerShell; use cp on Unix
python -m uvicorn app.main:app --reload
```

Defaults are dev-friendly: SQLite database, local quarantine storage, eager
in-process scans, auth disabled. Real environment variables use the `VULNIX_`
prefix.

### Run with PostgreSQL and Redis

```bash
docker compose -f ../infrastructure/compose.yaml up -d
# .env:
#   VULNIX_DATABASE_URL=postgresql+psycopg://vulnix:vulnix@localhost:5432/vulnix
#   VULNIX_CELERY_EAGER=false
python -m pip install -e ".[dev,postgres]"
python -m alembic upgrade head
python -m celery -A app.workers.celery_app.celery_app worker -l info
```

### Scanners

Install the tools you want; missing ones are reported as `skipped`
(`TOOL_UNAVAILABLE`) without failing the API:

- Semgrep (static analysis), Gitleaks (secrets), Bandit (Python),
  pip-audit and Trivy (dependencies).

Scanner commands are fixed argv arrays with timeouts and a minimal
environment. Submitted project code is never executed.

### AI explanations

Disabled by default. For agentic source reviews, set `VULNIX_AI_ENABLED=true`
and give at least one hosted reviewer a credential (`VULNIX_AI_GROQ_API_KEY`,
`VULNIX_AI_GEMINI_API_KEY` or `VULNIX_AI_OPENROUTER_API_KEY`); the model a
workspace may pick is whatever that account actually reports, so a name is never
typed into a client. Running inference on this machine is opt-in: set
`VULNIX_AI_LOCAL_ENABLED=true` and point `VULNIX_AI_BASE_URL` at an Ollama
server. Audits request agent review by default; if the reviewer is unavailable or only
part of the source can be reviewed, successful CLI checks are retained but the
audit is marked `completed_with_errors` rather than being presented as complete.
The agent reviews every eligible file by default, can read related files and
search the repository to verify findings, and uses the whole-scan timeout and
daily AI quota as its safety bounds. `VULNIX_AI_NUM_CTX` and
`VULNIX_AI_DISABLE_THINK` belong to the local adapter and matter only when that
opt-in is on.
Snippets are redacted before model calls, findings are checked against the
source archive, and repository code is never executed.

## Checks

```bash
python -m ruff check app tests
python -m pytest
```

## Security notes

- Uploads are size-capped, ZIP-validated (traversal, symlinks, bombs,
  nesting), and stored under generated object keys.
- Every object lookup enforces workspace membership; missing access returns
  404 to avoid disclosing existence.
- Audit events record sensitive actions without storing source code or
  secrets.
- Production startup refuses to run with auth disabled or an empty JWT
  secret.
