"""Tests for AgentRouter, specialist sub-agents, and threat intelligence enrichment."""

from app.agent.dep_agent import DepAgent
from app.agent.intel_agent import IntelAgent
from app.agent.mcp.tools import extract_cves
from app.agent.router import AgentRouter, RoutingDecision
from app.scanning.normalize import NormalizedFinding


def _sample_finding(
    severity: str = "high",
    category: str = "static_analysis",
    rule_id: str = "sql-injection",
    title: str = "SQL Injection in auth",
    evidence: str = "SELECT * FROM users WHERE id = ' + uid",
) -> NormalizedFinding:
    return NormalizedFinding(
        rule_id=rule_id,
        title=title,
        category=category,
        severity=severity,
        file_path="src/auth.py",
        start_line=42,
        end_line=44,
        evidence=evidence,
    )


def test_routing_decision_priorities_and_agents() -> None:
    # Critical SAST finding -> routed to intel agent for CVE/threat enrichment
    crit = _sample_finding(severity="critical")
    decision_crit = RoutingDecision.for_finding(crit)
    assert "intel" in decision_crit.agents
    assert decision_crit.priority == 0

    # Dependency finding -> routed to dep agent
    dep = _sample_finding(severity="medium", category="dependencies")
    decision_dep = RoutingDecision.for_finding(dep)
    assert "dep" in decision_dep.agents


def test_extract_cves() -> None:
    text = "Vulnerable to CVE-2023-38545 and cve-2024-12345 in libcurl"
    cves = extract_cves(text)
    assert cves == ["CVE-2023-38545", "CVE-2024-12345"]


def test_intel_agent_enrichment_from_text() -> None:
    finding = _sample_finding(
        severity="critical",
        title="Vulnerable dependency",
        evidence="CVE-2021-44228 Log4j JNDI RCE vulnerability detected",
    )
    agent = IntelAgent()
    enriched = agent.run(finding)
    assert len(enriched) == 1
    assert "intel" in enriched[0].extra
    intel_data = enriched[0].extra["intel"]
    assert "CVE-2021-44228" in intel_data["cve_ids"]
    assert intel_data["has_known_exploit"] is True


def test_dep_agent_enrichment() -> None:
    finding = _sample_finding(
        severity="high",
        category="dependencies",
        title="Outdated dependency",
        evidence="requests==2.20.0",
    )
    agent = DepAgent()
    enriched = agent.run(finding)
    assert len(enriched) == 1
    assert "dep" in enriched[0].extra
    assert enriched[0].extra["dep"]["category"] == "SCA"


def test_router_fan_out_and_merge() -> None:
    f1 = _sample_finding(
        severity="critical",
        rule_id="rce-log4j",
        title="Log4j RCE",
        evidence="CVE-2021-44228 JNDI lookup",
    )
    f2 = _sample_finding(
        severity="low",
        rule_id="info-comment",
        title="TODO in code",
    )

    router = AgentRouter(max_workers=4)
    merged, outcome = router.run([f1, f2])

    assert outcome.decisions == 2
    assert outcome.merged_findings == 2
    # Critical should be sorted first
    assert merged[0].severity == "critical"
    # Intel agent should have enriched the critical CVE finding
    assert "intel" in merged[0].extra
    assert "CVE-2021-44228" in merged[0].extra["intel"]["cve_ids"]
