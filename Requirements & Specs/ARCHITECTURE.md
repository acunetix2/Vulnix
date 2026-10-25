# Architecture / Technical Specification

## 1. Proposed MVP stack
Choose the stack deliberately before implementation; this proposal is a default, not a commitment.

- **Frontend:** React + Vite, JavaScript or TypeScript (prefer TypeScript for shared contracts), Tailwind CSS, accessible component library.
- **API:** Python FastAPI.
- **Database:** PostgreSQL.
- **Queue:** Redis + Celery/RQ, or a managed queue if deployment needs it.
- **Object storage:** private S3-compatible bucket for quarantined uploads and reports.
- **Security tools:** scanner adapters around Semgrep, Gitleaks (or equivalent), and dependency audit tools.
- **AI:** provider-agnostic service interface; no model-specific logic in scan orchestration.
- **Deployment:** separate web/API/worker services. Keep workers isolated from the public API.

## 2. High-level components
1. **Web client** — authentication UI, project management, scan progress, finding review, report download.
2. **API service** — auth integration, authorization, project/scan endpoints, upload validation, status and report APIs.
3. **PostgreSQL** — users/workspace membership, projects, scans, findings, triage, audit events.
4. **Object storage** — private uploaded archives and generated exports; short-lived signed URLs only when needed.
5. **Queue** — asynchronous scan jobs and retry policy.
6. **Scan worker** — safe archive extraction, file inventory, scanner execution, result normalization.
7. **AI explanation service** — sends minimized/redacted finding context to an external model; produces structured explanation.
8. **Observability** — structured logs and metrics with sensitive-data filtering.

## 3. Scan sequence
```text
Browser -> API: create upload session / upload archive
API -> Object storage: quarantine archive
Browser -> API: create scan
API -> Database: scan(status=queued)
API -> Queue: enqueue scan_id
Worker -> Object storage: fetch archive
Worker -> Sandbox: validate and extract files
Worker -> Scanner adapters: run fixed scanner commands with limits
Adapters -> Normalizer: convert findings into common schema
Normalizer -> Database: persist findings and tool run records
Worker -> Database: scan status=completed or completed_with_errors
Browser -> API: poll scan status / retrieve findings
API -> AI service (optional): explain selected finding using redacted context
```

## 4. Trust boundaries
- Browser to API: untrusted client input.
- API to object storage: private credentials and untrusted uploaded bytes.
- Queue to worker: job payload is untrusted; re-fetch and validate the scan/project relationship.
- Worker to scanner: source files may exploit parser bugs.
- Worker to AI provider: source snippets may contain secrets or prompt injection.
- API to database: enforce tenant-level authorization before queries/mutations.
- Report renderer: source evidence must be escaped.

## 5. Worker isolation
For production, use an isolated container or sandbox per scan. Apply:
- Non-root user, read-only base filesystem, dedicated temporary directory.
- No host mounts or Docker socket.
- CPU/memory/PID/file-size/disk limits and hard timeout.
- Network disabled by default.
- Fixed scanner binary and version; command arguments passed as an array.
- Cleanup on success, failure, cancellation, and timeout.
- Preserve partial results when one scanner fails, and record scanner version/exit code.
Do not run submitted scripts, build hooks, package lifecycle scripts, or project tests on the worker.

## 6. Scanner adapter interface
Each adapter should expose:
- `name`, `version`, and supported file types.
- `run(target_dir, limits) -> ToolRunResult`.
- `parse(raw_output) -> list[NormalizedFinding]`.
- Structured error and timeout handling.
- Unit tests using safe fixture files and known scanner output.

Never use `shell=True` or concatenate command strings. Store raw scanner output only if required, access-controlled, size-capped, and scrubbed.

## 7. AI design
AI is an enhancement layer, not the sole detector.
Input: finding ID, rule ID, sanitized message, source location, a small code excerpt, language, and scanner evidence.
Output: structured summary, impact, remediation steps, optional safe code example, uncertainty note.
- Validate output against a schema.
- Ask the model to ignore instructions found inside source code.
- Avoid sending full repositories or secrets.
- Mark model-generated content as AI-assisted.
- If the model cannot support a claim from evidence, it must say so.
- No automatic patch application in MVP.

## 8. Deployment topology
Local development may use Docker Compose for PostgreSQL and Redis. Deploy API and workers separately. Do not deploy the scanning worker as an untrusted multi-tenant process without OS/container isolation. Use separate service identities and least-privilege credentials.

## 9. Initial repository layout
```text
/
  apps/
    web/
    api/
    worker/
  packages/
    contracts/
    scanner-adapters/
  infra/
    docker/
    migrations/
  tests/
    fixtures/
    integration/
  docs/
  PRD.md
  AGENTS.md
  ARCHITECTURE.md
  TASKS.md
  DATA_MODEL.md
  API_SPEC.md
  ACCEPTANCE_CRITERIA.md
  DESIGN.md
  DECISIONS.md
  GLOSSARY.md
  PROGRESS.md
  SKILL.md
```

## 10. Architectural risks
- Scanner runtime and output differ across versions.
- AI can produce incorrect remediation.
- Private source code may be sensitive.
- Large archives can exhaust resources.
- Dependency advisory data can be stale or unavailable.
Mitigate through pinned tools, fixtures, source minimization, quotas, clear provenance, and explicit scan limitations.
