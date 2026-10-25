"""Agent router — Phase 1.

Decides which specialist sub-agents handle each finding, dispatches them
concurrently, then merges their outputs into one deduplicated list.

Phase 1 ships one agent (CodeAgent, the existing review loop) and wires the
severity -> model assignment that was previously a single global setting.  The
IntelAgent (CVE/EPSS) and DepAgent (SCA/license) slots are defined here so
Phase 2 can drop them in without touching the router's public surface.

Nothing here is async: the existing pipeline runs in a synchronous worker.
Concurrency inside one audit run uses threads, gated by a semaphore so the
host's model connections stay bounded.
"""

from __future__ import annotations

import concurrent.futures
import logging
import threading
from dataclasses import dataclass, field
from typing import Any, Callable

from app.core.config import settings
from app.scanning.normalize import NormalizedFinding

logger = logging.getLogger("vulnix.agent.router")

# --- severity ordering -------------------------------------------------------

_SEVERITY_RANK: dict[str, int] = {
    "critical": 0,
    "high":     1,
    "medium":   2,
    "low":      3,
    "info":     4,
}


def _severity_rank(sev: str) -> int:
    return _SEVERITY_RANK.get(sev, 99)


# --- routing decision --------------------------------------------------------


@dataclass(frozen=True)
class RoutingDecision:
    """Which agents handle one finding, and in what priority order."""

    finding: NormalizedFinding
    agents: tuple[str, ...]   # ordered: "code", "intel", "dep"
    priority: int             # 0 = critical (run first)

    @classmethod
    def for_finding(cls, f: NormalizedFinding) -> "RoutingDecision":
        agents: list[str] = ["code"]
        if f.severity in ("critical", "high"):
            agents.append("intel")          # Phase 2: CVE/EPSS enrichment
        if f.category == "dependencies":
            agents.append("dep")            # Phase 3: SCA + license
        return cls(
            finding=f,
            agents=tuple(agents),
            priority=_severity_rank(f.severity),
        )


# --- agent registry ----------------------------------------------------------

# Maps agent name -> callable(NormalizedFinding) -> list[NormalizedFinding]
AgentFn = Callable[[NormalizedFinding], list[NormalizedFinding]]
_REGISTRY: dict[str, AgentFn] = {}
_REGISTRY_LOCK = threading.Lock()


def register_agent(name: str, fn: AgentFn) -> None:
    """Plug in a new specialist.  Thread-safe; call at import time."""
    with _REGISTRY_LOCK:
        _REGISTRY[name] = fn
    logger.debug("agent_registered name=%s", name)


def _dispatch(name: str, finding: NormalizedFinding) -> list[NormalizedFinding]:
    with _REGISTRY_LOCK:
        fn = _REGISTRY.get(name)
    if fn is None:
        logger.warning("agent_not_registered name=%s", name)
        return []
    try:
        results = fn(finding)
        logger.debug("agent_done name=%s findings=%s", name, len(results))
        return results
    except Exception:
        logger.exception("agent_crashed name=%s rule=%s", name, finding.rule_id)
        return []


# --- merge -------------------------------------------------------------------


def _merge(result_sets: list[list[NormalizedFinding]]) -> list[NormalizedFinding]:
    """Deduplicate across agent outputs; highest-confidence version wins.

    Key is (file_path, start_line, rule_id).  When two agents report the same
    location the one with more evidence (higher confidence rank) survives.
    """
    _CONF_RANK = {"high": 0, "medium": 1, "low": 2}

    best: dict[tuple, NormalizedFinding] = {}
    for findings in result_sets:
        for f in findings:
            key = (f.file_path, f.start_line, f.rule_id)
            existing = best.get(key)
            if existing is None:
                best[key] = f
                continue
            # Merge extra metadata (e.g. intel and dep enrichments from sub-agents)
            merged_extra = {**(existing.extra or {}), **(f.extra or {})}
            if _CONF_RANK.get(f.confidence, 99) < _CONF_RANK.get(existing.confidence, 99):
                best[key] = f
            best[key].extra = merged_extra

    return sorted(best.values(), key=lambda f: _severity_rank(f.severity))


# --- router ------------------------------------------------------------------


