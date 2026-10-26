import pytest
from unittest.mock import MagicMock
from app.security.rate_limit import check_rate_limit, _request_history
from app.config import settings


def test_rate_limit_sliding_window():
    _request_history.clear()
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
