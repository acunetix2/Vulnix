"""AI selection and usage endpoints: tokens only, role-gated, credit-counted."""

import pytest

from app.ai import catalog
from app.ai.providers.ollama import ProviderResult
from app.core.config import settings
from app.core.errors import AppError
from app.db.models import Finding, Scan, WorkspaceMember
from app.db.session import SessionLocal

ENTRY_LOCAL = catalog.ModelEntry(
    id="ollama:qwen3.5:4b",
    provider="ollama",
    model="qwen3.5:4b",
    note="Runs on the Vulnix host.",
    source="local",
)
ENTRY_HOSTED = catalog.ModelEntry(
    id="groq:qwen/qwen3.8-27b",
    provider="groq",
    model="qwen/qwen3.8-27b",
    note="Hosted reviewer.",
    source="hosted",
)
ENTRIES = [ENTRY_LOCAL, ENTRY_HOSTED]


class Wire:
    """What the stubbed catalog offers and which entry each call resolved to."""

    def __init__(self) -> None:
        self.finding_id: str | None = None
        self.calls: list[str] = []


@pytest.fixture()
def wire(monkeypatch) -> Wire:
    state = Wire()

    class Stub:
        name = "stub"

        def __init__(self, entry) -> None:
            self.entry = entry

        def generate(self, system: str, user: str) -> ProviderResult:
            return ProviderResult(
                data={
                    "finding_id": state.finding_id,
                    "summary": "Query built from input.",
                    "impact": "Input reaches the query.",
                    "confidence": "medium",
                    "remediation": ["Parameterize it."],
                    "verification_steps": ["Re-scan."],
                    "evidence_refs": [],
                    "limitations": "Snippet only.",
                },
                provider=self.entry.provider,
                model=self.entry.model,
                prompt_tokens=20,
                completion_tokens=5,
            )

    def _provider_for(entry) -> Stub:
        state.calls.append(entry.id)
        return Stub(entry)

    # The suite runs with AI off; this fixture stands in for an enabled deploy.
    monkeypatch.setattr(settings, "ai_enabled", True)
    monkeypatch.setattr(catalog, "list_models", lambda refresh=False: list(ENTRIES))
    monkeypatch.setattr(
        catalog,
        "resolve",
        lambda wanted: next(
            (e for e in ENTRIES if str(wanted or "").strip() in (e.client_id, e.id)), None
        ),
    )
    monkeypatch.setattr(catalog, "preferred", lambda entries=None: ENTRIES[0])
    monkeypatch.setattr("app.ai.service.provider_for", _provider_for)
    return state


@pytest.fixture()
def workspace(client, login):
    login()
    ws = client.post("/api/v1/workspaces", json={"name": "Acme"}).json()
    proj = client.post(f"/api/v1/workspaces/{ws['id']}/projects", json={"name": "P"}).json()
    return {"ws": ws, "project": proj}


def _data(finding_id: str) -> dict:
    """A schema-valid explanation, so a stubbed provider reaches the recording step."""
    return {
        "finding_id": finding_id,
        "summary": "Query built from input.",
        "impact": "Input reaches the query.",
        "confidence": "medium",
        "remediation": ["Parameterize it."],
        "verification_steps": ["Re-scan."],
        "evidence_refs": [],
        "limitations": "Snippet only.",
    }


def _finding(project_id: str, wire: Wire) -> str:
    db = SessionLocal()
    scan = Scan(project_id=project_id, status="completed", requested_by="user-1", options={}, summary={})
    db.add(scan)
    db.flush()
    finding = Finding(
        scan_id=scan.id,
        fingerprint="fp-api",
        rule_id="R1",
        title="Hardcoded password",
        category="static_analysis",
        severity="high",
        confidence="high",
    )
    db.add(finding)
    db.commit()
    wire.finding_id = finding.id
    finding_id = finding.id
    db.close()
    return finding_id


def test_models_are_visible_to_a_member(client, workspace, wire) -> None:
    items = client.get(f"/api/v1/workspaces/{workspace['ws']['id']}/ai/models").json()
    # A client sees a selection token and an alias - never a provider, a tag, or
    # even the local/hosted distinction.
    assert [m["id"] for m in items] == [e.client_id for e in ENTRIES]
    assert [m["alias"] for m in items] == ["Vulnix Edge", "Vulnix Pro"]
    assert [set(m) for m in items] == [{"id", "alias", "note"}] * 2


