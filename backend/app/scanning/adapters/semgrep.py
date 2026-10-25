"""Semgrep static-analysis adapter (JS/TS, Python, Java and others)."""

from pathlib import Path

from app.core.config import settings
from app.scanning.adapters.base import ScannerAdapter
from app.scanning.normalize import NormalizedFinding, clip_text, normalize_severity

_SEVERITY_MAP = {"CRITICAL": "critical", "ERROR": "high", "WARNING": "medium", "INFO": "info"}


class SemgrepAdapter(ScannerAdapter):
    name = "semgrep"
    executable = settings.semgrep_path
    accept_exit_codes = (0, 1)  # exit 1 means findings were reported
    supported_file_types = (
        ".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".go", ".rb", ".php",
        ".c", ".cpp", ".cs", ".kt", ".swift", ".scala", ".rs",
    )

    def build_command(self, target_dir: Path) -> list[str]:
        return [
            self.executable,
            "scan",
            "--json",
            "--quiet",
            "--metrics=off",
            "--timeout",
            str(settings.scanner_timeout_seconds),
            "--config",
            settings.semgrep_config,
            str(target_dir),
        ]

    def parse(self, raw: dict | list | None) -> list[NormalizedFinding]:
        if not isinstance(raw, dict):
            return []
        findings = []
        for item in raw.get("results", []):
            extra = item.get("extra", {}) or {}
            findings.append(
                NormalizedFinding(
                    rule_id=item.get("check_id"),
                    title=(item.get("check_id") or "semgrep finding").split(".")[-1],
                    category="static_analysis",
                    severity=normalize_severity(
                        _SEVERITY_MAP.get(str(extra.get("severity", "")).upper(), "info")
                    ),
                    confidence="high",
                    file_path=item.get("path"),
                    start_line=(item.get("start") or {}).get("line"),
                    end_line=(item.get("end") or {}).get("line"),
                    evidence=clip_text(extra.get("lines")),
                    scanner_message=clip_text(extra.get("message")),
                    remediation=None,
                )
            )
        return findings
