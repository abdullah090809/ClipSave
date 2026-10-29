import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.security.rate_limit import _request_history


@pytest.fixture(autouse=True)
def clear_rate_limits():
    _request_history.clear()


@pytest.mark.asyncio
async def test_root_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "ClipSave" in data["app"]


@pytest.mark.asyncio
async def test_healthz_and_readyz():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/healthz")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "ClipSave" in data["app"]

        ready_resp = await client.get("/readyz")
        assert ready_resp.status_code == 200
        assert ready_resp.json()["status"] == "ready"


@pytest.mark.asyncio
async def test_stream_nonexistent_session():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/v1/stream/nonexistent_session_id_404")
        assert resp.status_code == 404
        detail = resp.json()["detail"]
        msg = detail["message"] if isinstance(detail, dict) else detail
        assert "Stream session expired" in msg


@pytest.mark.asyncio
async def test_resolve_valid_mock_url():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {"url": "https://www.tiktok.com/@creativeuser/video/734891238910"}
        resp = await client.post("/v1/resolve", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "mock_test_123"
        assert data["sourceUrl"] == payload["url"]
        assert data["platform"] == "tiktok"
        assert "mediaUrl" in data
        assert data["mediaUrl"].startswith("http")
        assert "title" in data
        assert "author" in data
        assert "availableFormats" in data
        assert len(data["availableFormats"]) >= 2
        # Check audio option is present
        assert any(f["quality"] == "audio" and f["extension"] == "mp3" for f in data["availableFormats"])


@pytest.mark.asyncio
async def test_resolve_valid_youtube_url():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {"url": "https://www.youtube.com/watch?v=aqz-KE-bpKQ"}
        resp = await client.post("/v1/resolve", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "mock_yt_123"
        assert data["sourceUrl"] == payload["url"]
        assert data["platform"] == "youtube"
        assert "availableFormats" in data
        # Check that 1080p, 720p, 360p, and audio only are provided
        quality_ids = [f["id"] for f in data["availableFormats"]]
        assert "1080p" in quality_ids
        assert "720p" in quality_ids
        assert "360p" in quality_ids
        assert "audio" in quality_ids


@pytest.mark.asyncio
async def test_resolve_valid_youtube_shorts_url():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {"url": "https://www.youtube.com/shorts/dQw4w9WgXcQ"}
        resp = await client.post("/v1/resolve", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["platform"] == "youtube"
        assert len(data["availableFormats"]) > 0



@pytest.mark.asyncio
async def test_resolve_invalid_domain_rejected():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {"url": "https://attacker.example/malicious"}
        resp = await client.post("/v1/resolve", json=payload)
        assert resp.status_code == 400
        err = resp.json()
        assert err["detail"]["code"] == "INVALID_URL"


@pytest.mark.asyncio
async def test_resolve_malformed_json():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/v1/resolve",
            content=b"{malformed json",
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_resolve_missing_url_field():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/v1/resolve", json={"wrongKey": "https://tiktok.com"})
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_resolve_non_string_url():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/v1/resolve", json={"url": 99999})
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_security_headers_present():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/healthz")
        assert "x-request-id" in resp.headers
        assert resp.headers["x-content-type-options"] == "nosniff"
        assert resp.headers["x-frame-options"] == "DENY"
        assert resp.headers["server"] == "ClipSave-Resolver"


@pytest.mark.asyncio
async def test_request_id_forwarding():
    custom_id = "clipsave-trace-test-uuid-999"
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/healthz", headers={"X-Request-ID": custom_id})
        assert resp.headers.get("x-request-id") == custom_id


@pytest.mark.asyncio
async def test_cors_local_network_origin():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = {
            "Origin": "http://192.168.1.100:8081",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        }
        resp = await client.options("/v1/resolve", headers=headers)
        assert resp.status_code == 200
        assert resp.headers.get("access-control-allow-origin") == "http://192.168.1.100:8081"
