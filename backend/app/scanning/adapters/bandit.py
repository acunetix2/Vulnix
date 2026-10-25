"""Bandit adapter for Python-focused security checks."""

from pathlib import Path

from app.core.config import settings
from app.scanning.adapters.base import ScannerAdapter
from app.scanning.normalize import NormalizedFinding, clip_text, normalize_confidence, normalize_severity


class BanditAdapter(ScannerAdapter):
    name = "bandit"
    executable = settings.bandit_path
    accept_exit_codes = (0, 1)  # exit 1 means issues were found
    supported_file_types = (".py",)

    def build_command(self, target_dir: Path) -> list[str]:
        return [self.executable, "-r", str(target_dir), "-f", "json", "-q"]

    def parse(self, raw: dict | list | None) -> list[NormalizedFinding]:
        if not isinstance(raw, dict):
            return []
        findings = []
        for item in raw.get("results", []):
            findings.append(
                NormalizedFinding(
                    rule_id=item.get("test_id"),
                    title=item.get("test_name") or "Bandit finding",
                    category="static_analysis",
                    severity=normalize_severity(item.get("issue_severity")),
                    confidence=normalize_confidence(item.get("issue_confidence")),
                    file_path=item.get("filename"),
                    start_line=item.get("line_number"),
                    end_line=item.get("line_number"),
                    evidence=clip_text(item.get("code")),
                    scanner_message=clip_text(item.get("issue_text")),
                    remediation=clip_text(item.get("more_info")),
                )
            )
        return findings
