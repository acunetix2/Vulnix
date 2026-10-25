"""Opaque cursor pagination helpers (keyset-based, stable ordering)."""

import base64
import json
from datetime import datetime
from typing import Any

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.core.errors import AppError


def encode_cursor(row: Any) -> str | None:
    if row is None or row.created_at is None:
        return None
    payload = json.dumps([row.created_at.isoformat(), row.id])
    return base64.urlsafe_b64encode(payload.encode()).decode()


def decode_cursor(cursor: str) -> tuple[datetime, str]:
    try:
        data = json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())
        # Bind a real datetime: comparing an ISO string against a DATETIME column
        # is a text comparison, and on SQLite the separator differs.
        return datetime.fromisoformat(str(data[0])), str(data[1])
    except Exception:
        raise AppError("INVALID_CURSOR", "The pagination cursor is invalid.", 400) from None


def paginate_desc(db: Session, query, model: Any, cursor: str | None, limit: int) -> tuple[list, str | None]:
    """Apply keyset pagination ordered by created_at DESC, id DESC."""
    if cursor:
        created, row_id = decode_cursor(cursor)
        query = query.filter(
            or_(
                model.created_at < created,
                and_(model.created_at == created, model.id < row_id),
            )
        )
    rows = db.scalars(query.order_by(model.created_at.desc(), model.id.desc()).limit(limit + 1)).all()
    # Encode the last row we hand back: the next page starts strictly after it.
    next_cursor = encode_cursor(rows[limit - 1]) if len(rows) > limit else None
    return rows[:limit], next_cursor
