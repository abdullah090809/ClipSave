import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.security.rate_limit import _request_history


@pytest.fixture(autouse=True)
def clear_rate_limits():
    _request_history.clear()


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
async def test_resolve_valid_mock_url():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {"url": "https://www.tiktok.com/@creativeuser/video/734891238910"}
        resp = await client.post("/v1/resolve", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "mock_test_123"
        assert data["sourceUrl"] == payload["url"]
        assert "mediaUrl" in data
        assert data["mediaUrl"].startswith("http")
        assert "title" in data
        assert "author" in data


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
async def test_security_headers_present():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/healthz")
        assert "x-request-id" in resp.headers
        assert resp.headers["x-content-type-options"] == "nosniff"
        assert resp.headers["x-frame-options"] == "DENY"
        assert resp.headers["server"] == "ClipSave-Resolver"
