"""Agent-first scanning: the AI review is the scanner, CLI tools are optional.

These tests stub the model catalog and the tool adapters so the outcome depends
on the pipeline's contract, not on which binaries happen to be installed.
"""

import pytest

from app.ai import catalog
from app.ai.providers.ollama import ProviderResult
from app.core.config import settings
from app.core.errors import AppError
from app.scanning.adapters.base import ScannerAdapter, ToolRunResult
from app.scanning.normalize import NormalizedFinding

ENTRY = catalog.ModelEntry(
    id="ollama:qwen3.5:4b",
    provider="ollama",
    model="qwen3.5:4b",
    note="Runs on the Vulnix host.",
    source="local",
)
ONE_LINER = {
    "app/login.py": (
        b"import sqlite3\n"
        b"def login(user, password):\n"
        b"    q = 'SELECT * FROM u WHERE n=' + user\n"
        b"    return sqlite3.connect(db).execute(q)\n"
    ),
}
DB_URL = {"config/settings.py": b'DATABASE = "postgres://admin:s3cretphrase@db.internal/prod"\n'}
TWO_FILES = {
    **ONE_LINER,
    "app/zdb.py": b"def execute(query):\n    return connection.execute(query)\n",
}


def _finding(start_line: int = 3, end_line: int | None = None) -> dict:
    return {
        "title": "SQL built by string concatenation",
        "vulnerability_class": "sql_injection",
        "category": "static_analysis",
        "severity": "high",
        "confidence": "high",
        "start_line": start_line,
        "end_line": end_line or start_line,
        "evidence": "q = 'SELECT * FROM u WHERE n=' + user",
        "impact": "Attacker-controlled input reaches the query.",
        "remediation": ["Use a parameterized statement."],
    }


class StubProvider:
    name = "stub"

    def __init__(self, state: dict) -> None:
        self.state = state

    def generate(self, system: str, user: str) -> ProviderResult:
        self.state["calls"] += 1
        self.state["prompts"].append(user)
        if self.state["responses"]:
            data = self.state["responses"].pop(0)
        elif isinstance(self.state["reply"], AppError):
            data = self.state["reply"]
        else:
            data = {"findings": self.state["reply"]}
        if isinstance(data, AppError):
            raise data
        return ProviderResult(
            data=data,
            provider=ENTRY.provider,
            model=ENTRY.model,
            prompt_tokens=120,
            completion_tokens=30,
        )


@pytest.fixture()
def agent(monkeypatch) -> dict:
    """An enabled AI with a stubbed model, plus how many calls it received."""
    state = {"reply": [_finding()], "responses": [], "calls": 0, "prompts": []}
    monkeypatch.setattr(settings, "ai_enabled", True)
    # A real audit retries a reviewer that throttles, so these tests exercise the
    # retry too - without sleeping through the backoff to do it.
    monkeypatch.setattr(settings, "ai_max_retries", 2)
    monkeypatch.setattr(settings, "ai_retry_backoff_base_seconds", 0.0)
    monkeypatch.setattr(settings, "ai_retry_backoff_max_seconds", 0.0)

    def _resolve(wanted):
        return ENTRY if wanted in (ENTRY.client_id, ENTRY.id) else None

    monkeypatch.setattr(catalog, "list_models", lambda refresh=False: [ENTRY])
    monkeypatch.setattr(catalog, "resolve", _resolve)
    monkeypatch.setattr(catalog, "preferred", lambda entries=None: ENTRY)
    monkeypatch.setattr("app.agent.review.provider_for", lambda entry: StubProvider(state))
    monkeypatch.setattr("app.ai.service.provider_for", lambda entry: StubProvider(state))
    return state


class FakeTool(ScannerAdapter):
    """A CLI scanner with a scripted outcome, so no host binary is involved."""

    def __init__(self, name: str, result: ToolRunResult) -> None:
        self.name = name
        self.result = result

    def available(self) -> bool:
        return self.result.status == "succeeded"

    def version(self) -> str | None:
        return self.result.tool_version

    def run(self, target_dir) -> ToolRunResult:
        self.result.tool_name = self.name
        return self.result

    def build_command(self, target_dir):
        return [self.name]

    def parse(self, raw):
        return []


