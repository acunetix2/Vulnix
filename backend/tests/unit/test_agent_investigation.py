"""Read-only repository tools and the investigation prompt contract."""

import pytest
from pydantic import ValidationError

from app.agent.intake import SourceFile
from app.agent.investigation import RepositoryTools
from app.agent.prompts import build_investigation_prompt, build_review_prompt
from app.agent.schema import AgentAction, AgentFinding, AgentReview
from app.core.config import Settings


def _file(path: str, content: str) -> SourceFile:
    return SourceFile(
        path=path,
        language="python",
        content=content,
        line_count=len(content.splitlines()),
        truncated=False,
    )


def _tools(primary: SourceFile, *related: SourceFile, budget: int = 500) -> RepositoryTools:
    tools = RepositoryTools(
        [primary, *related], related_file_bytes=budget, max_context_files=2
    )
    tools.begin(primary)
    return tools


def test_the_manifest_is_the_only_read_namespace() -> None:
    primary = _file("app/login.py", "print('safe')\n")
    tools = _tools(primary)

    assert "app/login.py | python | 1 lines" in tools.manifest
    tools.perform(
        [
            AgentAction(action="read_file", path="../outside.py"),
            AgentAction(action="read_file", path="/etc/passwd"),
        ]
    )

    assert tools.file("../outside.py") is None
    assert tools.file("/etc/passwd") is None
    assert tools.reads == 0
    assert len(tools.last_notes) == 2
    assert all("not in the reviewable manifest" in note for note in tools.last_notes)


def test_a_targeted_read_supplies_real_line_numbers_and_limits_citation() -> None:
    primary = _file("app/login.py", "print('safe')\n")
    related = _file("app/db.py", "\n".join(f"line_{number} = {number}" for number in range(1, 101)))
    tools = _tools(primary, related, budget=2000)

    tools.perform([AgentAction(action="read_file", path="app/db.py", line=50)])
    view = tools.views()[-1]

    assert (view.start_line, view.end_line) == (30, 70)
    assert view.lines()[20] == "line_50 = 50"
    assert tools.visible("app/db.py", 45, 55)
    assert not tools.visible("app/db.py", 1, 1)
    assert tools.reads == 1


def test_search_is_literal_bounded_and_does_not_make_a_file_citable() -> None:
    primary = _file("app/login.py", "print('safe')\n")
    related = _file(
        "app/db.py",
        "\n".join(["execute(user)"] * 20 + ["a.*b", "nothing here"]),
    )
    tools = _tools(primary, related)

    tools.perform([AgentAction(action="search", query="EXECUTE(")])
    assert len(tools.last_hits) == 8
    assert tools.last_hits[0].line == 1
    assert tools.file("app/db.py") is None
    assert not tools.visible("app/db.py", 1, 1)

    tools.perform([AgentAction(action="search", query=".*")])
    assert len(tools.last_hits) == 1
    assert tools.last_hits[0].line == 21
    assert tools.searches == 2


def test_the_context_file_budget_is_enforced() -> None:
    primary = _file("a.py", "a = 1\n")
    first = _file("b.py", "b = 2\n")
    second = _file("c.py", "c = 3\n")
    tools = _tools(primary, first, second)

    tools.perform(
        [
            AgentAction(action="read_file", path="b.py"),
            AgentAction(action="read_file", path="c.py"),
        ]
    )

    assert tools.file("b.py") is not None
    assert tools.file("c.py") is None
    assert tools.reads == 1
    assert "context-file budget" in tools.last_notes[-1]


def test_visibility_belongs_to_the_answer_that_saw_it() -> None:
    primary = _file("a.py", "a = 1\n")
    related = _file("b.py", "b = 2\n")
    tools = _tools(primary, related)
    before_read = tools.visibility()

    tools.perform([AgentAction(action="read_file", path="b.py")])

    assert not tools.visible("b.py", 1, 1, before_read)
    assert tools.visible("b.py", 1, 1)


def test_follow_up_prompt_contains_evidence_and_demands_a_final_answer() -> None:
    primary = _file("a.py", "a = 1\n")
    related = _file("b.py", "b = 2\n")
    tools = _tools(primary, related)
    previous = AgentReview(
        assessment="Check the helper before deciding.",
        findings=[
            AgentFinding(
                title="Unverified query construction",
                start_line=1,
                evidence="a = 1",
            )
        ],
        actions=[AgentAction(action="read_file", path="b.py")],
    )
    tools.focus(previous.findings)
    tools.perform(previous.actions)

    prompt = build_investigation_prompt(
        primary_path=primary.path,
        views=tools.views(),
        hits=tools.last_hits,
        notes=tools.last_notes,
        previous=previous,
        turn=1,
        max_turns=2,
        final=True,
    )

    assert '<untrusted_code path="b.py" lines="1-1"' in prompt
    assert "1: b = 2" in prompt
    assert "<untrusted_review>" in prompt
    assert "Check the helper before deciding." in prompt
    assert "final investigation turn" in prompt
    assert "Set `actions` to []" in prompt
    assert "read_file" in build_review_prompt(primary, tools.manifest)
    assert "<untrusted_manifest" in build_review_prompt(primary, tools.manifest)


def test_zero_context_budgets_allow_all_manifest_files_and_full_windows() -> None:
    primary = _file("a.py", "a = 1\n")
    related = _file("b.py", "\n".join(f"line_{number} = {number}" for number in range(1, 101)))
    third = _file("c.py", "c = 3\n")
    tools = RepositoryTools(
        [primary, related, third], related_file_bytes=0, max_context_files=0
    )
    tools.begin(primary)

    tools.perform(
        [
            AgentAction(action="read_file", path="b.py", line=50),
            AgentAction(action="read_file", path="c.py"),
        ]
    )

    assert tools.file("b.py") is not None
    assert tools.file("c.py") is not None
    assert (tools.views()[1].start_line, tools.views()[1].end_line) == (30, 70)
    assert tools.reads == 2


def test_agent_coverage_and_investigation_budgets_default_to_unlimited() -> None:
    names = (
        "agent_max_files",
        "agent_max_bytes_per_file",
        "agent_max_calls",
        "agent_max_investigation_turns",
        "agent_max_investigation_calls",
        "agent_max_context_files",
        "agent_related_file_bytes",
    )
    assert all(Settings.model_fields[name].default == 0 for name in names)


def test_unknown_model_actions_are_rejected_by_the_schema() -> None:
    with pytest.raises(ValidationError):
        AgentReview.model_validate({"actions": [{"action": "run_shell", "query": "ls"}]})
