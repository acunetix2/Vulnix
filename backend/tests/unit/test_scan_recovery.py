"""Keeping the record of a scan that died, when the death was the connection.

One live run lost its database connection in the middle of a hosted model call.
The scan answered 500, the row stayed ``running`` forever, and the steps already
reviewed were gone with the session that could no longer write them.
"""

from sqlalchemy.exc import OperationalError

from app.db.models import Scan
from app.scanning.pipeline import Trace, _recover_crash


class ConnectionGone(Exception):
    """What the pool reports when the server closed the connection."""


def _gone() -> OperationalError:
    return OperationalError("UPDATE scans SET status=%s", {}, ConnectionGone())


class Dead:
    """A session that cannot be made writable again at all."""

    def rollback(self) -> None:
        raise _gone()

    def get(self, model, pk):
        raise AssertionError("a session that failed to roll back gets no writes")


class FakeSession:
    """A session whose commits fail for the first ``failures`` attempts."""

    def __init__(self, failures: int = 0) -> None:
        self.failures = failures
        self.commits = 0
        self.rollbacks = 0
        self.scan = Scan(id="scan-1", status="running")

    def __enter__(self) -> "FakeSession":
        return self

    def __exit__(self, *exc_info: object) -> bool:
        return False

    def commit(self) -> None:
        self.commits += 1
        if self.commits <= self.failures:
            raise _gone()

    def rollback(self) -> None:
        self.rollbacks += 1

    def get(self, model, pk) -> Scan:
        return self.scan


def test_a_broken_transaction_is_repaired_before_the_result_is_written() -> None:
    """The common half of a crash: the session poisoned, the connection still live."""
    live = FakeSession()
    _recover_crash(live, "scan-1")
    assert live.rollbacks == 1
    assert (live.scan.status, live.scan.error_code) == ("failed", "INTERNAL_ERROR")
    assert live.scan.completed_at is not None


def test_a_crash_is_recorded_on_a_fresh_session_when_the_first_is_dead(monkeypatch) -> None:
    """A dead connection needs a new one, not a retry on the corpse."""
    fresh = FakeSession()
    monkeypatch.setattr("app.scanning.pipeline.SessionLocal", lambda: fresh)
    _recover_crash(Dead(), "scan-1")
    assert (fresh.scan.status, fresh.scan.error_code) == ("failed", "INTERNAL_ERROR")


def test_a_crash_that_cannot_be_recorded_even_on_a_new_session_is_logged(monkeypatch) -> None:
    """POST /scans already committed the row, so the database must not make it a 500.

    A scan that stays ``running`` after its process stopped is a lie the console
    repeats on every poll, but raising here moves that lie into the request.
    """
    monkeypatch.setattr("app.scanning.pipeline.SessionLocal", lambda: FakeSession(failures=99))
    _recover_crash(Dead(), "scan-1")


def test_a_finished_scan_is_left_alone() -> None:
    """A crash after the result was written must not rewrite it with a failure."""
    live = FakeSession()
    live.scan.status = "completed"
    _recover_crash(live, "scan-1")
    assert live.scan.error_code is None
    assert live.commits == 0


def test_a_step_is_written_once_more_on_a_connection_that_died_mid_review() -> None:
    """Losing one step line is cheap; losing the run that produced it is not."""
    scan = Scan(id="scan-1", summary=None)
    db = FakeSession(failures=1)
    db.scan = scan
    Trace(db, scan)("app/login.py", "running")
    assert [step["label"] for step in scan.summary["steps"]] == ["app/login.py"]
    assert (db.commits, db.rollbacks) == (2, 1)


def test_a_trace_that_can_never_write_gives_up_instead_of_failing_the_scan() -> None:
    """Two tries, then the trace is progress and the review keeps going."""
    scan = Scan(id="scan-1", summary=None)
    db = FakeSession(failures=99)
    db.scan = scan
    Trace(db, scan)("app/login.py", "running")
    assert (db.commits, db.rollbacks) == (2, 2)
