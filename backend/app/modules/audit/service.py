"""Audit event recording for security-sensitive actions.

Metadata must never contain source code, secrets, tokens, or full prompts.
"""

from typing import Any

from sqlalchemy.orm import Session

from app.db.models import AuditEvent


def record_event(
    db: Session,
    *,
    workspace_id: str,
    actor_id: str | None,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditEvent(
            workspace_id=workspace_id,
            actor_id=actor_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            metadata_=metadata or {},
        )
    )
    db.commit()
