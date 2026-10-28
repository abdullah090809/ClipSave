import time
import pytest
from unittest.mock import MagicMock
from app.security.rate_limit import (
    check_rate_limit,
    prune_stale_ips,
    reset_rate_limiter,
    _request_history,
)
from app.config import settings


@pytest.fixture(autouse=True)
def cleanup_limiter():
    reset_rate_limiter()
    yield
    reset_rate_limiter()


def test_rate_limit_sliding_window():
    mock_request = MagicMock()
    mock_request.client.host = "192.0.2.1"

    limit = settings.RATE_LIMIT_PER_MINUTE

    # Requests up to the limit should be allowed
    for _ in range(limit):
        allowed, retry_after = check_rate_limit(mock_request)
        assert allowed is True
        assert retry_after == 0

    # Next request immediately exceeds rate limit
    allowed, retry_after = check_rate_limit(mock_request)
    assert allowed is False
    assert retry_after > 0


def test_rate_limit_stale_ip_pruning():
    now = time.time()
    # Add an IP with an expired timestamp (70s ago)
    _request_history["198.51.100.1"] = [now - 70]
    # Add an active IP (10s ago)
    _request_history["198.51.100.2"] = [now - 10]

    prune_stale_ips(now - 60)

    assert "198.51.100.1" not in _request_history
    assert "198.51.100.2" in _request_history


def test_rate_limit_hard_cap_enforcement():
    now = time.time()
    import app.security.rate_limit as rl
    original_cap = rl.MAX_TRACKED_IPS
    try:
        rl.MAX_TRACKED_IPS = 20
        # Populate 25 IPs
        for i in range(25):
            _request_history[f"203.0.113.{i}"] = [now - i]

        prune_stale_ips(now - 60)
        # Should be trimmed down to at most MAX_TRACKED_IPS
        assert len(_request_history) <= 20
    finally:
        rl.MAX_TRACKED_IPS = original_cap
