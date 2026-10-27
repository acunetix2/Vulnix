from app.scanning.adapters.bandit import BanditAdapter
from app.scanning.adapters.base import ScannerAdapter, ToolRunResult
from app.scanning.adapters.dependencies import PipAuditAdapter, TrivyAdapter
from app.scanning.adapters.gitleaks import GitleaksAdapter
from app.scanning.adapters.semgrep import SemgrepAdapter


def build_adapters(options: dict) -> list[ScannerAdapter]:
    """Select adapters from scan options; never from client-supplied names.

    Every category defaults to off: an option the caller did not ask for must
    not run. The AI agent is the scanner, so a scan with no options at all
    builds no CLI adapters.
    """
    adapters: list[ScannerAdapter] = []
    if options.get("static_analysis", False):
        adapters.extend([SemgrepAdapter(), BanditAdapter()])
    if options.get("secrets", False):
        adapters.append(GitleaksAdapter())
    if options.get("dependencies", False):
        adapters.extend([PipAuditAdapter(), TrivyAdapter()])
    return adapters


__all__ = [
    "ScannerAdapter",
    "ToolRunResult",
    "SemgrepAdapter",
    "BanditAdapter",
    "GitleaksAdapter",
    "PipAuditAdapter",
    "TrivyAdapter",
    "build_adapters",
]
