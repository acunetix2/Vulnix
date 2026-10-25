"""Turn a reviewer's suggestion into a patch that provably applies.

The model is asked to copy the offending lines out of the clip it was shown.
That is the only permission this module honours: the lines it wants to remove
are compared against the archived file, character for character apart from
trailing whitespace, and a suggestion that does not match is thrown away rather
than guessed at. The patch is built here, from the archived source, so the diff
the console renders is text this server produced - not text a model wrote.

Nothing is applied, committed or pushed from this code path. It produces a
proposal and the record of where it belongs.
"""

import difflib
from dataclasses import dataclass

from app.agent.schema import AgentSuggestion
from app.ai.redaction import redact

MAX_LINES = 300
MAX_PATCH_CHARS = 20_000
MAX_WHY_CHARS = 500


@dataclass(frozen=True)
class SuggestionPatch:
    """A validated edit and the unified diff that expresses it."""

    path: str
    patch: str
    why: str
    start_line: int
    end_line: int
    lines_removed: int
    lines_added: int

    def as_record(self) -> dict:
        return {
            "path": self.path,
            "patch": self.patch,
            "why": self.why,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "lines_removed": self.lines_removed,
            "lines_added": self.lines_added,
        }


def _normalise(lines: list[str]) -> list[str]:
    return [line.rstrip() for line in lines]


def _matching_range(
    lines: list[str], start_line: int, end_line: int, remove: list[str]
) -> int | None:
    """The last line the suggestion really replaces, or None if it matches nothing.

    A reviewer sometimes quotes the flagged statement and nothing more while the
    reported range covers a block, so both the quote's own length and the
    reported range are tried before the suggestion is discarded.
    """
    wanted = _normalise(remove)
    if not wanted:
        return None
    candidates = []
    for last in (start_line + len(wanted) - 1, end_line):
        if last >= start_line and last not in candidates:
            candidates.append(last)
    for last in candidates:
        if last > len(lines):
            continue
        if _normalise(lines[start_line - 1 : last]) == wanted:
            return last
    return None


def build_patch(
    *, path: str, content: str, start_line: int, end_line: int, suggestion: AgentSuggestion | None
) -> SuggestionPatch | None:
    """Build the diff for one suggestion, or None when it cannot be trusted."""
    if suggestion is None:
        return None
    remove = [line for line in suggestion.remove if isinstance(line, str)][:MAX_LINES]
    add = [line for line in suggestion.add if isinstance(line, str)][:MAX_LINES]
    if not remove or len(add) > MAX_LINES:
        return None

    lines = content.splitlines()
    if not lines or start_line > len(lines):
        return None
    last = _matching_range(lines, start_line, max(end_line, start_line), remove)
    if last is None:
        return None

    replaced = lines[: start_line - 1] + add + lines[last:]
    diff = list(
        difflib.unified_diff(
            lines, replaced, fromfile=f"a/{path}", tofile=f"b/{path}", lineterm="", n=3
        )
    )
    patch = redact("\n".join(diff)) or ""
    if not patch or len(patch) > MAX_PATCH_CHARS:
        return None

    return SuggestionPatch(
        path=path,
        patch=patch,
        why=(redact(suggestion.why) or "")[:MAX_WHY_CHARS],
        start_line=start_line,
        end_line=last,
        lines_removed=last - start_line + 1,
        lines_added=len(add),
    )
