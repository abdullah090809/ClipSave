import pytest
from app.security.ssrf import is_ip_blocked, verify_url_ssrf_safety


def test_blocked_ip_ranges():
    # Loopback
    assert is_ip_blocked("127.0.0.1") is True
    assert is_ip_blocked("127.0.0.5") is True
    assert is_ip_blocked("::1") is True

    # RFC 1918 Private ranges
    assert is_ip_blocked("10.0.0.1") is True
    assert is_ip_blocked("10.254.1.1") is True
    assert is_ip_blocked("172.16.0.1") is True
    assert is_ip_blocked("172.31.255.255") is True
    assert is_ip_blocked("192.168.1.1") is True
    assert is_ip_blocked("192.168.100.50") is True

    # Cloud metadata & Link-local
    assert is_ip_blocked("169.254.169.254") is True
    assert is_ip_blocked("169.254.1.1") is True

    # Zero / Broadcast
    assert is_ip_blocked("0.0.0.0") is True
    assert is_ip_blocked("255.255.255.255") is True

    # Valid Public IPs should NOT be blocked
    assert is_ip_blocked("8.8.8.8") is False
    assert is_ip_blocked("1.1.1.1") is False


def test_verify_url_ssrf_safety_direct_ip():
    assert verify_url_ssrf_safety("http://127.0.0.1/test")[0] is False
    assert verify_url_ssrf_safety("http://169.254.169.254/latest/meta-data")[0] is False
    assert verify_url_ssrf_safety("http://10.0.0.5/api")[0] is False
    assert verify_url_ssrf_safety("http://192.168.1.1/admin")[0] is False


def test_verify_url_ssrf_safety_public():
    # Public domain should pass SSRF check
    is_safe, _ = verify_url_ssrf_safety("https://www.tiktok.com/@user/video/123")
    assert is_safe is True
