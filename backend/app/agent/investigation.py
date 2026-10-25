"""Bounded, read-only repository tools for the review agent.

The model chooses an action; this module decides whether it is allowed and what
comes back. Every read resolves against the already validated intake manifest,
never against a path supplied to the filesystem. Search is a literal substring
scan, not a regular expression, and a search hit does not make a file citable:
the agent must read the relevant line window before reporting it.
"""

from dataclasses import dataclass

from app.agent.intake import SourceFile
from app.agent.schema import AgentAction, AgentFinding
from app.ai.redaction import redact

_MAX_MANIFEST_CHARS = 3000
_MAX_SEARCH_RESULTS = 8
_MAX_SEARCH_HIT_CHARS = 240
_FOCUS_RADIUS = 12
_MAX_FOCUS_RANGES = 3
_READ_RADIUS = 20
_MAX_DEFAULT_READ_LINES = 80


@dataclass(frozen=True)
class CodeView:
    """A line range from one archived file, with its real line numbers."""

    file: SourceFile
    start_line: int
    end_line: int

    def lines(self) -> list[str]:
        return self.file.content.splitlines()[self.start_line - 1 : self.end_line]


@dataclass(frozen=True)
class SearchHit:
    path: str
    line: int
    text: str


def _merge_ranges(ranges: list[tuple[int, int]]) -> list[tuple[int, int]]:
    merged: list[list[int]] = []
    for start, end in sorted(ranges):
        if merged and start <= merged[-1][1] + 1:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return [(start, end) for start, end in merged]


