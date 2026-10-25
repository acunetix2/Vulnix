# AI Code Security Review Platform — Product Requirements Document

**Working title:** SentinelCode (temporary; validate name before public use)  
**Status:** MVP definition  
**Version:** 0.1  
**Last updated:** 2026-10-18

## 1. Product vision
Build a developer-focused application that reviews source code for security weaknesses, explains findings in plain language, prioritizes risk, and recommends actionable fixes. It combines deterministic security tooling with AI-assisted explanation rather than relying on an LLM as the sole security detector.

## 2. Problem
Developers need fast, understandable feedback about insecure code. Existing scanners can produce noisy or difficult-to-interpret output, while general-purpose AI can miss vulnerabilities, hallucinate issues, or recommend unsafe fixes.

## 3. Target users
- Individual developers who want to review a repository or selected files.
- Small engineering teams that want a repeatable security review workflow.
- Security learners who need explanations and remediation guidance.
- Reviewers who want findings tied to exact source locations.

## 4. MVP outcomes
A user can:
1. Create an account and workspace.
2. Create a project and submit a ZIP of source code or connect a repository in a later phase.
3. Start a scan and see its status.
4. View findings with severity, confidence, category, file path, line range, evidence, explanation, and remediation.
5. Filter and sort findings.
6. Mark a finding as open, accepted risk, false positive, or fixed.
7. Export a report as JSON or Markdown.
8. See a clear record of what tools ran and when.

## 5. MVP scope
### In scope
- ZIP upload with size/file-count limits and archive path-traversal protection.
- Supported-language detection and initial support for JavaScript/TypeScript, Python, and Java (exact rule coverage depends on selected scanners).
- Static analysis through established tools/adapters such as Semgrep and language-native dependency checks where practical.
- Secret detection using a dedicated scanner.
- Dependency vulnerability checks using lockfiles and a recognized advisory source/tool.
- AI-assisted summarization, prioritization, and remediation suggestions based on scanner evidence.
- Finding deduplication, severity normalization, scan history, and report export.
- Workspace/project access controls, audit events for sensitive actions, rate limits, and retention controls.

### Not in MVP
- Automatic code changes or pull-request merging.
- Running untrusted application code.
- Production penetration testing, exploit execution, or dynamic analysis against live systems.
- Guaranteed vulnerability detection or compliance certification.
- Public repository indexing, multi-tenant enterprise SSO, billing, or complex CI/CD integrations.
- Autonomous agents with unrestricted shell/network access.

## 6. Core workflow
1. User signs in and creates a project.
2. User uploads a ZIP archive.
3. Server validates the upload and stores it in quarantine.
4. A worker safely extracts files into an isolated temporary workspace.
5. Deterministic scanners run with resource/time limits and network disabled unless a specific dependency lookup requires controlled access.
6. Results are normalized, deduplicated, and persisted.
7. AI receives only the minimum relevant finding evidence and code snippets, with secrets redacted where possible.
8. UI displays findings and clearly distinguishes scanner evidence from AI-generated interpretation.
9. User triages findings and exports a report.

## 7. Functional requirements
- **FR-01 Authentication:** users can register, sign in, sign out, and recover access through the selected auth provider.
- **FR-02 Workspace isolation:** users can only access resources belonging to authorized workspaces.
- **FR-03 Project management:** create, list, update, and archive projects.
- **FR-04 Upload validation:** reject unsupported archives, oversized uploads, excessive file counts, path traversal, and unsafe symlinks.
- **FR-05 Scan lifecycle:** queued, running, completed, completed-with-errors, failed, and cancelled states.
- **FR-06 Scanner adapters:** each tool's output is converted into a shared finding schema.
- **FR-07 Finding details:** show source location, evidence, rule/source, severity, confidence, and remediation.
- **FR-08 AI explanations:** provide contextual summaries with explicit uncertainty and no unsupported claims.
- **FR-09 Triage:** users can change finding status and add notes.
- **FR-10 Reporting:** export Markdown and JSON.
- **FR-11 Auditability:** record scan start/finish, project changes, exports, and triage updates.
- **FR-12 Operational safety:** enforce upload limits, worker timeouts, resource caps, access control, and safe error handling.

## 8. Non-functional requirements
- Security: least privilege, secure session handling, encryption in transit, secrets outside source control, strict tenant authorization, and dependency updates.
- Reliability: scanner failures should be isolated and reported without losing completed tool results.
- Performance: initial target is a repository ZIP up to 100 MB compressed (1 GB uncompressed, 64 MB per entry) and 10,000 files, configurable after benchmarking.
- Usability: a first-time user should be able to locate the highest-priority finding without reading documentation.
- Observability: structured logs, scan duration, scanner exit status, and error categories; never log raw secrets or entire source files.
- Accessibility: keyboard navigation, visible focus, adequate contrast, and semantic labels.
- Privacy: clear retention policy; uploaded source code is private by default and not used to train models.

## 9. Security and abuse cases
- Malicious archive paths, symlinks, decompression bombs, huge files, and parser crashes.
- Prompt injection embedded in source comments or README files.
- Source code or credentials leaking through logs, prompts, reports, or cross-workspace access.
- Scanner command injection and unsafe shell argument construction.
- Resource exhaustion through many scans or crafted source files.
- Forged scanner output, unsafe report rendering, and stored XSS.
- SSRF or unexpected egress if repository import is later added.

Mitigations: never execute submitted project code; use isolated workers; disable outbound network by default; pass arguments as arrays rather than shell strings; cap CPU, memory, file count, and runtime; escape rendered source; redact likely secrets; validate all IDs and permissions; treat source as untrusted data, not instructions.

## 10. Success metrics
- Percentage of scans completing successfully.
- Median and p95 scan duration by archive size.
- Percentage of findings with valid file/line references.
- User-confirmed useful finding rate and false-positive rate.
- Percentage of AI explanations accepted as helpful.
- Number of critical security incidents or cross-tenant access failures (target: zero).

## 11. Release plan
- **Phase 0:** repository setup, threat model, scanner spike, schemas.
- **Phase 1:** upload, project, scan job, one static scanner, normalized findings.
- **Phase 2:** secrets and dependency checks, findings UI, report export.
- **Phase 3:** AI explanations, triage, audit events, security hardening.
- **Phase 4:** repository integrations and CI checks only after the MVP is stable.

## 12. Open questions
- Final product name and domain.
- Initial deployment region and source-code retention period.
- Whether authentication is managed by Supabase Auth, Clerk, or another provider.
- Whether the first release should support private Git repository imports.
- Which AI provider/model and data-processing terms are acceptable.
- Exact language/rule coverage after a scanner evaluation.