def _tool(name: str, status: str, error_code: str | None = None, findings=()) -> FakeTool:
    return FakeTool(
        name,
        ToolRunResult(
            tool_name=name,
            tool_version=None,
            status=status,
            error_code=error_code,
            duration_ms=4,
            findings=list(findings),
        ),
    )


def _scanner_finding(rule_id: str, title: str) -> NormalizedFinding:
    return NormalizedFinding(
        rule_id=rule_id,
        title=title,
        category="static_analysis",
        severity="medium",
        confidence="high",
        file_path="app/login.py",
        start_line=3,
        end_line=3,
        evidence="concatenated query",
        scanner_message=title,
    )


@pytest.fixture()
def scanner(client, login, project_factory, make_zip):
    """Create a project with a one-file archive and return a scan-run helper."""

    login("user-1", "u1@example.com")
    ids = project_factory()

    def _run(
        adapters: list[FakeTool], options: dict | None = None, files: dict | None = None
    ) -> dict:
        from app.scanning import pipeline

        upload = client.post(
            f"/api/v1/projects/{ids['project_id']}/uploads",
            files={"file": ("s.zip", make_zip(files or ONE_LINER), "application/zip")},
        ).json()
        body = {"upload_id": upload["id"]}
        if options is not None:
            body["options"] = options
        # The scan runs inline in eager mode, so patch first and the whole
        # pipeline sees the scripted tools.
        previous = pipeline.build_adapters
        pipeline.build_adapters = lambda _options: adapters
        try:
            scan = client.post(f"/api/v1/projects/{ids['project_id']}/scans", json=body).json()
        finally:
            pipeline.build_adapters = previous
        return client.get(f"/api/v1/scans/{scan['id']}").json()

    return _run


def test_agent_findings_are_attributed_to_the_agent(client, agent, scanner) -> None:
    detail = scanner([_tool("semgrep", "skipped", "TOOL_UNAVAILABLE")])
    assert detail["status"] == "completed"
    assert detail["error_code"] is None

    runs = {run["tool_name"]: run for run in detail["tool_runs"]}
    assert runs["agent"]["status"] == "succeeded"
    # Provenance lives on the run: which reviewer actually read the code, by alias.
    assert runs["agent"]["tool_version"] == "Vulnix Edge"
    assert runs["agent"]["finding_count"] == 1
    assert runs["semgrep"]["status"] == "skipped"

    findings = client.get(f"/api/v1/scans/{detail['id']}/findings").json()["items"]
    assert [f["rule_id"] for f in findings] == ["agent/sql-injection"]
    assert findings[0]["file_path"] == "app/login.py"
    assert findings[0]["start_line"] == 3
    assert detail["summary"]["agent"]["files_reviewed"] == 1
    assert detail["summary"]["total_findings"] == 1
    assert agent["calls"] == 1


def test_the_evidence_is_the_archived_line_not_the_models_quote(client, agent, scanner) -> None:
    """What the console shows as evidence must come from the stored archive."""
    agent["reply"] = [dict(_finding(start_line=3, end_line=4), evidence="a line the model invented")]
    detail = scanner([])
    finding = client.get(f"/api/v1/scans/{detail['id']}/findings").json()["items"][0]
    assert finding["evidence"] == (
        "    q = 'SELECT * FROM u WHERE n=' + user\n"
        "    return sqlite3.connect(db).execute(q)"
    )
    # The reviewer's own words stay visible, in a field the UI labels as such.
    assert finding["scanner_message"] == "a line the model invented"
    # Provenance for the console: this finding came from the agent's run.
    agent_run = next(run for run in detail["tool_runs"] if run["tool_name"] == "agent")
    assert finding["tool_run_id"] == agent_run["id"]


def test_a_single_line_range_stores_that_one_line(client, agent, scanner) -> None:
    agent["reply"] = [_finding(start_line=2)]
    detail = scanner([])
    finding = client.get(f"/api/v1/scans/{detail['id']}/findings").json()["items"][0]
    assert finding["evidence"] == "def login(user, password):"


def test_a_credential_in_the_stored_excerpt_is_masked(client, agent, scanner) -> None:
    """Real source is stored as evidence, so a secret in it must not survive."""
    agent["reply"] = [_finding(start_line=1)]
    detail = scanner([], files=DB_URL)
    finding = client.get(f"/api/v1/scans/{detail['id']}/findings").json()["items"][0]
    assert "s3cretphrase" not in finding["evidence"]
    assert "[REDACTED_DB_URL]" in finding["evidence"]


