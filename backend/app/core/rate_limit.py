"""In-process fixed-window rate limiter.

MVP scope: single-process only. Swap for a Redis-backed limiter before
horizontal scaling.
"""

import time
from collections import defaultdict

from app.core.errors import AppError

_windows: dict[str, tuple[int, int]] = defaultdict(lambda: (0, 0))


def check_rate_limit(key: str, limit: int, window_seconds: int = 60) -> None:
    """Raise 429 when the caller exceeds `limit` within the window."""
    now = int(time.time())
    window_start, count = _windows[key]
    if now - window_start >= window_seconds:
        window_start, count = now, 0
    count += 1
    _windows[key] = (window_start, count)
    if count > limit:
        raise AppError("RATE_LIMITED", "Too many requests. Try again later.", 429)


def reset_limits() -> None:
    """Test helper to clear counters."""
    _windows.clear()
