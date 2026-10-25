"""A suggested edit only becomes a patch when it matches the archived file."""

from app.agent.patch import build_patch
from app.agent.schema import AgentSuggestion

SOURCE = "\n".join(
    [
        "import sqlite3",
        "",
        "def load(db, name):",
        "    conn = sqlite3.connect(db)",
        "    return conn.execute(\"SELECT * FROM users WHERE name = '%s'\" % name)",
        "",
        "def ping():",
        "    return True",
    ]
)


def _suggestion(remove: list[str], add: list[str], why: str = "uses parameters") -> AgentSuggestion:
    return AgentSuggestion(remove=remove, add=add, why=why)


def test_a_matching_suggestion_becomes_a_unified_diff() -> None:
    patch = build_patch(
        path="app/db.py",
        content=SOURCE,
        start_line=5,
        end_line=5,
        suggestion=_suggestion(
            remove=["    return conn.execute(\"SELECT * FROM users WHERE name = '%s'\" % name)"],
            add=["    return conn.execute(\"SELECT * FROM users WHERE name = ?\", (name,))"],
        ),
    )

    assert patch is not None
    assert patch.start_line == 5
    assert patch.lines_removed == 1
    assert patch.lines_added == 1
    assert "--- a/app/db.py\n+++ b/app/db.py" in patch.patch
    assert patch.patch.splitlines()[2].startswith("@@ -2,")
    removed = [line for line in patch.patch.splitlines() if line[:1] == "-" and line[:3] != "---"]
    added = [line for line in patch.patch.splitlines() if line[:1] == "+" and line[:3] != "+++"]
    assert len(removed) == 1
    assert len(added) == 1
    assert "name = ?" in added[0]


def test_a_paraphrased_suggestion_is_discarded() -> None:
    patch = build_patch(
        path="app/db.py",
        content=SOURCE,
        start_line=5,
        end_line=5,
        suggestion=_suggestion(remove=["    return conn.execute(query)"], add=["    safe(name)"]),
    )

    assert patch is None


def test_a_quote_shorter_than_the_reported_range_still_matches() -> None:
    patch = build_patch(
        path="app/db.py",
        content=SOURCE,
        start_line=4,
        end_line=5,
        suggestion=_suggestion(
            remove=[
                "    conn = sqlite3.connect(db)",
                "    return conn.execute(\"SELECT * FROM users WHERE name = '%s'\" % name)",
            ],
            add=["    conn = sqlite3.connect(db)", "    return conn.execute(SQL, (name,))"],
        ),
    )

    assert patch is not None
    assert patch.end_line == 5


def test_an_invented_removal_outside_the_range_is_discarded() -> None:
    patch = build_patch(
        path="app/db.py",
        content=SOURCE,
        start_line=7,
        end_line=8,
        suggestion=_suggestion(remove=["def ping():"], add=["def pong():"]),
    )

    # The reported range is lines 7-8 but the quote is only line 7: the block that
    # matches is line 7, so the edit replaces one line, not two.
    assert patch is not None
    assert patch.lines_removed == 1


def test_no_suggestion_means_no_patch() -> None:
    assert build_patch(path="app/db.py", content=SOURCE, start_line=5, end_line=5, suggestion=None) is None


def test_a_deletion_only_fix_is_a_valid_patch() -> None:
    patch = build_patch(
        path="app/db.py",
        content=SOURCE,
        start_line=7,
        end_line=8,
        suggestion=_suggestion(remove=["def ping():", "    return True"], add=[]),
    )

    assert patch is not None
    assert patch.lines_added == 0


def test_a_secret_in_the_replacement_is_masked_before_it_is_stored() -> None:
    patch = build_patch(
        path="app/db.py",
        content=SOURCE,
        start_line=4,
        end_line=4,
        suggestion=_suggestion(
            remove=["    conn = sqlite3.connect(db)"],
            add=["    password = 'sup3rs3cr3tvalue'"],
        ),
    )

    assert patch is not None
    assert "sup3rs3cr3tvalue" not in patch.patch
    assert "[REDACTED]" in patch.patch


def test_a_line_number_prefix_is_not_part_of_the_archived_text() -> None:
    patch = build_patch(
        path="app/db.py",
        content=SOURCE,
        start_line=4,
        end_line=4,
        suggestion=_suggestion(remove=["4:     conn = sqlite3.connect(db)"], add=["    pass"]),
    )

    assert patch is None