def test_a_missing_tool_never_fails_a_scan(client, agent, scanner) -> None:
    detail = scanner(
        [
            _tool("semgrep", "skipped", "TOOL_UNAVAILABLE"),
            _tool("gitleaks", "skipped", "TOOL_UNAVAILABLE"),
            _tool("trivy", "skipped", "NO_MANIFEST"),
        ]
    )
    assert detail["status"] == "completed"
    assert detail["summary"]["total_findings"] == 1


def test_a_crashed_tool_leaves_the_agent_results_intact(client, agent, scanner) -> None:
    detail = scanner([_tool("bandit", "failed", "NONZERO_EXIT")])
    assert detail["status"] == "completed_with_errors"
    assert detail["summary"]["total_findings"] == 1


def test_tool_and_agent_findings_coexist(client, agent, scanner) -> None:
    tool = _tool("semgrep", "succeeded", findings=[_scanner_finding("SEMGREP1", "Concatenated SQL")])
    detail = scanner([tool])
    rules = sorted(f["rule_id"] for f in client.get(f"/api/v1/scans/{detail['id']}/findings").json()["items"])
    assert rules == ["SEMGREP1", "agent/sql-injection"]
    runs = {run["tool_name"]: run for run in detail["tool_runs"]}
    assert (runs["agent"]["finding_count"], runs["semgrep"]["finding_count"]) == (1, 1)


def test_an_unreachable_model_does_not_lose_tool_results(client, agent, scanner) -> None:
    agent["reply"] = AppError("AI_UNAVAILABLE", "The AI provider is unavailable.", 503)
    detail = scanner([_tool("semgrep", "succeeded", findings=[_scanner_finding("SEMGREP1", "x")])])
    assert detail["status"] == "completed_with_errors"
    assert detail["summary"]["agent"]["status"] == "failed"
    assert detail["summary"]["agent"]["error_code"] == "AI_UNAVAILABLE"
    assert detail["summary"]["total_findings"] == 1


def test_agent_unavailable_without_cli_results_fails_scan(client, agent, scanner) -> None:
    agent["reply"] = AppError("AI_UNAVAILABLE", "The AI provider is unavailable.", 503)

    detail = scanner([_tool("semgrep", "skipped", "TOOL_UNAVAILABLE")])

    assert detail["status"] == "failed"
    assert detail["error_code"] == "AI_UNAVAILABLE"


def test_partial_agent_review_is_never_reported_as_complete(
    client, agent, scanner, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "agent_max_files", 1)

    detail = scanner([], files=TWO_FILES)

    assert detail["status"] == "completed_with_errors"
    assert detail["summary"]["agent"]["status"] == "partial"


def test_a_throttled_reviewer_is_asked_again_before_the_audit_fails(
    client, agent, scanner, monkeypatch
) -> None:
    """One rate-limit trip must not fail the audit it lands in the middle of.

    The retries cost time only: a call that failed is never charged, so three
    attempts at one file still bill exactly one credit.
    """
    attempts = {"n": 0}

    class Recovers(StubProvider):
        def generate(self, system: str, user: str) -> ProviderResult:
            attempts["n"] += 1
            if attempts["n"] < 3:
                raise AppError("AI_UNAVAILABLE", "Throttled.", 503)
            return super().generate(system, user)

    monkeypatch.setattr("app.agent.review.provider_for", lambda entry: Recovers(agent))
    detail = scanner([])
    assert detail["status"] == "completed"
    assert attempts["n"] == 3
    assert detail["summary"]["agent"]["retries"] == 2
    assert detail["summary"]["agent"]["files_reviewed"] == 1

    ws_id = client.get("/api/v1/workspaces").json()[0]["id"]
    usage = client.get(f"/api/v1/workspaces/{ws_id}/ai/usage", params={"days": 7}).json()
    assert usage["total_credits"] == detail["summary"]["agent"]["calls"] == 1