def test_no_vendor_model_identity_leaves_the_server(client, workspace, wire) -> None:
    """The whole AI surface, checked for the strings it is supposed to hide."""
    ws_id = workspace["ws"]["id"]
    finding_id = _finding(workspace["project"]["id"], wire)
    client.put(f"/api/v1/workspaces/{ws_id}/ai/settings", json={"model_id": ENTRY_HOSTED.client_id})
    client.post(f"/api/v1/findings/{finding_id}/explanation")

    bodies = [
        client.get(f"/api/v1/workspaces/{ws_id}/ai/models").text,
        client.get(f"/api/v1/workspaces/{ws_id}/ai/settings").text,
        client.get(f"/api/v1/workspaces/{ws_id}/ai/usage", params={"days": 7}).text,
        client.get(f"/api/v1/findings/{finding_id}").text,
        client.get(f"/api/v1/workspaces/{ws_id}/audit-events").text,
    ]
    for body in bodies:
        for hidden in ("qwen", "gpt-oss", "ollama", "groq", "gemini", "google", ENTRY_HOSTED.id):
            assert hidden not in body.lower()


def test_non_member_cannot_see_the_catalog(client, login, workspace, wire) -> None:
    login("intruder", "intruder@example.com")
    assert client.get(f"/api/v1/workspaces/{workspace['ws']['id']}/ai/models").status_code == 404


def test_settings_default_to_the_server_selection(client, workspace, wire) -> None:
    body = client.get(f"/api/v1/workspaces/{workspace['ws']['id']}/ai/settings").json()
    assert body["enabled"] is True
    assert body["selected"] == ENTRY_LOCAL.client_id
    assert body["default"] == ENTRY_LOCAL.client_id
    assert body["used_today"] == 0


def test_switching_the_model_changes_who_answers(client, workspace, wire) -> None:
    ws_id = workspace["ws"]["id"]
    finding_id = _finding(workspace["project"]["id"], wire)

    updated = client.put(
        f"/api/v1/workspaces/{ws_id}/ai/settings", json={"model_id": ENTRY_HOSTED.client_id}
    )
    assert updated.status_code == 200
    assert updated.json()["selected"] == ENTRY_HOSTED.client_id

    explained = client.post(f"/api/v1/findings/{finding_id}/explanation")
    assert explained.status_code == 200
    assert explained.json()["reviewer"] == "Vulnix Pro"
    # The provider is resolved once, for the explanation, and it must be the
    # workspace's new choice rather than the server default.
    assert wire.calls == [ENTRY_HOSTED.id]


def test_explanation_names_the_reviewer_that_answered(client, workspace, wire, monkeypatch) -> None:
    """A failover has to be visible in the response, not only in the stored row.

    The workspace keeps its local selection while a hosted reviewer replies - the
    same thing FallbackProvider does. Reporting only the request would credit
    the local machine with an answer that left it.
    """
    ws_id = workspace["ws"]["id"]
    finding_id = _finding(workspace["project"]["id"], wire)
    client.put(f"/api/v1/workspaces/{ws_id}/ai/settings", json={"model_id": ENTRY_LOCAL.client_id})

    class Failover:
        name = "failover"

        def generate(self, system: str, user: str) -> ProviderResult:
            return ProviderResult(
                data={
                    "finding_id": finding_id,
                    "summary": "Query built from input.",
                    "impact": "Input reaches the query.",
                    "confidence": "medium",
                    "remediation": ["Parameterize it."],
                    "verification_steps": ["Re-scan."],
                    "evidence_refs": [],
                    "limitations": "Snippet only.",
                },
                provider="groq",
                model="qwen/qwen3.8-27b",
            )

    monkeypatch.setattr("app.ai.service.provider_for", lambda entry: Failover())

    body = client.post(f"/api/v1/findings/{finding_id}/explanation").json()
    assert body["reviewer"] == "Vulnix Pro"
    assert body["fallback"] is True
    assert body["generated_at"]


def test_a_model_name_is_not_accepted_directly(client, workspace, wire) -> None:
    # A selection token is the handle a client holds, so it can never steer a
    # provider with an arbitrary or invented model string.
    for bad in ["qwen3.5:4b", "not-a-provider:x", "mdl_0000000000000000", ""]:
        response = client.put(
            f"/api/v1/workspaces/{workspace['ws']['id']}/ai/settings", json={"model_id": bad}
        )
        assert response.status_code == 422, (bad, response.text)