@dataclass
class RouterOutcome:
    """Structured telemetry for the scan summary."""

    decisions: int = 0
    dispatched: int = 0
    merged_findings: int = 0
    agent_calls: dict[str, int] = field(default_factory=dict)
    agent_errors: dict[str, int] = field(default_factory=dict)

    def summary(self) -> dict:
        return {
            "decisions": self.decisions,
            "dispatched": self.dispatched,
            "merged_findings": self.merged_findings,
            "agent_calls": self.agent_calls,
            "agent_errors": self.agent_errors,
        }


class AgentRouter:
    """Fan findings out to specialist agents; merge and return the union.

    Parameters
    ----------
    max_workers:
        Thread-pool cap.  One thread per (finding x agent) pair, bounded here
        so a large scan does not exhaust the process's file descriptors.
    """

    def __init__(self, max_workers: int = 6) -> None:
        self._max_workers = max_workers

    def run(
        self,
        findings: list[NormalizedFinding],
        *,
        step: Callable[[str, str, str | None], None] | None = None,
    ) -> tuple[list[NormalizedFinding], RouterOutcome]:
        """Route *findings*, dispatch agents concurrently, return merged results."""
        outcome = RouterOutcome()
        if not findings:
            return [], outcome

        decisions = sorted(
            [RoutingDecision.for_finding(f) for f in findings],
            key=lambda d: d.priority,
        )
        outcome.decisions = len(decisions)

        tasks: list[tuple[RoutingDecision, str]] = []
        for decision in decisions:
            for agent_name in decision.agents:
                with _REGISTRY_LOCK:
                    known = agent_name in _REGISTRY
                if known:
                    tasks.append((decision, agent_name))
                    outcome.agent_calls[agent_name] = outcome.agent_calls.get(agent_name, 0) + 1
                else:
                    logger.debug("agent_skipped name=%s not_registered=True", agent_name)

        outcome.dispatched = len(tasks)
        if step:
            step(
                "Agent router",
                "running",
                f"{outcome.decisions} finding(s) -> {outcome.dispatched} agent call(s)",
            )

        # Start with the baseline findings so they are never lost if no agents
        # run, and are properly re-ranked and deduplicated during merge.
        result_sets: list[list[NormalizedFinding]] = [list(findings)]
        with concurrent.futures.ThreadPoolExecutor(
            max_workers=min(self._max_workers, max(len(tasks), 1)),
            thread_name_prefix="vulnix-agent",
        ) as pool:
            future_to_key: dict[concurrent.futures.Future, tuple[str, str]] = {}
            for decision, agent_name in tasks:
                fut = pool.submit(_dispatch, agent_name, decision.finding)
                future_to_key[fut] = (agent_name, decision.finding.rule_id)

            for fut in concurrent.futures.as_completed(future_to_key):
                agent_name, rule_id = future_to_key[fut]
                try:
                    result_sets.append(fut.result())
                except Exception:
                    outcome.agent_errors[agent_name] = outcome.agent_errors.get(agent_name, 0) + 1

        merged = _merge(result_sets)
        outcome.merged_findings = len(merged)

        if step:
            step(
                "Agent router",
                "done",
                f"{outcome.merged_findings} finding(s) after merge",
            )

        return merged, outcome


def list_registered_agents() -> list[str]:
    """Return all currently registered specialist agent names."""
    with _REGISTRY_LOCK:
        return sorted(_REGISTRY.keys())


def get_swarm_status() -> dict[str, Any]:
    """Structured readout of the agentic architecture and specialist agents."""
    with _REGISTRY_LOCK:
        registered = sorted(_REGISTRY.keys())
    return {
        "router": "enabled" if settings.agent_router_enabled else "disabled",
        "max_workers": settings.agent_router_max_workers,
        "registered_agents": registered,
        "agents": {
            "code": {
                "name": "CodeAgent",
                "specialty": "SAST, Multi-turn Code Review & Patch Generation",
                "status": "ready",
            },
            "intel": {
                "name": "IntelAgent",
                "specialty": "Threat Intelligence, CVE, EPSS & OSV Scraping",
                "status": "ready" if "intel" in registered else "unregistered",
            },
            "dep": {
                "name": "DepAgent",
                "specialty": "SCA, Transitive Dependencies & License Compliance",
                "status": "ready" if "dep" in registered else "unregistered",
            },
        },
    }


__all__ = [
    "AgentRouter",
    "RouterOutcome",
    "RoutingDecision",
    "get_swarm_status",
    "list_registered_agents",
    "register_agent",
]
