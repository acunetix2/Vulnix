"""Secret redaction applied before any snippet leaves the process."""

import re

# Order matters: more specific patterns first.
_PATTERNS: list[tuple[re.Pattern, str]] = [
    (
        re.compile(
            r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----", re.S
        ),
        "[REDACTED_PRIVATE_KEY]",
    ),
    (re.compile(r"AKIA[0-9A-Z]{16}"), "[REDACTED_AWS_KEY]"),
    (re.compile(r"ghp_[A-Za-z0-9]{20,}"), "[REDACTED_GITHUB_TOKEN]"),
    (re.compile(r"xox[baprs]-[A-Za-z0-9-]{10,}"), "[REDACTED_SLACK_TOKEN]"),
    (re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"), "[REDACTED_JWT]"),
    (
        re.compile(
            r"(?i)\b(password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\b\s*[:=]\s*[\"']?[^\s\"',;]{6,}"
        ),
        r"\1=[REDACTED]",
    ),
    (re.compile(r"postgres(?:ql)?://[^\s\"']+"), "[REDACTED_DB_URL]"),
]


def redact(text: str | None) -> str | None:
    """Mask likely secrets and credentials in free-form text."""
    if not text:
        return text
    for pattern, repl in _PATTERNS:
        text = pattern.sub(repl, text)
    return text
