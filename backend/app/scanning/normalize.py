"""Shared finding schema and fingerprinting.

Every scanner adapter converts raw tool output into `NormalizedFinding` here,
so the rest of the system never depends on a specific tool's format.
"""

import hashlib
import re
from dataclasses import dataclass, field
from typing import Any

_SECRET_CHARS = re.compile(r"[A-Za-z0-9_\-\/+=]{12,}")

SEVERITY_ORDER = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}


@dataclass
class NormalizedFinding:
    rule_id: str | None
    title: str
    category: str
    severity: str
    tool: str = ""  # filled by the adapter runner
    confidence: str = "unknown"
    file_path: str | None = None
    start_line: int | None = None
    end_line: int | None = None
    evidence: str | None = None
    scanner_message: str | None = None
    impact: str | None = None
    remediation: str | None = None
    # Only the agent fills this: a validated diff against the archived file.
    suggestion: dict[str, Any] | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def fingerprint(self) -> str:
        # Stable identity: tool + rule + path + location. Never raw secret values.
        basis = "|".join(
            [
                self.tool,
                self.rule_id or self.title,
                self.file_path or "",
                str(self.start_line or ""),
                str(self.end_line or ""),
                _SECRET_CHARS.sub("<val>", (self.scanner_message or "")[:200]),
            ]
        )
        return hashlib.sha256(basis.encode("utf-8")).hexdigest()


def normalize_severity(value: str | None, default: str = "info") -> str:
    if not value:
        return default
    v = value.strip().lower()
    aliases = {
        "error": "high",
        "warning": "medium",
        "warn": "medium",
        "note": "low",
        "critical": "critical",
        "high": "high",
        "medium": "medium",
        "moderate": "medium",
        "low": "low",
        "info": "info",
        "informational": "info",
        "unknown": "info",
    }
    return aliases.get(v, default)


def normalize_confidence(value: str | None) -> str:
    v = (value or "").strip().lower()
    return v if v in ("high", "medium", "low") else "unknown"


def clip_text(value: str | None, limit: int = 2000) -> str | None:
    """Bound evidence/message size so we store only what is needed."""
    if value is None:
        return None
    value = value.strip()
    return value[:limit] if value else None
