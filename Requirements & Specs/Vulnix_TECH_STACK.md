# Vulnix — Technology Stack

## 1. Project Overview

**Vulnix** is an AI-powered application security platform that combines established security scanners with AI-assisted code analysis. It helps developers discover vulnerabilities, understand their impact, prioritize risks, and review remediation suggestions.

**Product tagline:** Find vulnerabilities. Understand risk. Fix with confidence.

## 2. Recommended Stack at a Glance

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React + Vite + JavaScript | Web application and security dashboard |
| UI and styling | Tailwind CSS + shadcn/ui | Consistent, responsive interface |
| Code viewer | Monaco Editor | Display source snippets and findings |
| Charts | Recharts | Security metrics and scan trends |
| Backend API | Python + FastAPI | REST API and application services |
| Validation | Pydantic | Request and AI-output schema validation |
| ORM and migrations | SQLAlchemy + Alembic | Database access and schema changes |
| Primary database | PostgreSQL | Users, projects, scans, findings, and audit records |
| Background jobs | Celery + Redis | Queue scans and AI analysis asynchronously |
| Security scanners | Semgrep CE, Gitleaks, Bandit | Static analysis and secret detection |
| Dependency/container scanning | OWASP Dependency-Check and/or Trivy | Identify known vulnerable dependencies and supported artifacts |
| AI integration | Provider-independent AI service | Explanations, risk context, remediation suggestions, and AI-assisted review |
| Model reviewers | Hosted reviewers, configured per deployment | Fail over to the next reviewer when one is down, throttled or too narrow |
| Local model runtime | Ollama (opt-in, off by default) | Run a supported model on the host when a deployment wants its own reviewer |
| Object storage | S3-compatible storage | Store uploaded archives and generated reports |
| Containerization | Docker | Reproducible services and isolated workers |
| Backend testing | Pytest | Unit, integration, and API tests |
| Frontend testing | Vitest + React Testing Library | UI and component tests |
| CI/CD | GitHub Actions | Automated checks and build/test workflows |

## 3. Frontend

### Technologies

- **React + Vite:** build the single-page web application.
- **JavaScript:** use JavaScript rather than TypeScript if keeping the project aligned with a JavaScript-based workflow is preferred.
- **Tailwind CSS:** utility-first styling.
- **shadcn/ui:** accessible interface components.
- **Monaco Editor:** code previews, finding locations, and proposed diff review.
- **Recharts:** scan summaries, severity distributions, and trends and graphs of the codebase

### Main screens

- Landing page and authentication
- Projects and repositories
- Upload source archive
- Scan progress and scan history
- Findings explorer with filters
- Finding detail and evidence
- AI explanation and remediation panel
- Review/triage workflow
- Reports and project settings

The frontend must not be responsible for enforcing security permissions. The backend must validate access to every project, scan, finding, and report.

## 4. Backend API

### Technologies

- **Python**
- **FastAPI**
- **Pydantic**
- **SQLAlchemy**
- **Alembic**
- **Pytest**

### Backend responsibilities

- Authentication and authorization(supabase Auth)
- Project and scan lifecycle
- Safe archive-upload handling
- Queueing and tracking scan jobs
- Invoking scanner workers
- Normalizing scanner output into a shared finding schema
- Building limited, redacted context for AI analysis
- Validating AI responses and evidence references
- Generating reports
- Audit logging, quotas, and rate limits

Keep routes, business logic, scanner integrations, AI integrations, and database models in separate modules.

## 5. Database and Storage

### PostgreSQL

Use PostgreSQL(supabase hosted) as the system of record for:

- Users and organizations
- Projects and repository metadata
- Scan jobs and scan results
- Findings and evidence references
- AI assessments and remediation proposals
- Finding status, comments, and review history
- Audit events and usage metadata

Use SQLAlchemy for database access and Alembic for migrations.

### Object storage

Store uploaded archives and larger generated artifacts in S3-compatible object storage rather than directly in database rows. Use short-lived access links where needed and enforce tenant/project authorization before issuing them.

Do not store raw secrets in findings or logs. Redact sensitive values wherever practical.

## 6. Background Processing

### Celery + Redis

Use background jobs for tasks that may take longer than a normal API request:

- Archive validation and extraction
- Security scanning
- Dependency analysis
- AI assessment
- Report generation

Apply job timeouts, bounded retries, cancellation, per-project quotas, and status tracking. Redis is a queue/broker component, not the primary database.

## 7. Security Engines

| Engine | Primary purpose | Notes |
|---|---|---|
| Semgrep Community Edition | Static analysis for supported languages and code patterns | Review current license and ruleset terms, particularly before offering a competing hosted scanning service. |
| Gitleaks | Detect exposed credentials and secrets | Redact secret values in output, logs, and AI context. |
| Bandit | Detect common security issues in Python code | Python-focused; supplement it with other language-specific tooling. |
| OWASP Dependency-Check | Identify dependencies with known vulnerability data | Check supported package ecosystems and vulnerability-data update requirements. |
| Trivy | Scan supported dependencies, container images, and other artifacts | Choose the relevant scan modes for the MVP. |

### Integration approach

1. Run each engine through a dedicated adapter.
2. Capture tool name, version, rule identifier, severity, location, and raw evidence reference.
3. Normalize output into Vulnix's shared finding schema.
4. Preserve the original scanner evidence for traceability.
5. Deduplicate related findings carefully without discarding provenance.
6. Re-run relevant scanners to help verify proposed fixes.