class RepositoryTools:
    """Per-scan tool state, reset to one primary file for each investigation."""

    def __init__(
        self,
        files: list[SourceFile],
        *,
        related_file_bytes: int,
        max_context_files: int,
    ) -> None:
        self._files = {file.path: file for file in files}
        self._related_file_bytes = related_file_bytes
        self._max_context_files = max_context_files
        self.manifest = self._build_manifest()
        self.reads = 0
        self.searches = 0
        self._primary: SourceFile | None = None
        self._loaded: dict[str, SourceFile] = {}
        self._visible: dict[str, list[tuple[int, int]]] = {}
        self._primary_views: list[CodeView] = []
        self._related_views: dict[str, list[CodeView]] = {}
        self.last_hits: list[SearchHit] = []
        self.last_notes: list[str] = []

    def _build_manifest(self) -> str:
        lines: list[str] = []
        used = 0
        for index, file in enumerate(self._files.values()):
            clipped = ", clipped" if file.truncated else ""
            entry = f"{file.path} | {file.language} | {file.line_count} lines{clipped}"
            if used + len(entry) + 1 > _MAX_MANIFEST_CHARS:
                lines.append(f"... {len(self._files) - index} more file(s) in the intake")
                break
            lines.append(entry)
            used += len(entry) + 1
        return "\n".join(lines)

    def begin(self, primary: SourceFile) -> None:
        self._primary = primary
        self._loaded = {primary.path: primary}
        full_range = (1, primary.line_count)
        self._visible = {primary.path: [full_range]}
        self._primary_views = [CodeView(primary, *full_range)]
        self._related_views = {}
        self.last_hits = []
        self.last_notes = []

    def focus(self, findings: list[AgentFinding]) -> None:
        """Keep follow-up prompts small without forgetting what turn one saw."""
        primary = self._primary
        if primary is None:
            return
        ranges = []
        for item in findings:
            if item.path and item.path != primary.path:
                continue
            start = max(item.start_line - _FOCUS_RADIUS, 1)
            end = min(max(item.end_line or item.start_line, item.start_line) + _FOCUS_RADIUS,
                      primary.line_count)
            ranges.append((start, end))
        ranges = _merge_ranges(ranges)[:_MAX_FOCUS_RANGES]
        if not ranges:
            # With no hypothesis to anchor on, retain small files whole and the
            # beginning of a large one. The initial full view remains citable.
            end = primary.line_count if len(primary.content) <= 4000 else min(primary.line_count, 40)
            ranges = [(1, end)]
        self._primary_views = [CodeView(primary, start, end) for start, end in ranges]

    def views(self) -> list[CodeView]:
        views = list(self._primary_views)
        for file_views in self._related_views.values():
            views.extend(file_views)
        return views

    def file(self, path: str) -> SourceFile | None:
        return self._loaded.get(path)

    def visibility(self) -> dict[str, list[tuple[int, int]]]:
        """The evidence available to the answer being evaluated right now."""
        return {path: list(ranges) for path, ranges in self._visible.items()}

    def visible(
        self,
        path: str,
        start_line: int,
        end_line: int,
        snapshot: dict[str, list[tuple[int, int]]] | None = None,
    ) -> bool:
        """Whether one supplied code view contained the whole cited range."""
        last = max(start_line, end_line)
        ranges = (snapshot if snapshot is not None else self._visible).get(path, [])
        return any(start <= start_line and last <= end for start, end in ranges)

    def perform(self, actions: list[AgentAction]) -> None:
        self.last_hits = []
        self.last_notes = []
        for action in actions:
            if action.action == "read_file":
                self._read(action.path, action.line)
            else:
                self._search(action.query)

    def _window(self, file: SourceFile, line: int | None) -> tuple[int, int] | None:
        lines = file.content.splitlines()
        if not lines:
            return None
        center = line or 1
        if center > len(lines):
            return None
        if self._related_file_bytes > 0 and len(lines[center - 1]) + 1 > self._related_file_bytes:
            return None

        if line is None:
            start, end = 1, min(len(lines), _MAX_DEFAULT_READ_LINES)
        else:
            start = max(center - _READ_RADIUS, 1)
            end = min(center + _READ_RADIUS, len(lines))

        def size() -> int:
            return sum(len(value) + 1 for value in lines[start - 1 : end])

        while (
            self._related_file_bytes > 0
            and start < end
            and size() > self._related_file_bytes
        ):
            if line is None or end - center >= center - start:
                end -= 1
            else:
                start += 1
        if self._related_file_bytes > 0 and size() > self._related_file_bytes:
            return None
        return start, end

    def _read(self, path: str, line: int | None) -> None:
        file = self._files.get(path)
        if file is None:
            self.last_notes.append("read_file ignored: the path is not in the reviewable manifest.")
            return
        if (
            self._max_context_files > 0
            and path not in self._loaded
            and len(self._loaded) >= self._max_context_files
        ):
            self.last_notes.append("read_file ignored: the context-file budget is exhausted; use search.")
            return
        window = self._window(file, line)
        if window is None:
            self.last_notes.append("read_file could not fit that line in the context budget.")
            return

        self._loaded[path] = file
        view = CodeView(file, *window)
        views = (
            self._primary_views
            if path == self._primary.path
            else self._related_views.setdefault(path, [])
        )
        if any(
            existing.start_line == view.start_line and existing.end_line == view.end_line
            for existing in views
        ):
            self.last_notes.append(f"{path} lines {view.start_line}-{view.end_line} are already in context.")
            return
        views.append(view)
        self._visible.setdefault(path, []).append(window)
        self.reads += 1
        self.last_notes.append(f"Loaded {path} lines {view.start_line}-{view.end_line}.")

    def _search(self, query: str) -> None:
        needle = query.casefold()
        if len(needle) < 2:
            self.last_notes.append("search ignored: supply a literal query of at least two characters.")
            return
        hits: list[SearchHit] = []
        for file in self._files.values():
            for number, line in enumerate(file.content.splitlines(), start=1):
                if needle not in line.casefold():
                    continue
                hits.append(
                    SearchHit(
                        path=file.path,
                        line=number,
                        text=(redact(line.strip()) or "")[:_MAX_SEARCH_HIT_CHARS],
                    )
                )
                if len(hits) >= _MAX_SEARCH_RESULTS:
                    break
            if len(hits) >= _MAX_SEARCH_RESULTS:
                break
        self.last_hits = hits
        self.searches += 1
        self.last_notes.append(
            f"Literal search returned {len(hits)} match(es). Read a match before citing its file."
        )
