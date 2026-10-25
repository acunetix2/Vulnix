"""Safe ZIP inspection and extraction.

Uploaded archives are untrusted. We validate every entry before writing any
bytes to disk and never follow links or special files.
"""

import zipfile
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath

from app.core.config import settings
from app.core.errors import AppError

# Zip external_attr high 16 bits hold the Unix mode when created on Unix.
_S_IFMT = 0o170000
_S_IFLNK = 0o120000
_S_IFDIR = 0o040000


@dataclass
class ArchiveReport:
    file_count: int = 0
    total_uncompressed_bytes: int = 0
    files: list[str] = field(default_factory=list)


def _normalize_name(name: str) -> str:
    # Zip names use "/" but hostile archives may use "\" or drive letters.
    return name.replace("\\", "/").strip()


def validate_entry_name(name: str) -> str:
    """Return a safe relative POSIX path or raise."""
    clean = _normalize_name(name)
    if not clean or clean in (".", ".."):
        raise AppError("UNSAFE_ARCHIVE", "Archive contains an invalid entry name.", 422)
    if clean.startswith("/") or (len(clean) > 1 and clean[1] == ":"):
        raise AppError("UNSAFE_ARCHIVE", "Archive contains an absolute path.", 422)
    path = PurePosixPath(clean)
    if any(part in ("..", "") for part in path.parts):
        raise AppError("UNSAFE_ARCHIVE", "Archive contains a path traversal entry.", 422)
    if len(path.parts) > settings.upload_max_nesting_depth:
        raise AppError("UNSAFE_ARCHIVE", "Archive contains excessively nested paths.", 422)
    return str(path)


def _unix_mode(info: zipfile.ZipInfo) -> int:
    return (info.external_attr >> 16) & 0xFFFF


def inspect_archive(zip_path: Path) -> ArchiveReport:
    """Validate the whole archive without extracting it."""
    report = ArchiveReport()
    try:
        with zipfile.ZipFile(zip_path) as zf:
            infos = zf.infolist()
            if len(infos) > settings.upload_max_files:
                raise AppError("UNSAFE_ARCHIVE", "Archive contains too many entries.", 422)
            for info in infos:
                name = validate_entry_name(info.filename)
                mode = _unix_mode(info)
                if mode & _S_IFMT == _S_IFLNK:
                    raise AppError("UNSAFE_ARCHIVE", "Archive contains a symbolic link.", 422)
                if info.flag_bits & 0x1:  # encrypted entry
                    raise AppError("UNSAFE_ARCHIVE", "Encrypted archive entries are not supported.", 422)
                if info.file_size > settings.upload_max_entry_bytes:
                    raise AppError("UNSAFE_ARCHIVE", "Archive contains an oversized entry.", 422)
                report.total_uncompressed_bytes += info.file_size
                if report.total_uncompressed_bytes > settings.upload_max_uncompressed_bytes:
                    raise AppError("UNSAFE_ARCHIVE", "Archive expands beyond the allowed size.", 422)
                # Decompression bomb heuristic: huge expansion from tiny input.
                ratio = info.file_size / info.compress_size if info.compress_size else 0
                if ratio > settings.upload_max_compression_ratio:
                    raise AppError("UNSAFE_ARCHIVE", "Archive has a suspicious compression ratio.", 422)
                if not info.is_dir():
                    report.file_count += 1
                    report.files.append(name)
    except zipfile.BadZipFile:
        raise AppError("INVALID_ARCHIVE", "The uploaded file is not a valid ZIP archive.", 415) from None
    if report.file_count == 0:
        raise AppError("INVALID_ARCHIVE", "The archive contains no files.", 422)
    return report


def extract_archive(zip_path: Path, dest_dir: Path) -> ArchiveReport:
    """Extract a validated archive into dest_dir with path confinement."""
    report = inspect_archive(zip_path)
    dest = dest_dir.resolve()
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            name = validate_entry_name(info.filename)
            target = (dest / name).resolve()
            # Second confinement check at write time (defense in depth).
            if not target.is_relative_to(dest):
                raise AppError("UNSAFE_ARCHIVE", "Archive entry escapes the extraction directory.", 422)
            target.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(info) as src, target.open("wb") as out:
                while chunk := src.read(1024 * 1024):
                    out.write(chunk)
    return report
