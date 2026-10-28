"""The status surface: history for anyone, recording for the operator."""

from fastapi import APIRouter, Request

from app.api.dependencies import CurrentUser, DbSession
from app.core.rate_limit import check_rate_limit
from app.modules.status import service

router = APIRouter(prefix="/status", tags=["status"])


@router.get("", summary="Recorded service status and history")
def read_status(request: Request, db: DbSession, window: str = service.DEFAULT_WINDOW) -> dict:
    """What the scheduler last saw, plus one bucket per slice of the window.

    Unauthenticated by design: a status page is read by people who cannot sign in,
    and often at the moment signing in is what broke. It answers with the component
    names and one-word states the readiness endpoint already returns, so no
    configuration value, host or secret can ride out of it, and it is rate limited
    per client because it reads every stored check in the window.
    """
    client = request.client.host if request.client else "unknown"
    check_rate_limit(f"status:{client}", 30, 60)
    return service.summary(db, window)


@router.post("/probe", summary="Record one status check now")
def record_status(db: DbSession, user: CurrentUser) -> dict:
    """Make the check the scheduler makes, once, on demand.

    Beat owns the schedule; this exists so an operator who has just named an origin
    can watch a row appear instead of waiting for the next tick and guessing. It is
    authenticated because it has the server send an outbound request and write down
    what came back - two things a visitor should not be able to cause.
    """
    return service.probe(db)
