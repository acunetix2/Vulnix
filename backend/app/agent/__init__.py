"""Vulnix's review agent: the AI pass that reads the code itself.

CLI scanners are optional inputs recorded alongside it; the agent is what makes
a scan succeed when no scanner is installed on the host.
"""

from app.agent.code_agent import CodeAgentContext
from app.agent.dep_agent import DepAgent
from app.agent.intel_agent import IntelAgent
from app.agent.review import AGENT_TOOL_NAME, AgentOutcome, run_agent_review
from app.agent.router import (
    AgentRouter,
    RouterOutcome,
    RoutingDecision,
    get_swarm_status,
    list_registered_agents,
    register_agent,
)

__all__ = [
    "AGENT_TOOL_NAME",
    "AgentOutcome",
    "AgentRouter",
    "CodeAgentContext",
    "DepAgent",
    "IntelAgent",
    "RouterOutcome",
    "RoutingDecision",
    "get_swarm_status",
    "list_registered_agents",
    "register_agent",
    "run_agent_review",
]