def test_explanation_records_one_credit(client, workspace, wire) -> None:
    ws_id = workspace["ws"]["id"]
    finding_id = _finding(workspace["project"]["id"], wire)
    client.post(f"/api/v1/findings/{finding_id}/explanation")

    usage = client.get(f"/api/v1/workspaces/{ws_id}/ai/usage", params={"days": 7}).json()
    assert usage["scope"] == "user"
    assert usage["total_credits"] == 1
    assert usage["days"][0]["credits"] == 1
    assert usage["days"][0]["day"] == usage["until_day"]
    # The per-reviewer rollup is the only usage view that says *which* reviewer
    # spent the credit, so it has to carry its alias and the token counts.
    assert usage["models"] == [
        {
            "alias": "Vulnix Edge",
            "calls": 1,
            "credits": 1,
            "failures": 0,
            "prompt_tokens": 20,
            "completion_tokens": 5,
            "last_day": usage["until_day"],
        }
    ]


def test_a_failover_charges_the_reviewer_that_replied(client, workspace, wire, monkeypatch) -> None:
    ws_id = workspace["ws"]["id"]
    finding_id = _finding(workspace["project"]["id"], wire)
    client.put(f"/api/v1/workspaces/{ws_id}/ai/settings", json={"model_id": ENTRY_LOCAL.client_id})

    class HostedReply:
        name = "hosted_reply"

        def generate(self, system: str, user: str) -> ProviderResult:
            return ProviderResult(
                data=_data(finding_id),
                provider="groq",
                model="qwen/qwen3.8-27b",
                prompt_tokens=31,
                completion_tokens=7,
            )

    monkeypatch.setattr("app.ai.service.provider_for", lambda entry: HostedReply())
    assert client.post(f"/api/v1/findings/{finding_id}/explanation").status_code == 200

    models = client.get(f"/api/v1/workspaces/{ws_id}/ai/usage", params={"days": 7}).json()["models"]
    # Two rows, one per reviewer: the local selection spent nothing because it
    # answered nothing, and the reply that came back is named by alias only.
    assert [(m["alias"], m["credits"]) for m in models] == [("Vulnix Pro", 1)]
    assert all("source" not in m for m in models)


def test_a_refused_call_counts_no_credit_but_still_shows_up(client, workspace, wire, monkeypatch) -> None:
    ws_id = workspace["ws"]["id"]
    finding_id = _finding(workspace["project"]["id"], wire)

    def refuse(entry):
        raise AppError("AI_UNAVAILABLE", "No provider is reachable.", 503)

    monkeypatch.setattr("app.ai.service.provider_for", refuse)
    assert client.post(f"/api/v1/findings/{finding_id}/explanation").status_code == 503

    usage = client.get(f"/api/v1/workspaces/{ws_id}/ai/usage", params={"days": 7}).json()
    assert usage["total_credits"] == 0
    assert usage["models"] == [
        {
            "alias": "Vulnix Edge",
            "calls": 1,
            "credits": 0,
            "failures": 1,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "last_day": usage["until_day"],
        }
    ]


def test_workspace_usage_scope_is_admin_only(client, login, workspace, wire) -> None:
    ws_id = workspace["ws"]["id"]
    db = SessionLocal()
    db.add(WorkspaceMember(workspace_id=ws_id, user_id="u-viewer", role="viewer"))
    db.commit()
    db.close()

    login("u-viewer", "viewer@example.com")
    forbidden = client.get(f"/api/v1/workspaces/{ws_id}/ai/usage", params={"scope": "workspace"})
    assert forbidden.status_code == 403
    # Their own usage is still readable; only the aggregate view is restricted.
    assert client.get(f"/api/v1/workspaces/{ws_id}/ai/usage").status_code == 200


def test_unknown_usage_scope_is_refused(client, workspace, wire) -> None:
    response = client.get(
        f"/api/v1/workspaces/{workspace['ws']['id']}/ai/usage", params={"scope": "galaxy"}
    )
    assert response.status_code == 422


def test_usage_window_is_bounded(client, workspace, wire) -> None:
    response = client.get(
        f"/api/v1/workspaces/{workspace['ws']['id']}/ai/usage", params={"days": 5000}
    )
    assert response.status_code == 422
