# AI Security and Threat Model

## 1. Scope

This document covers threats introduced by AI analysis, source-code ingestion, scanner workers, and model-provider integrations.

## 2. Threats and controls

### Prompt injection in repositories
**Threat:** Comments, Markdown files, test fixtures, or source strings tell the model to ignore instructions, reveal secrets, or alter its analysis.

**Controls:**
- Treat all repository content and scanner output as untrusted data.
- Keep policy instructions separate from code context.
- Delimit and label source snippets.
- Do not give the model tools or privileges it does not need.
- Require structured output and validate it.
- Test with adversarial repositories and prompt-injection fixtures.

### Secret and source-code leakage
**Threat:** Credentials or proprietary code are sent to a hosted model or written to logs.

**Controls:**
- Detect and redact secrets before model calls.
- Send the smallest useful snippets.
- Provide clear data-processing and retention settings.
- Make hosted-model use configurable and explicit.
- Never log API keys, access tokens, or full source by default.
- Use short retention periods and documented deletion behavior.

### Hallucinated vulnerabilities or fixes
**Threat:** The model invents a vulnerability, CVE, dependency, line number, or unsafe patch.

**Controls:**
- Ground results in scanner evidence and actual source locations.
- Validate file paths, line ranges, identifiers, and schema.
- Mark AI-only findings as hypotheses.
- Require tests or a rerun of scanners to verify proposed fixes.
- Keep a human review step before applying changes.

### Unsafe automated remediation
**Threat:** An AI patch introduces a regression, weakens controls, or changes unrelated code.

**Controls:**
- Make suggested patches opt-in.
- Show diffs before application.
- Apply changes in a disposable workspace or branch.
- Run tests, formatters, and security scans after patching.
- Never deploy AI-generated fixes automatically in the MVP.

### Cross-tenant data access
**Threat:** A user asks questions about another user's scan or receives cached AI output from another tenant.

**Controls:**
- Enforce tenant authorization server-side on every read and write.
- Include tenant/project identifiers in cache keys.
- Test authorization boundaries and object-level access.
- Do not rely on model instructions as an access-control mechanism.

### Malicious archive and worker escape
**Threat:** Uploaded archives contain path traversal, decompression bombs, symlinks, or parser exploits.

**Controls:**
- Validate archive paths and reject traversal and unsafe links.
- Enforce compressed and expanded size, file-count, CPU, memory, and wall-clock limits.
- Run scanners in disposable, unprivileged, isolated workers.
- Disable network access by default.
- Keep worker images minimal and patched.
- Never execute submitted code in the MVP.

### Data poisoning and misleading evidence
**Threat:** A repository includes fake logs, forged scanner-like output, or crafted metadata intended to influence results.

**Controls:**
- Treat uploaded artifacts as untrusted.
- Distinguish tool-produced evidence from repository text.
- Record tool version and provenance.
- Never accept scanner findings supplied as plain repository text as trusted scanner results.

## 3. Security boundaries

- Browser: untrusted client.
- API: authentication, authorization, validation, quotas.
- Queue: authenticated job creation and controlled payloads.
- Scanner worker: isolated, least privilege, no default network.
- AI service: receives only bounded, authorized, redacted context.
- Database/object store: tenant-scoped access and encryption in transit/at rest where supported.

## 4. Minimum release gates

- [ ] Threat model reviewed before public beta.
- [ ] Archive traversal and decompression-limit tests pass.
- [ ] Prompt-injection test suite passes.
- [ ] Secret redaction tested with known fixtures.
- [ ] Cross-tenant authorization tests pass.
- [ ] AI output schema and evidence references validated.
- [ ] Logs are checked for accidental source/secret leakage.
- [ ] Model provider retention and training settings reviewed.
- [ ] Hosted AI can be disabled without disabling deterministic scanning.
- [ ] No automatic patch application or deployment is enabled by default.
