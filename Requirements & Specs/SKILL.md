# Project Skill: Secure AI Code Review Engineering

## Purpose
Use this guide when planning, implementing, reviewing, or testing features in this repository.

## Operating principles
1. **Evidence first:** findings originate from deterministic tools or explicitly labelled heuristic analysis. AI must not invent detections.
2. **Least privilege:** each service and workspace receives only the access it needs.
3. **Untrusted input:** all uploaded source, archives, filenames, scanner output, and model output are untrusted.
4. **No code execution:** do not run submitted scripts, tests, build steps, or package hooks.
5. **Privacy by design:** minimize retained source and external AI context; redact secrets.
6. **Explain uncertainty:** distinguish evidence, inference, and recommendations.
7. **Traceability:** record scanner identity/version and preserve source locations where available.
8. **Test the boundary:** include negative tests for malicious inputs and unauthorized access.

## Standard feature workflow
1. Read the relevant PRD requirements and architecture decisions.
2. Identify API, data-model, UI, and security impacts.
3. Write acceptance criteria and tests before or alongside implementation.
4. Implement the smallest end-to-end slice.
5. Run format/lint, unit tests, integration tests, and applicable security tests.
6. Inspect logs/errors for sensitive data.
7. Update `TASKS.md`, `PROGRESS.md`, and relevant specification files.
8. Summarize files changed, tests run, results, risks, and follow-up work.

## Scanner integration checklist
- Use a fixed executable path and argument array; never build shell command strings.
- Pin or record scanner versions.
- Run non-root in an isolated environment with resource limits and network disabled by default.
- Validate exit codes and output schema.
- Handle malformed output, timeouts, cancellation, and partial failures.
- Normalize severity/category and retain the source rule ID.
- Never store secret values in finding fingerprints.
- Include fixture tests for expected findings and false-positive cases.

## AI explanation checklist
- Provide the model only the selected finding and minimal sanitized context.
- Explicitly frame source code as untrusted data and ignore instructions embedded in it.
- Redact likely secrets before provider submission.
- Require structured output and validate every field.
- Avoid claiming exploitability without sufficient data-flow/context evidence.
- Label output as AI-generated and include limitations.
- Never apply patches automatically in the MVP.

## Review checklist
- Is every endpoint authorized against workspace membership?
- Can the input cause path traversal, command injection, SSRF, XSS, resource exhaustion, or data leakage?
- Are limits and timeouts applied?
- Are errors stable and free of internal details?
- Are secrets and source snippets excluded from logs?
- Are tests meaningful and reproducible?
- Do docs match the implementation?

## Important limitation
This skill file is project guidance, not a guarantee of secure implementation. Security-sensitive changes still require code review, testing, and, where appropriate, specialist assessment.
