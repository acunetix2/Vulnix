"""Gitleaks secret-detection adapter.

Gitleaks runs with --redact so raw secret values never reach our process
output, database, logs, or AI prompts.
"""

from pathlib import Path

from app.core.config import settings
from app.scanning.adapters.base import ScannerAdapter
from app.scanning.normalize import NormalizedFinding, clip_text


class GitleaksAdapter(ScannerAdapter):
    name = "gitleaks"
    executable = settings.gitleaks_path
    accept_exit_codes = (0, 1)  # exit 1 means leaks were found
    supported_file_types = ("*",)  # inspects all files for credential patterns

    def build_command(self, target_dir: Path) -> list[str]:
        return [
            self.executable,
            "detect",
            "--source",
            str(target_dir),
            "--report-format",
            "json",
            "--redact",
            "--no-banner",
            "--exit-code",
            "1",
        ]

    def parse(self, raw: dict | list | None) -> list[NormalizedFinding]:
        if not isinstance(raw, list):
            return []
        findings = []
        for item in raw:
            # Evidence never includes the secret itself, only rule and location.
            evidence = f"Rule: {item.get('RuleID', 'unknown')}"
            findings.append(
                NormalizedFinding(
                    rule_id=item.get("RuleID"),
                    title=clip_text(item.get("Description"), 200) or "Exposed secret",
                    category="secrets",
                    severity="high",
                    confidence="high",
                    file_path=item.get("File"),
                    start_line=item.get("StartLine"),
                    end_line=item.get("EndLine"),
                    evidence=evidence,
                    scanner_message=clip_text(f"Potential secret detected by rule {item.get('RuleID')}"),
                    remediation=(
                        "Revoke the exposed credential, then remove it from the codebase and history."
                    ),
                )
            )
        return findings
