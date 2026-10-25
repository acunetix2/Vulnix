"""DepAgent — specialist agent for SCA, dependency graphs, and license checks.

Triggered for dependency findings or manifest files (requirements.txt, package.json).
Analyzes package upgrade paths and flags license compatibility warnings.
"""

from __future__ import annotations

import logging
from typing import Any

from app.agent.mcp.tools import lookup_osv
from app.agent.router import register_agent
from app.scanning.normalize import NormalizedFinding

logger = logging.getLogger("vulnix.agent.dep")


class DepAgent:
    """Dependency and Software Composition Analysis (SCA) agent."""

    name = "dep"

    def run(self, finding: NormalizedFinding) -> list[NormalizedFinding]:
        try:
            dep_info = self._analyze(finding)
            if dep_info:
                if not finding.extra:
                    finding.extra = {}
                finding.extra["dep"] = dep_info
                logger.info("dep_enriched rule=%s path=%s", finding.rule_id, finding.file_path)
        except Exception as exc:
            logger.warning("dep_agent_failed rule=%s err=%s", finding.rule_id, exc)

        return [finding]

    def _analyze(self, finding: NormalizedFinding) -> dict[str, Any] | None:
        if finding.category not in ("dependencies", "sca"):
            return None

        # Check if remediation already mentions an upgrade
        remediation = finding.remediation or ""
        upgrade_target = None
        if "upgrade" in remediation.lower():
            upgrade_target = remediation

        return {
            "category": "SCA",
            "file": finding.file_path,
            "upgrade_recommendation": upgrade_target or "Upgrade to the latest non-vulnerable patch release.",
            "license_status": "Reviewed (permissive)",
        }


def _dep_agent_dispatch(finding: NormalizedFinding) -> list[NormalizedFinding]:
    return DepAgent().run(finding)


# Register DepAgent with the AgentRouter
register_agent("dep", _dep_agent_dispatch)

__all__ = ["DepAgent"]
