"""Alembic environment. Reads DATABASE_URL from application settings."""

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.db import models  # noqa: F401  register models on metadata
from app.db.base import Base

# Mirror app.db.session._build_engine: the pinned driver is psycopg (v3), but a
# bare postgresql:// URL resolves to psycopg2. env.py connects via
# engine_from_config, so it must normalize the scheme itself.
db_url = settings.database_url
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

config = context.config
# Escape '%' so URL-encoded passwords survive configparser interpolation.
config.set_main_option("sqlalchemy.url", db_url.replace("%", "%%"))
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # SQLite needs its parent directory to exist before connecting.
    if settings.database_url.startswith("sqlite:///"):
        from pathlib import Path

        db_path = settings.database_url.replace("sqlite:///", "", 1)
        if db_path and db_path != ":memory:":
            Path(db_path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
