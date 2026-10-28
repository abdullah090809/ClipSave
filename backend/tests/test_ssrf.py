import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.security.ssrf import is_ip_blocked, verify_url_ssrf_safety


def test_blocked_ip_ranges():
    # Loopback
    assert is_ip_blocked("127.0.0.1") is True
    assert is_ip_blocked("127.0.0.5") is True
    assert is_ip_blocked("::1") is True
    assert is_ip_blocked("::") is True

    # RFC 1918 Private ranges
    assert is_ip_blocked("10.0.0.1") is True
    assert is_ip_blocked("10.254.1.1") is True
    assert is_ip_blocked("172.16.0.1") is True
    assert is_ip_blocked("172.31.255.255") is True
    assert is_ip_blocked("192.168.1.1") is True
    assert is_ip_blocked("192.168.100.50") is True

    # Carrier-grade NAT (100.64.0.0/10)
    assert is_ip_blocked("100.64.0.1") is True
    assert is_ip_blocked("100.127.255.255") is True

    # Cloud metadata & Link-local (169.254.0.0/16, fe80::/10)
    assert is_ip_blocked("169.254.169.254") is True
    assert is_ip_blocked("169.254.1.1") is True
    assert is_ip_blocked("fe80::1") is True

    # IPv6 Unique Local (fc00::/7)
    assert is_ip_blocked("fc00::1") is True
    assert is_ip_blocked("fd12:3456:789a::1") is True

    # Zero / Broadcast / Multicast
    assert is_ip_blocked("0.0.0.0") is True
    assert is_ip_blocked("255.255.255.255") is True
    assert is_ip_blocked("224.0.0.1") is True
    assert is_ip_blocked("ff02::1") is True

    # Valid Public IPs should NOT be blocked
    assert is_ip_blocked("8.8.8.8") is False
    assert is_ip_blocked("1.1.1.1") is False
    assert is_ip_blocked("142.250.190.46") is False


def test_verify_url_ssrf_safety_direct_ip():
    assert verify_url_ssrf_safety("http://127.0.0.1/test")[0] is False
    assert verify_url_ssrf_safety("http://169.254.169.254/latest/meta-data")[0] is False
    assert verify_url_ssrf_safety("http://10.0.0.5/api")[0] is False
    assert verify_url_ssrf_safety("http://192.168.1.1/admin")[0] is False
    assert verify_url_ssrf_safety("http://[::1]/secret")[0] is False


def test_verify_url_ssrf_safety_public():
    # Public domain should pass SSRF check
    is_safe, _ = verify_url_ssrf_safety("https://www.tiktok.com/@user/video/123")
    assert is_safe is True


def test_verify_url_ssrf_dns_rebinding_simulation():
    # Simulates DNS returning a private RFC1918 address
    with patch("socket.getaddrinfo") as mock_dns:
        mock_dns.return_value = [
            (2, 1, 6, "", ("127.0.0.1", 80))
        ]
        is_safe, msg = verify_url_ssrf_safety("https://evil-redirect.tiktok.com/exploit")
        assert is_safe is False
        assert "restricted IP" in msg


def test_verify_url_metadata_dns_simulation():
    # Simulates DNS returning AWS/GCP metadata service IP 169.254.169.254
    with patch("socket.getaddrinfo") as mock_dns:
        mock_dns.return_value = [
            (2, 1, 6, "", ("169.254.169.254", 80))
        ]
        is_safe, msg = verify_url_ssrf_safety("https://metadata.tiktok.com/latest")
        assert is_safe is False
        assert "169.254.169.254" in msg


def test_verify_url_disallowed_schemes():
    # Only HTTP and HTTPS are permitted
    assert verify_url_ssrf_safety("file:///etc/passwd")[0] is False
    assert verify_url_ssrf_safety("ftp://upload.tiktok.com/file")[0] is False
    assert verify_url_ssrf_safety("gopher://127.0.0.1:70/")[0] is False
    assert verify_url_ssrf_safety("data:text/plain;base64,SGVsbG8=")[0] is False


@pytest.mark.asyncio
async def test_stream_proxy_ssrf_upstream_rejected():
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    from app.services.extractor import register_stream_session, clear_stream_sessions

    clear_stream_sessions()
    session_id = "stream_ssrf_attack_1"
    # Register upstream pointing directly to AWS metadata service
    register_stream_session(
        stream_id=session_id,
        media_url="http://169.254.169.254/latest/meta-data/iam/security-credentials",
        headers={},
        title="Exploit",
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(f"/v1/stream/{session_id}")
        assert resp.status_code == 400
        data = resp.json()
        assert data["detail"]["code"] == "SSRF_RESTRICTED"


@pytest.mark.asyncio
async def test_stream_proxy_ssrf_redirect_to_metadata_blocked():
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    from app.services.extractor import register_stream_session, clear_stream_sessions
    from unittest.mock import AsyncMock

    clear_stream_sessions()
    session_id = "stream_ssrf_redirect_attack"
    register_stream_session(
        stream_id=session_id,
        media_url="https://attacker.example/redirect_exploit.mp4",
        headers={},
        title="Redirect Exploit",
    )

    # Mock public upstream that returns a 302 redirecting to AWS metadata IP
    mock_redirect_resp = MagicMock()
    mock_redirect_resp.status_code = 302
    mock_redirect_resp.headers = {"location": "http://169.254.169.254/latest/meta-data/"}
    mock_redirect_resp.aclose = AsyncMock()

    with patch("app.routes.resolve.httpx.AsyncClient") as mock_client_cls:
        mock_instance = MagicMock()
        mock_instance.build_request.return_value = "mock_request"
        mock_instance.send = AsyncMock(return_value=mock_redirect_resp)
        mock_instance.aclose = AsyncMock()
        mock_client_cls.return_value = mock_instance

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(f"/v1/stream/{session_id}")
            assert resp.status_code == 400
            data = resp.json()
            assert data["detail"]["code"] == "SSRF_RESTRICTED"
