"""Archive safety tests: traversal, symlinks, bombs, nesting."""

from pathlib import Path

import pytest

from app.core.config import settings
from app.core.errors import AppError
from app.scanning.archive import extract_archive, inspect_archive, validate_entry_name


@pytest.fixture()
def write_zip(tmp_path: Path, make_zip):
    """Write an in-memory ZIP to disk and return its path."""

    def _write(files: dict[str, bytes], symlinks=()) -> Path:
        path = tmp_path / "archive.zip"
        path.write_bytes(make_zip(files, symlinks))
        return path

    return _write


def test_validate_entry_name_rejects_traversal() -> None:
    with pytest.raises(AppError) as exc:
        validate_entry_name("../../etc/passwd")
    assert exc.value.code == "UNSAFE_ARCHIVE"


def test_validate_entry_name_rejects_absolute_paths() -> None:
    for name in ("/etc/passwd", "C:/windows/system32", "\\\\host\\share\\x"):
        with pytest.raises(AppError):
            validate_entry_name(name)


def test_validate_entry_name_accepts_normal_paths() -> None:
    assert validate_entry_name("src/app/main.py") == "src/app/main.py"


def test_inspect_rejects_symlinks(write_zip) -> None:
    path = write_zip({"a.txt": b"x"}, symlinks=[("link", "../outside")])
    with pytest.raises(AppError) as exc:
        inspect_archive(path)
    assert "symbolic link" in exc.value.message.lower()


def test_inspect_rejects_too_many_files(write_zip, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "upload_max_files", 3)
    path = write_zip({f"f{i}.txt": b"x" for i in range(5)})
    with pytest.raises(AppError):
        inspect_archive(path)


def test_inspect_rejects_deep_nesting(write_zip, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "upload_max_nesting_depth", 3)
    deep = "/".join(["d"] * 10) + "/file.txt"
    path = write_zip({deep: b"x"})
    with pytest.raises(AppError):
        inspect_archive(path)


def test_inspect_rejects_compression_bomb(write_zip, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "upload_max_compression_ratio", 10)
    path = write_zip({"bomb.txt": b"A" * 200_000})
    with pytest.raises(AppError) as exc:
        inspect_archive(path)
    assert "compression" in exc.value.message.lower()


def test_inspect_rejects_non_zip(tmp_path: Path) -> None:
    path = tmp_path / "not.zip"
    path.write_bytes(b"definitely not a zip file")
    with pytest.raises(AppError) as exc:
        inspect_archive(path)
    assert exc.value.status_code == 415


def test_valid_archive_extracts_confined(tmp_path: Path, write_zip) -> None:
    path = write_zip({"src/main.py": b"print('hi')\n", "README.md": b"# demo\n"})
    dest = tmp_path / "out"
    report = inspect_archive(path)
    assert report.file_count == 2
    extract_archive(path, dest)
    assert (dest / "src" / "main.py").read_text() == "print('hi')\n"