**Licensing note:** Open-source availability does not automatically permit every type of commercial redistribution or hosted-service use. Check the current license and terms for each engine, ruleset, database, and integration before launching commercially.

## 8. AI Analysis Layer

The AI layer is a core product subsystem, not a replacement for deterministic security tools.

### Responsibilities

- Explain what a finding means and why it matters.
- Describe plausible impact and attack prerequisites.
- Prioritize findings using scanner evidence and available code context.
- Suggest targeted remediation and verification steps.
- Identify possible false positives with an explicit rationale.
- Answer user questions about findings from the user's authorized scan.
- Optionally identify AI-only security hypotheses, clearly separated from scanner-confirmed results.

### Implementation

Build a provider-independent AI adapter so the model provider can change without rewriting business logic.

- **Hosted reviewers (default):** model APIs selected according to quality, privacy terms, latency, and budget. A deployment configures which ones it uses; the console only ever sees a Vulnix alias.
- **Local reviewer (opt-in):** Ollama with a suitable code-capable model, enabled with `VULNIX_AI_LOCAL_ENABLED=true` for a deployment that runs its own inference. It is not offered by default, because a picker that lists a model the host has not pulled invites a choice that then cannot answer.
- **Hybrid option:** run scanners locally and send only minimal, redacted context to a hosted model when enabled.

Ollama is a model runtime, not a model itself. Model capabilities, license terms, hardware needs, and output quality vary.

### AI output validation

Require structured outputs validated with Pydantic. A finding assessment should contain:

- Finding ID
- Summary and explanation
- Impact and attack prerequisites
- Confidence and severity rationale
- Remediation guidance
- Verification steps
- False-positive notes
- References to known evidence IDs
- Limitations and uncertainty

Reject invented evidence IDs, invalid file paths, unsupported line numbers, malformed output, and claims that cannot be grounded in available evidence. Clearly label AI-only findings as hypotheses.

## 9. Security Architecture Requirements

Security is particularly important because Vulnix processes potentially malicious source code and archives.

- Never execute uploaded source code in the MVP.
- Validate archive paths and reject traversal paths and unsafe symbolic links.
- Enforce compressed size, expanded size, file-count, CPU, memory, and wall-clock limits.
- Run scanners in disposable, unprivileged workers.
- Disable worker network access by default.
- Use least-privilege service credentials.
- Enforce tenant authorization server-side on every object.
- Treat source code, comments, READMEs, filenames, and scanner text as untrusted input.
- Defend against prompt injection by separating trusted instructions from repository content.
- Redact secrets before external AI calls.
- Make hosted AI optional and disclose relevant data handling.
- Never automatically apply or deploy AI-generated fixes by default.
- Audit security-sensitive actions without logging source code or credentials.

## 10. Suggested Repository Structure

```text
vulnix/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── features/
│   │   ├── pages/
│   │   ├── services/
│   │   └── lib/
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   │   ├── scanners/
│   │   │   ├── ai/
│   │   │   ├── findings/
│   │   │   └── reports/
│   │   ├── workers/
│   │   └── main.py
│   ├── tests/
│   └── pyproject.toml
├── infrastructure/
│   ├── docker/
│   └── compose.yaml
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── AI_ENGINE.md
│   ├── AI_SECURITY.md
│   └── AI_EVALUATION.md
├── .env.example
├── AGENTS.md
└── README.md
```

## 11. Environment Configuration

Keep credentials out of source control. Provide an `.env.example` with placeholder values only, such as:

```dotenv
APP_ENV=development
APP_SECRET_KEY=replace_me
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/vulnix
REDIS_URL=redis://localhost:6379/0
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_ACCESS_KEY=
OBJECT_STORAGE_SECRET_KEY=
AI_PROVIDER=groq
AI_LOCAL_ENABLED=false
AI_BASE_URL=http://localhost:11434
AI_MODEL=replace_with_selected_model
AI_API_KEY=
```

Use a strong secret generated for each environment. Do not commit real `.env` files. In production, use the deployment platform's secret manager and TLS-protected service connections.

## 12. Recommended MVP Build Order

1. Create the repository, frontend, FastAPI backend, PostgreSQL database, and migrations.
2. Implement authentication, projects, and server-side authorization.
3. Implement safe archive upload and validation.
4. Add isolated workers and integrate Semgrep, Gitleaks, and Bandit.
5. Normalize findings and build scan history and the findings explorer.
6. Add dependency scanning for the package ecosystems selected for the MVP.
7. Add AI explanations, prioritization, and remediation suggestions.
8. Validate AI outputs and evidence references; add prompt-injection and secret-redaction tests.
9. Add reports, audit history, and usage limits.
10. Add repository-provider integrations and additional languages after the upload-based workflow is reliable.

## 13. Final Recommendation

Start with a modular application rather than microservices. Keep the API, scanner adapters, AI service, and background workers separated in code, while deploying only the components needed for the MVP. Split services further only when scale, isolation, or team ownership justifies the added operational complexity.

The recommended initial combination is:

**React + Vite + Tailwind CSS + shadcn/ui + FastAPI + PostgreSQL + Redis/Celery + Semgrep CE + Gitleaks + Bandit + a provider-independent AI layer + Docker.**
