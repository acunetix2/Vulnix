# AI Evaluation and Quality Plan

## 1. Goals

Measure whether AI assistance improves security review without creating excessive false positives, unsafe fixes, or unjustified confidence.

## 2. Evaluation layers

1. **Deterministic scanner baseline:** measure each scanner independently before adding AI.
2. **Finding explanation quality:** assess correctness, evidence alignment, clarity, and usefulness.
3. **Triage quality:** assess severity rationale, confidence calibration, and prioritization.
4. **Remediation quality:** assess whether suggested changes address the issue without introducing regressions.
5. **AI-only review:** evaluate separately from scanner-backed findings.
6. **Security robustness:** test prompt injection, secret leakage, malformed output, and tenant isolation.

## 3. Test corpus

Use a mix of:
- small, intentionally vulnerable demonstration repositories;
- secure examples that should not trigger a finding;
- synthetic fixtures for known patterns;
- dependency and secret-scanning fixtures;
- language/framework examples supported by the MVP;
- adversarial prompt-injection examples in comments, Markdown, and string literals;
- sanitized, permissioned open-source projects where licenses and usage terms allow.

Track the provenance, license, expected findings, language, and test version for each case. Do not upload private customer repositories into a benchmark without explicit authorization.

## 4. Metrics

- **Precision:** true positives / all predicted positives.
- **Recall:** true positives / all expected positives.
- **False-positive rate:** false positives / all actual negatives.
- **Evidence accuracy:** percentage of claims supported by the cited code/tool evidence.
- **Location accuracy:** percentage of reported file/line locations that correctly identify relevant code.
- **Remediation acceptance:** percentage of suggested fixes accepted by qualified reviewers.
- **Fix verification pass rate:** percentage of patches that pass relevant tests and rerun scans.
- **Calibration:** whether high-confidence assessments are correct more often than medium/low-confidence assessments.
- **Latency and cost:** median and tail latency, model tokens/cost per scan, and cancellation behavior.
- **Robustness:** pass rate on prompt-injection, malformed output, and data-isolation tests.

Report results separately by language, finding category, scanner, and AI model. Do not hide weak categories inside a single aggregate score.

## 5. Human review rubric

For each sampled assessment, reviewers score 1–5:
- technical correctness;
- relevance to the actual code;
- evidence quality;
- severity rationale;
- remediation safety;
- clarity;
- appropriate uncertainty.

Reviewers should also mark whether the AI invented facts, missed key context, or followed malicious repository instructions.

## 6. Release criteria

Initial suggested gates (tune with pilot data):
- 100% of returned evidence references resolve to real evidence records.
- 0 known secret-leakage regressions in the release test suite.
- 0 cross-tenant data exposure in authorization tests.
- 100% of malformed model responses fail closed or are safely retried.
- AI-only findings are clearly labeled and never automatically treated as confirmed.
- No patch is auto-applied or deployed without explicit user action.
- A qualified reviewer approves the minimum benchmark quality for each supported language/category before public claims are made.

Do not advertise a universal detection rate until independently measured on a representative benchmark.

## 7. Continuous evaluation

- Version datasets and expected results.
- Run regression tests when prompts, models, scanners, or normalization change.
- Keep a small fast test suite for each commit and a larger scheduled suite.
- Track user feedback as a signal, not as ground truth.
- Review false negatives as well as false positives.
- Document model/provider version and prompt version for reproducibility.
