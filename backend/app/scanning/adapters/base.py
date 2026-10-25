"""Scanner adapter base.

Adapters never receive client-controlled arguments: executable paths and flags
are fixed in configuration. Commands are always argv arrays, never shell
strings. Submitted project code is never executed.
"""

import json
import logging
import os
import shutil
import subprocess
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path

from app.core.config import settings
from app.scanning.normalize import NormalizedFinding

logger = logging.getLogger("vulnix.scanners")


@dataclass
class ToolRunResult:
    tool_name: str
    tool_version: str | None
    status: str  # succeeded | failed | timed_out | skipped
    exit_code: int | None = None
    duration_ms: int = 0
    findings: list[NormalizedFinding] = field(default_factory=list)
    error_code: str | None = None
    raw_json: dict | list | None = None


class ScannerAdapter(ABC):
    """Interface every security tool adapter implements."""

    name: str = "scanner"
    executable: str = "true"
    accept_exit_codes: tuple[int, ...] = (0,)
    supported_file_types: tuple[str, ...] = ()  # e.g. (".py",) — interface per ARCHITECTURE §6

    def resolve(self) -> str | None:
        return shutil.which(self.executable)

    def available(self) -> bool:
        return self.resolve() is not None

    def version(self) -> str | None:
        exe = self.resolve()
        if not exe:
            return None
        try:
            proc = subprocess.run(  # noqa: S603 - fixed argv, no shell
                [exe, "--version"], capture_output=True, text=True, timeout=15, env=self.sandbox_env(exe)
            )
            out = (proc.stdout or proc.stderr).strip().splitlines()
            return out[0][:64] if out else None
        except Exception:
            return None

    def run(self, target_dir: Path) -> ToolRunResult:
        exe = self.resolve()
        if not exe:
            return ToolRunResult(
                tool_name=self.name, tool_version=None, status="skipped", error_code="TOOL_UNAVAILABLE"
            )
        # Always exec the resolved absolute path, never a client-influenced name.
        command = [exe, *self.build_command(target_dir)[1:]]
        start = time.monotonic()
        try:
            proc = subprocess.run(  # noqa: S603 - fixed argv, no shell
                command,
                capture_output=True,
                text=True,
                timeout=settings.scanner_timeout_seconds,
                cwd=str(target_dir),
                env=self.sandbox_env(exe),
            )
        except subprocess.TimeoutExpired:
            return ToolRunResult(
                tool_name=self.name,
                tool_version=self.version(),
                status="timed_out",
                duration_ms=int((time.monotonic() - start) * 1000),
                error_code="TIMEOUT",
            )
        except OSError:
            logger.warning("scanner_exec_failed tool=%s", self.name)
            return ToolRunResult(
                tool_name=self.name, tool_version=None, status="failed", error_code="EXEC_FAILED"
            )

        duration = int((time.monotonic() - start) * 1000)
        if proc.returncode not in self.accept_exit_codes:
            logger.warning("scanner_failed tool=%s exit=%s", self.name, proc.returncode)
            return ToolRunResult(
                tool_name=self.name,
                tool_version=self.version(),
                status="failed",
                exit_code=proc.returncode,
                duration_ms=duration,
                error_code="NONZERO_EXIT",
            )
        try:
            raw = json.loads(proc.stdout or "null")
        except json.JSONDecodeError:
            return ToolRunResult(
                tool_name=self.name,
                tool_version=self.version(),
                status="failed",
                exit_code=proc.returncode,
                duration_ms=duration,
                error_code="BAD_OUTPUT",
            )
        findings = self.normalize(raw)
        return ToolRunResult(
            tool_name=self.name,
            tool_version=self.version(),
            status="succeeded",
            exit_code=proc.returncode,
            duration_ms=duration,
            findings=findings,
            raw_json=raw if isinstance(raw, (dict, list)) else None,
        )

    def sandbox_env(self, exe_path: str) -> dict[str, str]:
        # Minimal environment: no inherited secrets or proxy settings.
        exe_dir = os.path.dirname(exe_path)
        if os.name == "nt":
            system_root = os.environ.get("SystemRoot", r"C:\Windows")
            path = os.pathsep.join([exe_dir, str(Path(system_root) / "System32")])
        else:
            path = os.pathsep.join([exe_dir, "/usr/local/bin", "/usr/bin", "/bin"])
        return {
            "PATH": path,
            "HOME": "/tmp",
            "LANG": "C.UTF-8",
            "NO_COLOR": "1",
            "PYTHONDONTWRITEBYTECODE": "1",
        }

    @abstractmethod
    def build_command(self, target_dir: Path) -> list[str]: ...

    @abstractmethod
    def parse(self, raw: dict | list | None) -> list[NormalizedFinding]: ...

    def normalize(self, raw: dict | list | None) -> list[NormalizedFinding]:
        """Parse tool output and stamp provenance used by fingerprints/filters."""
        findings = self.parse(raw)
        for finding in findings:
            finding.tool = self.name
        return findings
