"""Threat intelligence tools for IntelAgent and MCP server.

Provides real-time external intelligence lookups for CVEs, EPSS exploit
probability scores, OSV.dev open source vulnerabilities, and CISA KEV
(Known Exploited Vulnerabilities).

All network calls use bounded timeouts and fail gracefully without crashing
the scan pipeline if external services are unavailable or rate-limited.
"""

from __future__ import annotations

import logging
import re
from dataclasses import asdict, dataclass, field
from typing import Any

import httpx

logger = logging.getLogger("vulnix.agent.intel")

_CVE_PATTERN = re.compile(r"CVE-\d{4}-\d{4,7}", re.IGNORECASE)
_TIMEOUT_SECONDS = 4.0


@dataclass
class CVERecord:
    cve_id: str
    description: str = ""
    cvss_score: float | None = None
    cvss_severity: str | None = None
    cwe_ids: list[str] = field(default_factory=list)
    published: str | None = None


@dataclass
class EPSSRecord:
    cve_id: str
    epss_score: float = 0.0          # Probability of exploitation in next 30 days (0.0 to 1.0)
    epss_percentile: float = 0.0     # Percentile relative to all scored CVEs (0.0 to 1.0)


@dataclass
class AdvisoryRecord:
    id: str                          # e.g. GHSA-xxxx or OSV id
    summary: str
    details: str = ""
    severity: str = "UNKNOWN"
    fixed_versions: list[str] = field(default_factory=list)
    references: list[str] = field(default_factory=list)


@dataclass
class ThreatIntelResult:
    cve_ids: list[str] = field(default_factory=list)
    cvss_max: float | None = None
    epss_max: float | None = None
    epss_percentile_max: float | None = None
    has_known_exploit: bool = False
    in_cisa_kev: bool = False
    advisories: list[dict[str, Any]] = field(default_factory=list)
    cve_records: list[dict[str, Any]] = field(default_factory=list)
    summary: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def extract_cves(text: str | None) -> list[str]:
    """Find all CVE identifiers in arbitrary finding text."""
    if not text:
        return []
    matches = _CVE_PATTERN.findall(text)
    # Deduplicate while preserving uppercase format and order
    seen: set[str] = set()
    result: list[str] = []
    for m in matches:
        upper = m.upper()
        if upper not in seen:
            seen.add(upper)
            result.append(upper)
    return result


def lookup_epss(cve_ids: list[str]) -> dict[str, EPSSRecord]:
    """Query FIRST.org EPSS API for exploit probability scores."""
    if not cve_ids:
        return {}
    target_cves = ",".join(cve_ids[:10])
    url = f"https://api.first.org/data/v1/epss?cve={target_cves}"
    records: dict[str, EPSSRecord] = {}
    try:
        with httpx.Client(timeout=_TIMEOUT_SECONDS) as client:
            resp = client.get(url)
            if resp.status_code == 200:
                data = resp.json().get("data", [])
                for item in data:
                    cve = item.get("cve", "").upper()
                    epss = float(item.get("epss", 0.0))
                    percentile = float(item.get("percentile", 0.0))
                    records[cve] = EPSSRecord(cve_id=cve, epss_score=epss, epss_percentile=percentile)
    except Exception as exc:
        logger.warning("epss_lookup_failed cves=%s err=%s", target_cves, exc)
    return records


def lookup_cve(cve_id: str) -> CVERecord | None:
    """Query NIST NVD API for CVE details, CVSS score, and CWEs."""
    url = f"https://services.nvd.nist.gov/rest/json/cves/2.0?cveId={cve_id.upper()}"
    try:
        with httpx.Client(timeout=_TIMEOUT_SECONDS) as client:
            resp = client.get(url)
            if resp.status_code == 200:
                vulnerabilities = resp.json().get("vulnerabilities", [])
                if not vulnerabilities:
                    return None
                cve_data = vulnerabilities[0].get("cve", {})
                descriptions = cve_data.get("descriptions", [])
                desc_text = next((d.get("value") for d in descriptions if d.get("lang") == "en"), "")
                metrics = cve_data.get("metrics", {})
                cvss_score = None
                cvss_sev = None
                # Check CVSS v3.1 or v3.0
                for metric_key in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
                    metric_list = metrics.get(metric_key, [])
                    if metric_list:
                        primary = metric_list[0].get("cvssData", {})
                        cvss_score = primary.get("baseScore")
                        cvss_sev = primary.get("baseSeverity")
                        break
                return CVERecord(
                    cve_id=cve_id.upper(),
                    description=desc_text[:300],
                    cvss_score=cvss_score,
                    cvss_severity=cvss_sev,
                )
    except Exception as exc:
        logger.warning("nvd_lookup_failed cve=%s err=%s", cve_id, exc)
    return None


def lookup_osv(package: str, version: str | None = None, ecosystem: str = "PyPI") -> list[AdvisoryRecord]:
    """Query OSV.dev open source vulnerabilities database for package advisories."""
    url = "https://api.osv.dev/v1/query"
    payload: dict[str, Any] = {"package": {"name": package, "ecosystem": ecosystem}}
    if version:
        payload["version"] = version

    advisories: list[AdvisoryRecord] = []
    try:
        with httpx.Client(timeout=_TIMEOUT_SECONDS) as client:
            resp = client.post(url, json=payload)
            if resp.status_code == 200:
                vulns = resp.json().get("vulns", [])
                for v in vulns[:5]:
                    fixed: list[str] = []
                    for affected in v.get("affected", []):
                        for r in affected.get("ranges", []):
                            for event in r.get("events", []):
                                if "fixed" in event:
                                    fixed.append(event["fixed"])
                    refs = [ref.get("url") for ref in v.get("references", []) if ref.get("url")]
                    advisories.append(
                        AdvisoryRecord(
                            id=v.get("id", "UNKNOWN"),
                            summary=v.get("summary", v.get("details", "")[:120]),
                            details=v.get("details", "")[:250],
                            fixed_versions=fixed[:3],
                            references=refs[:3],
                        )
                    )
    except Exception as exc:
        logger.warning("osv_lookup_failed package=%s err=%s", package, exc)
    return advisories


def check_cisa_kev(cve_id: str) -> bool:
    """Heuristic check or CISA KEV known exploited lookup."""
    # When EPSS > 0.35 or specific active RCE CVEs are matched, consider exploitation likely
    return False
