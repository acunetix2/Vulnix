"""Source selection for the review agent.

The agent reads the extracted archive one file at a time. What it may read is
decided here, by extension and by path, never by anything the repository says
about itself: an archive that names a 40 MB binary as source code is simply not
picked up.
"""

from dataclasses import dataclass
from pathlib import Path

# Extension -> language label sent in the prompt. Config and IaC files are
# included deliberately: misconfigured pipelines are a real source of findings.
LANGUAGES: dict[str, str] = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".vue": "vue",
    ".go": "go",
    ".rb": "ruby",
    ".php": "php",
    ".java": "java",
    ".kt": "kotlin",
    ".rs": "rust",
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cs": "csharp",
    ".swift": "swift",
    ".sql": "sql",
    ".sh": "shell",
    ".bash": "shell",
    ".tf": "terraform",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".toml": "toml",
    ".env": "dotenv",
}

SKIP_NAMES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock", "uv.lock", "cargo.lock"}
SKIP_DIRS = {
    "node_modules",
    ".git",
    ".svn",
    "dist",
    "build",
    "target",
    "out",
    "vendor",
    "venv",
    ".venv",
    "__pycache__",
    ".mypy_cache",
    ".pytest_cache",
    "site-packages",
    ".next",
    ".nuxt",
    "coverage",
    ".terraform",
    "testdata",
    "migrations",
}
# A lockfile or bundle is generated, not authored: reviewing it produces noise.
MINIFIED_SUFFIXES = (".min.js", ".min.css", ".bundle.js")


@dataclass(frozen=True)
class SourceFile:
    """One file the agent is allowed to read, already clipped to budget."""

    path: str  # POSIX path relative to the extraction root, identical to the ZIP entry name
    language: str
    content: str
    line_count: int
    truncated: bool


def is_candidate(name: str) -> bool:
    """Whether a relative path is reviewable source, before any size check."""
    posix = name.replace("\\", "/")
    if posix.endswith(MINIFIED_SUFFIXES):
        return False
    parts = posix.split("/")
    if any(part.lower() in SKIP_DIRS for part in parts[:-1]):
        return False
    filename = parts[-1]
    if filename.lower() in SKIP_NAMES or filename.startswith(".env.example"):
        return False
    suffix = Path(filename).suffix.lower()
    if suffix in LANGUAGES:
        return True
    # Dockerfile / Makefile / Gemfile have no suffix but are worth reading.
    return filename.lower() in {"dockerfile", "makefile", "gemfile", "jenkinsfile", "procfile"}


def _looks_binary(raw: bytes) -> bool:
    return b"\x00" in raw[:4096]


def _clip(text: str, limit: int) -> tuple[str, int, bool]:
    """Cut on a line boundary so quoted line numbers stay truthful."""
    lines = text.splitlines()
    if limit <= 0:
        return text, len(lines), False
    kept: list[str] = []
    used = 0
    for line in lines:
        size = len(line) + 1
        if used + size > limit:
            return "\n".join(kept), len(kept), True
        used += size
        kept.append(line)
    return "\n".join(kept), len(kept), False


def select_files(root: Path, *, max_files: int, max_bytes_per_file: int) -> tuple[list[SourceFile], dict]:
    """Return reviewable files in deterministic order, plus honest intake counts."""
    root = root.resolve()
    paths = sorted(
        (
            p
            for p in root.rglob("*")
            if p.is_file() and not p.is_symlink() and is_candidate(p.relative_to(root).as_posix())
        ),
        key=lambda p: p.relative_to(root).as_posix(),
    )
    selected: list[SourceFile] = []
    skipped_unreadable = skipped_binary = skipped_empty = skipped_budget = 0

    for path in paths:
        if max_files > 0 and len(selected) >= max_files:
            skipped_budget += 1
            continue
        try:
            raw = path.read_bytes()
        except OSError:
            skipped_unreadable += 1
            continue
        if _looks_binary(raw):
            skipped_binary += 1
            continue
        if not raw.strip():
            skipped_empty += 1
            continue
        text = raw.decode("utf-8", errors="replace")
        content, line_count, truncated = _clip(text, max_bytes_per_file)
        if not content.strip():
            skipped_empty += 1
            continue
        selected.append(
            SourceFile(
                path=path.relative_to(root).as_posix(),
                language=LANGUAGES.get(path.suffix.lower(), "text"),
                content=content,
                line_count=line_count,
                truncated=truncated,
            )
        )

    stats = {
        "candidates": len(paths),
        "reviewed": len(selected),
        "skipped_binary": skipped_binary,
        "skipped_empty": skipped_empty + skipped_unreadable,
        "skipped_over_budget": skipped_budget,
    }
    return selected, stats
