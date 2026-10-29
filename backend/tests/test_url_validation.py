import pytest
from app.security.url_validation import validate_tiktok_url, validate_media_url


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


def test_validate_youtube_urls():
    yt_urls = [
        ("https://www.youtube.com/watch?v=aqz-KE-bpKQ", "youtube"),
        ("https://youtube.com/watch?v=aqz-KE-bpKQ&t=10s", "youtube"),
        ("https://www.youtube.com/shorts/dQw4w9WgXcQ", "youtube"),
        ("https://youtu.be/dQw4w9WgXcQ", "youtube"),
        ("https://m.youtube.com/watch?v=aqz-KE-bpKQ", "youtube"),
    ]
    for url, expected_platform in yt_urls:
        is_valid, canon, platform, err = validate_media_url(url)
        assert is_valid is True, f"Failed for {url}: {err}"
        assert platform == expected_platform
        assert canon == url


def test_reject_youtube_missing_video_id():
    url = "https://www.youtube.com/watch"
    is_valid, _, platform, err = validate_media_url(url)
    assert is_valid is False
    assert "missing video ID" in err


def test_reject_youtube_root():
    url = "https://www.youtube.com/"
    is_valid, _, platform, err = validate_media_url(url)
    assert is_valid is False
    assert "missing a specific YouTube video reference" in err


def test_validate_instagram_urls():
    ig_urls = [
        ("https://www.instagram.com/reel/C8q8q0_PzZg/", "instagram"),
        ("https://instagram.com/reels/C8q8q0_PzZg/", "instagram"),
        ("https://www.instagram.com/p/C8q8q0_PzZg/", "instagram"),
        ("https://instagr.am/reel/C8q8q0_PzZg/", "instagram"),
        ("https://m.instagram.com/reel/C8q8q0_PzZg/", "instagram"),
    ]
    for url, expected_platform in ig_urls:
        is_valid, canon, platform, err = validate_media_url(url)
        assert is_valid is True, f"Failed for {url}: {err}"
        assert platform == expected_platform
        assert canon == url


def test_reject_instagram_root():
    url = "https://www.instagram.com/"
    is_valid, _, platform, err = validate_media_url(url)
    assert is_valid is False
    assert "missing a reel or post reference" in err


def test_validate_facebook_urls():
    fb_urls = [
        ("https://www.facebook.com/reel/1022646279145698", "facebook"),
        ("https://facebook.com/watch/?v=123456789", "facebook"),
        ("https://fb.watch/mX7d8E9v/", "facebook"),
        ("https://m.facebook.com/story.php?story_fbid=123&id=456", "facebook"),
        ("https://www.facebook.com/username/videos/123456789/", "facebook"),
        ("https://www.facebook.com/share/r/abc123xyz/", "facebook"),
    ]
    for url, expected_platform in fb_urls:
        is_valid, canon, platform, err = validate_media_url(url)
        assert is_valid is True, f"Failed for {url}: {err}"
        assert platform == expected_platform
        assert canon == url


def test_reject_facebook_root():
    url = "https://www.facebook.com/"
    is_valid, _, platform, err = validate_media_url(url)
    assert is_valid is False
    assert "missing a video or reel reference" in err


def test_reject_unsupported_platform():
    reddit_url = "https://www.reddit.com/r/videos/comments/123/sample/"
    is_valid, _, platform, err = validate_media_url(reddit_url)
    assert is_valid is False
    assert platform == "unknown"
    assert "not an authorized domain" in err
