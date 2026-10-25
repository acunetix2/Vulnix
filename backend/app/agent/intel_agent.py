"""IntelAgent — specialist agent for CVE/RCE and Threat Intelligence enrichment.

Enriches high and critical findings by scraping/querying external security feeds:
- NIST NVD for CVSS severity scores and CVE metadata
- FIRST.org EPSS for active exploitation probability scores & percentiles
- OSV.dev for open-source ecosystem vulnerability advisories and fixed versions

Runs concurrently via AgentRouter and merges intelligence context directly into
the finding.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from app.agent.mcp.tools import (
    ThreatIntelResult,
    extract_cves,
    lookup_cve,
    lookup_epss,
    lookup_osv,
)
from app.agent.router import register_agent
from app.scanning.normalize import NormalizedFinding

logger = logging.getLogger("vulnix.agent.intel")

# Detect package name and version from evidence or scanner messages
# e.g. "requests==2.28.0" or "lodash@4.17.20"
_PKG_PATTERN = re.compile(
    r"\b([a-zA-Z0-9_\-\.]+)\s*(?:==|@|<=|<|>=)\s*([0-9]+\.[0-9]+(?:\.[0-9a-zA-Z_\-]+)?)\b"
)


class IntelAgent:
    """Threat intelligence enrichment agent."""

    name = "intel"

    def run(self, finding: NormalizedFinding) -> list[NormalizedFinding]:
        """Inspect *finding*, look up threat intelligence, and attach context."""
        try:
            intel = self._analyze(finding)
            if intel.cve_ids or intel.advisories or intel.summary:
                if not finding.extra:
                    finding.extra = {}
                finding.extra["intel"] = intel.to_dict()
                logger.info(
                    "intel_enriched rule=%s cves=%s epss=%s",
                    finding.rule_id,
                    intel.cve_ids,
                    intel.epss_max,
                )
        except Exception as exc:
            logger.warning("intel_agent_failed rule=%s err=%s", finding.rule_id, exc)

        return [finding]

    def _analyze(self, finding: NormalizedFinding) -> ThreatIntelResult:
        full_text = " ".join(
            filter(
                None,
                [
                    finding.rule_id or "",
                    finding.title or "",
                    finding.evidence or "",
                    finding.scanner_message or "",
                    finding.impact or "",
                ],
            )
        )

        cve_ids = extract_cves(full_text)
        advisories: list[dict[str, Any]] = []
        cve_records: list[dict[str, Any]] = []

        # If it's a dependency finding or text mentions a package version, query OSV
        pkg_matches = _PKG_PATTERN.findall(full_text)
        if pkg_matches and not cve_ids:
            pkg_name, pkg_ver = pkg_matches[0]
            ecosystem = "npm" if (finding.file_path and "package.json" in finding.file_path) else "PyPI"
            osv_records = lookup_osv(pkg_name, pkg_ver, ecosystem=ecosystem)
            for rec in osv_records:
                advisories.append({
                    "id": rec.id,
                    "summary": rec.summary,
                    "fixed_versions": rec.fixed_versions,
                    "references": rec.references,
                })
                # Check if advisory references a CVE
                found_cves = extract_cves(f"{rec.id} {rec.summary} {rec.details}")
                for c in found_cves:
                    if c not in cve_ids:
                        cve_ids.append(c)

        # Query EPSS exploit probabilities for all identified CVEs
        epss_records = lookup_epss(cve_ids) if cve_ids else {}

        epss_max: float | None = None
        epss_percentile_max: float | None = None
        cvss_max: float | None = None
        has_known_exploit = False

        for cve_id in cve_ids[:3]:
            cve_rec = lookup_cve(cve_id)
            if cve_rec:
                cve_records.append({
                    "cve_id": cve_rec.cve_id,
                    "description": cve_rec.description,
                    "cvss_score": cve_rec.cvss_score,
                    "cvss_severity": cve_rec.cvss_severity,
                })
                if cve_rec.cvss_score is not None:
                    if cvss_max is None or cve_rec.cvss_score > cvss_max:
                        cvss_max = cve_rec.cvss_score

            epss = epss_records.get(cve_id)
            if epss:
                if epss_max is None or epss.epss_score > epss_max:
                    epss_max = epss.epss_score
                if epss_percentile_max is None or epss.epss_percentile > epss_percentile_max:
                    epss_percentile_max = epss.epss_percentile
                if epss.epss_score >= 0.15:
                    has_known_exploit = True

        # Synthesize brief summary
        summary_parts: list[str] = []
        if cve_ids:
            summary_parts.append(f"Identified CVEs: {', '.join(cve_ids)}")
        if cvss_max:
            summary_parts.append(f"CVSS {cvss_max:.1f}")
        if epss_max is not None:
            pct_text = f" (top {(1.0 - epss_percentile_max)*100:.0f}% probability)" if epss_percentile_max else ""
            summary_parts.append(f"EPSS exploit probability: {epss_max:.1%}{pct_text}")
        if has_known_exploit:
            summary_parts.append("Elevated in-the-wild exploitation activity")
        if advisories:
            summary_parts.append(f"{len(advisories)} vendor advisory match(es)")

        return ThreatIntelResult(
            cve_ids=cve_ids,
            cvss_max=cvss_max,
            epss_max=epss_max,
            epss_percentile_max=epss_percentile_max,
            has_known_exploit=has_known_exploit,
            advisories=advisories,
            cve_records=cve_records,
            summary=" · ".join(summary_parts),
        )


def _intel_agent_dispatch(finding: NormalizedFinding) -> list[NormalizedFinding]:
    return IntelAgent().run(finding)


# Register IntelAgent with the AgentRouter
register_agent("intel", _intel_agent_dispatch)

__all__ = ["IntelAgent"]
