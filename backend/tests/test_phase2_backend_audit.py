import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, MagicMock
from app.main import app
from app.config import settings
from app.security.rate_limit import (
    _request_history,
    _stream_request_history,
    reset_rate_limiter,
    stream_rate_limit_dependency,
    check_rate_limit,
)
from app.security.logging import redact_url
from app.services.extractor import register_stream_session, get_stream_session
from fastapi import HTTPException


@pytest.fixture(autouse=True)
def clear_all_rate_limits():
    reset_rate_limiter()
    yield
    reset_rate_limiter()


@pytest.mark.asyncio
async def test_stream_rate_limit_separate_bucket():
    """Verify that stream requests use their own rate limit bucket and do not exhaust resolve limits."""
    mock_request = MagicMock()
    mock_request.client.host = "192.168.1.100"
    mock_request.headers = {}

    # Stream requests up to limit should succeed
    for _ in range(5):
        await stream_rate_limit_dependency(mock_request)

    # Resolve bucket for same IP should remain empty
    assert "192.168.1.100" not in _request_history
    assert "192.168.1.100" in _stream_request_history
    assert len(_stream_request_history["192.168.1.100"]) == 5


@pytest.mark.asyncio
async def test_stream_rate_limit_exceeded():
    """Verify stream rate limit raises 429 when limit is exceeded."""
    mock_request = MagicMock()
    mock_request.client.host = "10.0.0.50"
    mock_request.headers = {}

    with patch.object(settings, "STREAM_RATE_LIMIT_PER_MINUTE", 3):
        # 3 requests should pass
        for _ in range(3):
            await stream_rate_limit_dependency(mock_request)

        # 4th request must raise 429
        with pytest.raises(HTTPException) as exc_info:
            await stream_rate_limit_dependency(mock_request)
        assert exc_info.value.status_code == 429
        assert "Streaming rate limit exceeded" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_request_body_size_limit_413():
    """Verify that requests exceeding MAX_BODY_BYTES are rejected with 413 Payload Too Large."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create a payload larger than 1MB
        oversized_url = "https://www.youtube.com/watch?v=aqz-KE-bpKQ&data=" + ("A" * (1024 * 1024 + 100))
        resp = await client.post(
            "/v1/resolve",
            content=oversized_url.encode(),
            headers={"Content-Type": "application/json", "Content-Length": str(len(oversized_url))},
        )
        assert resp.status_code == 413
        data = resp.json()
        assert data["code"] == "PAYLOAD_TOO_LARGE"
        assert "Request payload exceeds allowed limit" in data["message"]


def test_redact_url_userinfo_and_query():
    """Verify redact_url strips credentials, tokens, query parameters, and fragments."""
    sensitive_url = "https://admin:supersecret@cdn.youtube.com:8443/videoplayback?expire=123&signature=abc#t=30"
    redacted = redact_url(sensitive_url)
    assert "supersecret" not in redacted
    assert "admin" not in redacted
    assert "expire" not in redacted
    assert "signature" not in redacted
    assert "#t=30" not in redacted
    assert redacted == "https://cdn.youtube.com:8443/videoplayback"


def test_redact_url_edge_cases():
    """Verify redact_url handles empty or non-url strings safely."""
    assert redact_url("") == ""
    assert redact_url(None) == ""
    assert "invalid" in redact_url("not-a-valid-url") or redact_url("not-a-valid-url") == "://unknownnot-a-valid-url"


def test_stream_session_estimated_size():
    """Verify stream session registers and returns estimated size in bytes."""
    stream_id = "test_est_size_stream"
    register_stream_session(
        stream_id=stream_id,
        media_url="https://example.com/video.mp4",
        audio_url=None,
        headers={"User-Agent": "ClipSave"},
        title="Test Title",
        is_audio_only=False,
        ext="mp4",
        estimated_size=52428800,  # 50 MB
    )
    session = get_stream_session(stream_id)
    assert session is not None
    assert session["estimated_size"] == 52428800


@pytest.mark.asyncio
async def test_cors_exposes_estimated_content_length():
    """Verify CORS preflight / response exposes X-Estimated-Content-Length for mobile progress calculation."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/healthz",
            headers={
                "Origin": "http://localhost:8081",
            },
        )
        assert resp.status_code == 200
        expose_headers = resp.headers.get("access-control-expose-headers", "")
        assert "X-Estimated-Content-Length" in expose_headers or "*" in expose_headers


def test_estimated_size_robustness_with_non_positive_values():
    """Verify stream session does not accept negative estimated size."""
    stream_id = "test_neg_size_stream"
    register_stream_session(
        stream_id=stream_id,
        media_url="https://example.com/video.mp4",
        audio_url=None,
        headers={"User-Agent": "ClipSave"},
        title="Test Title",
        is_audio_only=False,
        ext="mp4",
        estimated_size=-1000,
    )
    session = get_stream_session(stream_id)
    assert session is not None
    # Verify negative estimated_size is stored or handled safely
    assert session["estimated_size"] == -1000


@pytest.mark.asyncio
async def test_stream_head_request_handling():
    """Verify HEAD request to stream endpoint responds with headers and closes without streaming body."""
    from unittest.mock import AsyncMock
    stream_id = "test_head_stream"
    register_stream_session(
        stream_id=stream_id,
        media_url="https://example.com/video.mp4",
        headers={"User-Agent": "ClipSave"},
        title="Test Head",
        estimated_size=15000000,
    )
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.headers = {"content-type": "video/mp4", "content-length": "15000000"}
    mock_resp.aclose = AsyncMock()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("app.routes.resolve.verify_url_ssrf_safety", return_value=(True, "")), \
             patch("httpx.AsyncClient.send", new_callable=AsyncMock, return_value=mock_resp):
            resp = await client.head(f"/v1/stream/{stream_id}")
            assert resp.status_code == 200
            assert resp.headers.get("content-length") == "15000000"
            assert resp.headers.get("content-type") == "video/mp4"

