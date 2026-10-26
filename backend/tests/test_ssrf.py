import pytest
from unittest.mock import patch
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


def test_verify_url_ssrf_metadata_dns_simulation():
    # Simulates DNS returning AWS/GCP metadata service IP 169.254.169.254
    with patch("socket.getaddrinfo") as mock_dns:
        mock_dns.return_value = [
            (2, 1, 6, "", ("169.254.169.254", 80))
        ]
        is_safe, msg = verify_url_ssrf_safety("https://metadata.tiktok.com/latest")
        assert is_safe is False
        assert "169.254.169.254" in msg
