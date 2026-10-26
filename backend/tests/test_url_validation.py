import pytest
from app.security.url_validation import validate_tiktok_url


def test_valid_tiktok_urls():
    valid_urls = [
        "https://www.tiktok.com/@user/video/734891238910",
        "https://tiktok.com/@user/video/734891238910",
        "https://vm.tiktok.com/ZM8rDq1s9/",
        "https://vt.tiktok.com/ZM8rDq1s9/",
        "https://m.tiktok.com/v/734891238910.html",
    ]
    for url in valid_urls:
        is_valid, canon, err = validate_tiktok_url(url)
        assert is_valid is True, f"Failed for {url}: {err}"
        assert canon == url


def test_reject_lookalike_domains():
    lookalikes = [
        "https://tiktok.com.attacker.example/video/123",
        "https://evil-tiktok.com/@user/video/123",
        "https://tiktok.com@attacker.example/video/123",
        "https://not-tiktok.com/video/123",
    ]
    for url in lookalikes:
        is_valid, _, err = validate_tiktok_url(url)
        assert is_valid is False
        assert "not an authorized TikTok domain" in err or "embedded credentials" in err


def test_reject_invalid_schemes():
    bad_schemes = [
        "file:///etc/passwd",
        "javascript:alert(1)",
        "ftp://tiktok.com/video/123",
        "intent://tiktok.com/video/123",
    ]
    for url in bad_schemes:
        is_valid, _, err = validate_tiktok_url(url)
        assert is_valid is False
        assert "not permitted" in err


def test_reject_userinfo():
    url = "https://user:password@www.tiktok.com/@user/video/123"
    is_valid, _, err = validate_tiktok_url(url)
    assert is_valid is False
    assert "embedded credentials" in err


def test_reject_non_standard_ports():
    url = "https://www.tiktok.com:8443/@user/video/123"
    is_valid, _, err = validate_tiktok_url(url)
    assert is_valid is False
    assert "Non-standard network ports" in err


def test_reject_missing_path():
    url = "https://www.tiktok.com/"
    is_valid, _, err = validate_tiktok_url(url)
    assert is_valid is False
    assert "missing a specific video reference" in err


def test_reject_control_characters():
    url = "https://www.tiktok.com/@user/video/123\x00\x1f"
    is_valid, _, err = validate_tiktok_url(url)
    assert is_valid is False
    assert "illegal control characters" in err
