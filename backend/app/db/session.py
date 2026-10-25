"""Engine and session management.

Sync SQLAlchemy is used so the same sessions work in FastAPI (via threadpool)
and Celery workers without duplication.
"""

from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings


def _build_engine():
    kwargs: dict = {"pool_pre_ping": True}
    # The pinned driver is psycopg (v3), but a bare postgresql:// URL resolves to
    # psycopg2. Normalize so either form works without a second driver installed.
    db_url = settings.database_url
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)
    if db_url.startswith("sqlite"):
        # Ensure the parent directory exists for file-backed SQLite.
        if settings.database_url != "sqlite:///:memory:":
            db_path = settings.database_url.replace("sqlite:///", "", 1)
            if db_path and db_path != ":memory:":
                Path(db_path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)
        # In-memory SQLite needs a shared connection for multi-thread tests.
        kwargs = {"connect_args": {"check_same_thread": False}, "poolclass": StaticPool}
    return create_engine(db_url, **kwargs)


engine = _build_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> tuple[bool, str | None]:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True, None
    except Exception as exc:  # pragma: no cover - exercise via startup diagnostics
        return False, str(exc)


def init_db() -> None:
    """Create tables from metadata (dev/test only; production uses Alembic)."""
    from app.db import models  # noqa: F401  ensure models are registered
    from app.db.base import Base

    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        # Let the app keep booting in a degraded state so health checks can report
        # whether the database is reachable instead of crashing the whole process.
        raise
