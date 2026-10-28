import time
from typing import Dict, List, Tuple
from fastapi import Request, HTTPException, status
from ..config import settings

# In-memory sliding window rate limiter: IP -> list of timestamps
# Bounded to prevent memory exhaustion under distributed scanning
_request_history: Dict[str, List[float]] = {}
WINDOW_SECONDS = 60
MAX_TRACKED_IPS = 10000
_SWEEP_THRESHOLD = 500


def prune_stale_ips(cutoff: float) -> None:
    """Purge stale and empty IP tracking records from memory."""
    stale_keys = [ip for ip, timestamps in _request_history.items() if not timestamps or timestamps[-1] <= cutoff]
    for ip in stale_keys:
        _request_history.pop(ip, None)

    # Hard cap enforcement
    if len(_request_history) > MAX_TRACKED_IPS:
        excess = len(_request_history) - MAX_TRACKED_IPS + 1000
        oldest_ips = sorted(
            _request_history.keys(),
            key=lambda ip: _request_history[ip][-1] if _request_history[ip] else 0
        )
        for ip in oldest_ips[:excess]:
            _request_history.pop(ip, None)


def check_rate_limit(request: Request) -> Tuple[bool, int]:
    """
    Check if the client IP has exceeded the allowed requests within the sliding window.
    Returns: (is_allowed, retry_after_seconds)
    Safely prunes expired timestamps and IP records to avoid memory leaks.
    """
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    limit = settings.RATE_LIMIT_PER_MINUTE
    cutoff = now - WINDOW_SECONDS

    # Periodic dictionary sweep when tracked IP count crosses threshold
    if len(_request_history) > _SWEEP_THRESHOLD:
        prune_stale_ips(cutoff)

    # Prune timestamps for current client IP
    existing_timestamps = _request_history.get(client_ip, [])
    active_timestamps = [t for t in existing_timestamps if t > cutoff]

    if len(active_timestamps) >= limit:
        _request_history[client_ip] = active_timestamps
        oldest = active_timestamps[0]
        retry_after = max(1, int(WINDOW_SECONDS - (now - oldest)))
        return False, retry_after

    active_timestamps.append(now)
    _request_history[client_ip] = active_timestamps
    return True, 0


def reset_rate_limiter() -> None:
    """Reset rate limiter state (used primarily for test isolation)."""
    _request_history.clear()


async def rate_limit_dependency(request: Request):
    """FastAPI dependency enforcing rate limits."""
    allowed, retry_after = check_rate_limit(request)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please slow down your requests.",
            headers={"Retry-After": str(retry_after)},
        )
