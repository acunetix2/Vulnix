from app.scanning.adapters.bandit import BanditAdapter
from app.scanning.adapters.base import ScannerAdapter, ToolRunResult
from app.scanning.adapters.dependencies import PipAuditAdapter, TrivyAdapter
from app.scanning.adapters.gitleaks import GitleaksAdapter
from app.scanning.adapters.semgrep import SemgrepAdapter


def build_adapters(options: dict) -> list[ScannerAdapter]:
    """Select adapters from scan options; never from client-supplied names."""
    adapters: list[ScannerAdapter] = []
    if options.get("static_analysis", True):
        adapters.extend([SemgrepAdapter(), BanditAdapter()])
    if options.get("secrets", True):
        adapters.append(GitleaksAdapter())
    if options.get("dependencies", True):
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