def test_a_refused_reviewer_is_not_asked_again(client, agent, scanner, monkeypatch) -> None:
    """A wrong credential gives the same answer every time.

    Failing at once says so immediately; failing slowly says the same thing after
    every backoff has run, and looks like an outage while it does.
    """
    attempts = {"n": 0}

    class Refuses(StubProvider):
        def generate(self, system: str, user: str) -> ProviderResult:
            attempts["n"] += 1
            raise AppError("AI_MISCONFIGURED", "The reviewer rejected that request.", 502)

    monkeypatch.setattr("app.agent.review.provider_for", lambda entry: Refuses(agent))
    detail = scanner([])
    assert attempts["n"] == 1
    assert detail["summary"]["agent"]["retries"] == 0
    assert detail["summary"]["agent"]["error_code"] == "AI_MISCONFIGURED"


def test_a_finding_that_cannot_be_located_is_dropped(client, agent, scanner) -> None:
    agent["reply"] = [_finding(start_line=9999)]
    detail = scanner([])
    assert detail["status"] == "completed"
    assert detail["summary"]["total_findings"] == 0
    assert detail["summary"]["agent"]["dropped_findings"] == 1


def test_a_clean_file_is_reported_as_reviewed_not_failed(client, agent, scanner) -> None:
    agent["reply"] = []
    detail = scanner([])
    assert detail["status"] == "completed"
    assert detail["summary"]["agent"]["files_reviewed"] == 1
    assert detail["summary"]["agent"]["findings"] == 0
    steps = {step["label"]: step["status"] for step in detail["summary"]["steps"]}
    assert steps["app/login.py"] == "done"


def test_agent_review_can_be_turned_off_for_one_scan(client, agent, scanner) -> None:
    detail = scanner(
        [_tool("semgrep", "succeeded", findings=[_scanner_finding("SEMGREP1", "x")])],
        options={"agent_review": False, "static_analysis": True, "secrets": False, "dependencies": False},
    )
    assert detail["status"] == "completed"
    assert "agent" not in {run["tool_name"] for run in detail["tool_runs"]}
    assert detail["options"]["agent_review"] is False


def test_every_call_costs_a_credit(client, agent, scanner) -> None:
    detail = scanner([])
    ws_id = client.get("/api/v1/workspaces").json()[0]["id"]
    usage = client.get(f"/api/v1/workspaces/{ws_id}/ai/usage", params={"days": 7}).json()
    assert usage["total_credits"] == detail["summary"]["agent"]["calls"] == 1
    assert usage["models"][0]["alias"] == "Vulnix Edge"


def test_a_scan_never_names_the_vendor_behind_the_reviewer(client, agent, scanner) -> None:
    """The scan page, its findings, and the exported report all read one record."""
    detail = scanner([])
    findings = client.get(f"/api/v1/scans/{detail['id']}/findings").text
    report = client.get(f"/api/v1/scans/{detail['id']}/report", params={"format": "json"})
    assert report.status_code == 200

    for text in (str(detail), findings, report.text):
        for hidden in ("qwen", "ollama", ENTRY.id.lower()):
            assert hidden not in text.lower()
    assert detail["summary"]["agent"]["reviewer"] == "Vulnix Edge"


def test_the_trace_records_each_step_the_agent_took(client, agent, scanner) -> None:
    detail = scanner([_tool("semgrep", "skipped", "TOOL_UNAVAILABLE")])
    labels = [step["label"] for step in detail["summary"]["steps"]]
    assert labels[:2] == ["AI agent review", "app/login.py"]
    assert "semgrep" in labels
    statuses = {step["label"]: step["status"] for step in detail["summary"]["steps"]}
    assert statuses["AI agent review"] == "succeeded"


def test_the_agent_can_verify_a_finding_in_a_related_file(client, agent, scanner) -> None:
    agent["responses"] = [
        {"findings": [], "actions": [{"action": "read_file", "path": "app/zdb.py"}]},
        {
            "findings": [
                dict(
                    _finding(start_line=2),
                    path="app/zdb.py",
                    title="Query reaches the database executor",
                )
            ]
        },
        {"findings": []},
    ]

    detail = scanner([], files=TWO_FILES)
    findings = client.get(f"/api/v1/scans/{detail['id']}/findings").json()["items"]

    assert [(item["file_path"], item["start_line"]) for item in findings] == [("app/zdb.py", 2)]
    assert findings[0]["evidence"] == "    return connection.execute(query)"
    assert '<untrusted_code path="app/zdb.py" lines="1-2"' in agent["prompts"][1]
    assert "2:     return connection.execute(query)" in agent["prompts"][1]
    assert detail["summary"]["agent"]["investigations"] == 1
    assert detail["summary"]["agent"]["follow_ups"] == 1
    assert detail["summary"]["agent"]["context_reads"] == 1


