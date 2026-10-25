"""Dependency vulnerability adapters (pip-audit for Python, Trivy for mixed stacks).

Advisory lookups may require controlled network access from the worker;
run these adapters in an environment where that is explicitly allowed.
"""

from pathlib import Path

from app.core.config import settings
from app.scanning.adapters.base import ScannerAdapter, ToolRunResult
from app.scanning.normalize import NormalizedFinding, clip_text

_MANIFEST_NAMES = ("requirements.txt", "requirements-dev.txt", "poetry.lock", "Pipfile.lock")


def _find_manifests(target_dir: Path, limit: int = 5) -> list[Path]:
    found = []
    for name in _MANIFEST_NAMES:
        found.extend(sorted(target_dir.rglob(name))[:limit])
        if len(found) >= limit:
            break
    return found[:limit]


class PipAuditAdapter(ScannerAdapter):
    name = "pip-audit"
    executable = settings.pip_audit_path
    accept_exit_codes = (0, 1)  # exit 1 means vulnerable dependencies were found
    supported_file_types = ("requirements*.txt", "poetry.lock", "Pipfile.lock")

    def run(self, target_dir: Path) -> ToolRunResult:
        manifests = _find_manifests(target_dir)
        if not manifests:
            return ToolRunResult(
                tool_name=self.name, tool_version=None, status="skipped", error_code="NO_MANIFEST"
            )
        return super().run(target_dir)

    def build_command(self, target_dir: Path) -> list[str]:
        # Base runner calls this once; we override run() above for multi-manifest.
        # Fallback: audit the first manifest if invoked directly.
        manifests = _find_manifests(target_dir)
        target = manifests[0] if manifests else target_dir
        return [
            self.executable,
            "-r",
            str(target),
            "--format",
            "json",
            "--progress-spinner",
            "off",
            "--no-deps",
        ]

    def parse(self, raw: dict | list | None) -> list[NormalizedFinding]:
        if not isinstance(raw, dict):
            return []
        findings = []
        for dep in raw.get("dependencies", []):
            for vuln in dep.get("vulns", []):
                vuln_id = vuln.get("id") or "UNKNOWN"
                findings.append(
                    NormalizedFinding(
                        rule_id=vuln_id,
                        title=f"{dep.get('name')} {dep.get('version')} affected by {vuln_id}",
                        category="dependencies",
                        severity="medium",
                        confidence="high",
                        file_path=None,
                        evidence=clip_text(f"Package: {dep.get('name')} {dep.get('version')}"),
                        scanner_message=clip_text(vuln.get("description"), 1000) or (
                            f"Vulnerable dependency: {vuln_id}"
                        ),
                        remediation="Upgrade to a non-affected version: "
                        + (", ".join(vuln.get("fix_versions") or []) or "see advisory"),
                    )
                )
        return findings


class TrivyAdapter(ScannerAdapter):
    name = "trivy"
    executable = settings.trivy_path
    accept_exit_codes = (0, 1)
    supported_file_types = (
        "package-lock.json", "requirements.txt", "go.mod", "Cargo.toml",
        "Gemfile.lock", "pom.xml", "build.gradle",
    )

    def build_command(self, target_dir: Path) -> list[str]:
        return [
            self.executable,
            "fs",
            "--format",
            "json",
            "--scanners",
            "vuln",
            "--quiet",
            str(target_dir),
        ]

    def parse(self, raw: dict | list | None) -> list[NormalizedFinding]:
        if not isinstance(raw, dict):
            return []
        findings = []
        for result in raw.get("Results", []) or []:
            target = result.get("Target")
            for vuln in result.get("Vulnerabilities", []) or []:
                findings.append(
                    NormalizedFinding(
                        rule_id=vuln.get("VulnerabilityID"),
                        title=clip_text(vuln.get("Title"), 200) or vuln.get(
                            "VulnerabilityID", "Vulnerability"
                        ),
                        category="dependencies",
                        severity=(vuln.get("Severity") or "medium").lower(),
                        confidence="high",
                        file_path=target,
                        evidence=clip_text(
                            f"Pkg: {vuln.get('PkgName')} {vuln.get('InstalledVersion')}"
                        ),
                        scanner_message=clip_text(vuln.get("Description"), 1000),
                        remediation="Fixed versions: " + (vuln.get("FixedVersion") or "see advisory"),
                    )
                )
        return findings
