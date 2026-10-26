import time
from collections import defaultdict
from typing import Dict, List, Tuple
from fastapi import Request, HTTPException, status
from ..config import settings

# In-memory sliding window rate limiter: IP -> list of timestamps
_request_history: Dict[str, List[float]] = defaultdict(list)
WINDOW_SECONDS = 60


def check_rate_limit(request: Request) -> Tuple[bool, int]:
    """
    Check if the client IP has exceeded the allowed requests within the sliding window.
    Returns: (is_allowed, retry_after_seconds)
    """
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    limit = settings.RATE_LIMIT_PER_MINUTE

    # Prune timestamps older than WINDOW_SECONDS
    cutoff = now - WINDOW_SECONDS
    timestamps = [t for t in _request_history[client_ip] if t > cutoff]
    _request_history[client_ip] = timestamps

    if len(timestamps) >= limit:
        oldest = timestamps[0]
        retry_after = max(1, int(WINDOW_SECONDS - (now - oldest)))
        return False, retry_after

    _request_history[client_ip].append(now)
    return True, 0


async def rate_limit_dependency(request: Request):
    """FastAPI dependency enforcing rate limits."""
    allowed, retry_after = check_rate_limit(request)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please slow down your requests.",
            headers={"Retry-After": str(retry_after)},
        )