def test_a_search_hit_alone_cannot_support_a_finding(client, agent, scanner) -> None:
    agent["responses"] = [
        {"findings": [], "actions": [{"action": "search", "query": "connection.execute"}]},
        {"findings": [dict(_finding(start_line=2), path="app/zdb.py")]},
        {"findings": []},
    ]

    detail = scanner([], files=TWO_FILES)

    assert "app/zdb.py:2:" in agent["prompts"][1]
    assert detail["summary"]["total_findings"] == 0
    assert detail["summary"]["agent"]["dropped_findings"] == 1
    assert detail["summary"]["agent"]["searches"] == 1
    assert detail["summary"]["agent"]["context_reads"] == 0


def test_a_failed_follow_up_preserves_the_initial_supported_findings(client, agent, scanner) -> None:
    agent["responses"] = [
        {
            "findings": [_finding()],
            "actions": [{"action": "read_file", "path": "app/zdb.py"}],
        },
        AppError("AI_UNAVAILABLE", "Throttled.", 503),
        AppError("AI_UNAVAILABLE", "Throttled.", 503),
        AppError("AI_UNAVAILABLE", "Throttled.", 503),
        {"findings": []},
    ]

    detail = scanner([], files=TWO_FILES)

    assert detail["status"] == "completed"
    assert detail["summary"]["total_findings"] == 1
    assert detail["summary"]["agent"]["calls"] == 3
    assert detail["summary"]["agent"]["investigation_failures"] == 1
    assert agent["calls"] == 5
    steps = {step["label"]: step["status"] for step in detail["summary"]["steps"]}
    assert steps["Investigate app/login.py (1)"] == "failed"


def test_the_final_investigation_turn_cannot_request_another_turn(
    client, agent, scanner, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "agent_max_investigation_turns", 1)
    agent["responses"] = [
        {"findings": [], "actions": [{"action": "read_file", "path": "app/zdb.py"}]},
        {"findings": [], "actions": [{"action": "read_file", "path": "app/zdb.py"}]},
        {"findings": []},
    ]

    detail = scanner([], files=TWO_FILES)

    assert "final investigation turn" in agent["prompts"][1]
    assert len(agent["prompts"]) == 3
    assert detail["summary"]["agent"]["follow_ups"] == 1
    assert detail["summary"]["agent"]["investigations"] == 1


def test_repeating_the_same_evidence_request_does_not_cause_a_loop(client, agent, scanner) -> None:
    request = {"action": "read_file", "path": "app/zdb.py", "line": 2}
    agent["responses"] = [
        {"findings": [], "actions": [request]},
        {"findings": [], "actions": [request]},
        {"findings": []},
    ]

    detail = scanner([], files=TWO_FILES)

    assert len(agent["prompts"]) == 3
    assert detail["summary"]["agent"]["follow_ups"] == 1
    assert detail["summary"]["agent"]["context_reads"] == 1
    labels = [step["label"] for step in detail["summary"]["steps"]]
    assert labels.count("Investigate app/login.py (1)") == 1
    assert "Investigate app/login.py (2)" not in labels


def test_zero_investigation_budgets_allow_the_agent_to_keep_working(
    client, agent, scanner, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "agent_max_investigation_turns", 0)
    monkeypatch.setattr(settings, "agent_max_investigation_calls", 0)
    monkeypatch.setattr(settings, "agent_max_calls", 0)
    agent["responses"] = [
        {"findings": [], "actions": [{"action": "read_file", "path": "app/zdb.py"}]},
        {"findings": [], "actions": [{"action": "search", "query": "connection"}]},
        {
            "findings": [],
            "actions": [{"action": "read_file", "path": "app/login.py", "line": 3}],
        },
        {"findings": []},
        {"findings": []},
    ]

    detail = scanner([], files=TWO_FILES)

    assert detail["status"] == "completed"
    assert detail["summary"]["agent"]["calls"] == 5
    assert detail["summary"]["agent"]["follow_ups"] == 3
    assert detail["summary"]["agent"]["investigations"] == 1
    assert len(agent["prompts"]) == 5
    assert all("final investigation turn" not in prompt for prompt in agent["prompts"][1:4])
