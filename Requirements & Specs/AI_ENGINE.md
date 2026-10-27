# AI Engine Specification

## 1. Purpose

The AI engine is a first-class subsystem of SentinelCode. It converts scanner evidence and selected source context into useful, reviewable security analysis. It must complement deterministic tools, not replace them.

## 2. Responsibilities

- Explain findings in plain language and security-engineering language.
- Summarize plausible impact and attack prerequisites.
- Prioritize findings using scanner severity, reachability/context, asset sensitivity when known, and confidence.
- Suggest targeted remediations with minimal code changes.
- Identify likely false positives and explain why, without silently deleting findings.
- Answer questions about a scan using only authorized scan data.
- Optionally review selected code for patterns scanners may miss, while clearly marking AI-only hypotheses.

## 3. Analysis workflow

1. Accept normalized scanner findings and a bounded set of source snippets.
2. Remove or mask secrets and unnecessary personal/customer data before any external model call.
3. Construct a task-specific context bundle: language, framework, finding type, relevant code, data flow hints, and scanner evidence.
4. Ask the model for schema-constrained output.
5. Validate the response against a strict schema and known finding identifiers/line ranges.
6. Reject or repair malformed output; never trust model-generated severity or file paths without validation.
7. Store model/provider, model version, prompt version, timestamp, and validation result for auditability.
8. Present the result as an AI-assisted assessment linked to the original evidence.

## 4. Structured response contract

Each AI assessment should include:
- `finding_id`
- `summary`
- `why_it_matters`
- `attack_preconditions`
- `impact`
- `confidence` (low/medium/high)
- `severity_rationale`
- `remediation`
- `verification_steps`
- `false_positive_notes`
- `evidence_refs` (references to known evidence IDs only)
- `limitations`

The model must not invent evidence IDs, line numbers, packages, CVEs, or execution results. If evidence is insufficient, it must say so.

## 5. Model strategy

Use a provider abstraction so local and hosted models can be swapped without rewriting the application.

- **Hosted model option:** strong reasoning and code understanding, subject to provider pricing, retention, and data-processing terms.
- **Local model option:** available to a deployment that runs its own inference host, behind `VULNIX_AI_LOCAL_ENABLED`. It is off by default (ADR-017): the product's reviewers are hosted, and listing a model the host has not pulled would let a workspace choose a reviewer that cannot answer. More control over code privacy and recurring API cost, but requires suitable hardware and may provide weaker results depending on model and context.
- **Hybrid option:** run deterministic scanners locally; send only redacted, minimal evidence to a hosted model when configured and permitted.

Never hard-code provider credentials. Use environment variables or a secrets manager. Add per-user/project quotas, timeouts, retries with limits, and budget controls.

### 5.1 As implemented — selection, handover and provenance

See ADR-008 for the selection rules, ADR-015 for the reviewer chain behind these, and ADR-016 for how a refusal is told apart from an outage and how a crash is recorded.

- The offered model list is discovered from each provider's own list endpoint and intersected with a vetted candidate list, cached briefly. A model no provider reported is never shown, so an empty picker means nothing answered rather than a control that lies. A deployment that has not enabled local inference is not asked at all, so nothing local can be shown or chosen (ADR-017).
- A workspace stores a catalog entry id, not a model name. The id is re-validated against the live catalog on every write and every call; a preference that becomes unreachable falls back to the server default instead of failing.
- Three hosted reviewers speak the same OpenAI-compatible chat API, each with its own credential, address, timeout and context window. A key is never sent to a host that was not given it. Any configured reviewer can be primary and any can take over from another: the chain leads with the failover provider named in the environment and continues through the remaining reviewers that hold a credential, each constructed only when the handover reaches it.
- Handover happens on an outage, a refusal, or a file wider than that reviewer's window — but only the first two park a reviewer. An outage or a refusal is the reviewer's own state, so it is parked for `ai_provider_cooldown_seconds` and the chain steps past it, which keeps a long audit from paying its timeout once per retry. Running out of window is the file's state, so the next link is asked without benching the reviewer that declined: it is still the best candidate for the files that do fit. Only a call that answered is charged, so a handover costs no credit.
- A refusal is separated from an outage by the reviewer's own short reason code (`error.code`, `error.type` or `error.status`), read from the error body and matched against a bounded token. Its message is discarded, because a refusal often quotes the prompt back and a prompt contains somebody's source code.
- An audit's retry loop waits for the earliest reviewer it has already reached to come out of cooldown, rather than sleeping its backoff and asking a parked one again. A live run that lacked this spent seven retries and 46 seconds making no request at all, then failed the file anyway.
- Two bounds keep a free tier from being spent by accident: every hosted reply is capped in output tokens, and a prompt is measured against the reviewer's window and refused before the request is sent, so a guaranteed failure is never billed. A reply that hits the cap is reported as truncated, not re-asked of another reviewer.
- A model asked of a reviewer that is taking over is checked against what that account actually has, so a handover never spends its one attempt on a name the provider does not recognise. A reviewer whose listing confirms nothing is skipped with no request and no cooldown: a guessed name is refused, and a refusal would park a reviewer that was perfectly able to answer the next file.
- Stored explanations record the answering provider and model alongside the entry that was requested, plus prompt version, validation result, latency and token counts. Those columns are internal provenance; a client sees only the Vulnix alias for whichever reviewer replied.
- Each attempt writes one usage row holding counters and identifiers only. The daily quota is counted from those rows, so a restart cannot reset an allowance; a failed attempt consumes quota without earning a credit.

## 6. Prompt and context design

- Separate system instructions, trusted application metadata, scanner evidence, and untrusted source code.
- Explicitly label code comments, README text, filenames, and repository content as untrusted data, not instructions.
- Use least-context retrieval: only include relevant snippets and nearby definitions.
- Do not include entire repositories by default.
- Require evidence-linked conclusions and an explicit uncertainty field.
- Keep prompt templates versioned and tested.
- Avoid asking the model to expose hidden reasoning; request concise conclusions, evidence, and rationale instead.

## 7. AI-only review

AI-only findings must be visibly distinguished from scanner-confirmed findings. They should include:
- a hypothesis and supporting code evidence;
- confidence and limitations;
- suggested manual validation;
- no claim that an exploit was executed or confirmed unless a separate authorized test actually did so.

## 8. Cost and performance controls

- Cache analysis by content hash plus prompt/model version where appropriate.
- Use asynchronous jobs for large scans.
- Limit file count, file size, context length, and concurrent model calls.
- Provide a maximum scan budget and graceful cancellation.
- Track token usage and latency without logging source code or secrets.
- Allow a deployment to disable AI analysis entirely, and to opt into running its own model (ADR-017).

## 9. Acceptance checks

- Invalid model output is rejected safely.
- Evidence references are checked against the scan database.
- Source code is treated as untrusted input.
- No model call occurs when hosted AI is disabled.
- Budget, timeout, and cancellation limits are enforced.
- AI-only hypotheses are never presented as verified vulnerabilities.
