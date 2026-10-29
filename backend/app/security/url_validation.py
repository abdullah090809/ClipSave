import re
from urllib.parse import urlparse, parse_qs
from typing import Tuple

ALLOWED_TIKTOK_HOSTS = {
    "tiktok.com",
    "www.tiktok.com",
    "m.tiktok.com",
    "vm.tiktok.com",
    "vt.tiktok.com",
    "v.douyin.com",
}

ALLOWED_YOUTUBE_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
    "music.youtube.com",
}

ALLOWED_INSTAGRAM_HOSTS = {
    "instagram.com",
    "www.instagram.com",
    "m.instagram.com",
    "instagr.am",
    "ddinstagram.com",
}

ALLOWED_FACEBOOK_HOSTS = {
    "facebook.com",
    "www.facebook.com",
    "m.facebook.com",
    "fb.watch",
    "web.facebook.com",
    "fb.com",
}

MAX_URL_LENGTH = 2048


def validate_media_url(raw_url: str) -> Tuple[bool, str, str, str]:
    """
    Validate and detect platform for media URLs (YouTube, TikTok, and future platforms).
    Returns: (is_valid, canonical_url, platform, error_message)
    """
    if not raw_url or not isinstance(raw_url, str):
        return False, "", "", "URL must be a non-empty string."

    url = raw_url.strip()
    if len(url) > MAX_URL_LENGTH:
        return False, "", "", "URL exceeds maximum permitted length."

    # Reject ASCII control characters
    if any(ord(c) < 32 or ord(c) == 127 for c in url):
        return False, "", "", "URL contains illegal control characters."

    # Parse URL
    try:
        parsed = urlparse(url)
    except Exception:
        return False, "", "", "URL parsing failed."

    # Scheme check: only https (or http in testing)
    if parsed.scheme not in ("https", "http"):
        return False, "", "", f"Scheme '{parsed.scheme}' is not permitted. Only HTTP/HTTPS is allowed."

    # Userinfo check (user:pass@host is forbidden)
    if parsed.username or parsed.password:
        return False, "", "", "URLs with embedded credentials are forbidden."

    # Port check: standard HTTP/HTTPS ports only
    if parsed.port and parsed.port not in (80, 443):
        return False, "", "", "Non-standard network ports are forbidden."

    hostname = (parsed.hostname or "").lower()
    if not hostname:
        return False, "", "", "Missing hostname in URL."

    # Instagram check
    if hostname in ALLOWED_INSTAGRAM_HOSTS:
        path = parsed.path or ""
        is_reel = path.startswith("/reel/") or path.startswith("/reels/")
        is_post = path.startswith("/p/")
        is_tv = path.startswith("/tv/")
        is_share = path.startswith("/share/")
        if not is_reel and not is_post and not is_tv and not is_share and len(path) <= 1:
            return False, "", "instagram", "Instagram link is missing a reel or post reference."
        return True, url, "instagram", ""

    # Facebook check
    if hostname in ALLOWED_FACEBOOK_HOSTS:
        path = parsed.path or ""
        is_fb_watch_host = hostname == "fb.watch" and len(path) > 1
        is_reel = path.startswith("/reel/") or path.startswith("/reels/") or path.startswith("/share/r/")
        is_watch = (path.startswith("/watch") or path.startswith("/watch/")) and bool(parse_qs(parsed.query).get("v"))
        is_video = "/videos/" in path or path.startswith("/share/v/")
        is_php_video = path.startswith("/video.php") and bool(parse_qs(parsed.query).get("v"))

        if not is_fb_watch_host and not is_reel and not is_watch and not is_video and not is_php_video and len(path) <= 1:
            return False, "", "facebook", "Facebook link is missing a video or reel reference."

        return True, url, "facebook", ""

    # YouTube check
    if hostname in ALLOWED_YOUTUBE_HOSTS:
        path = parsed.path or ""
        is_short = path.startswith("/shorts/")
        is_watch = path == "/watch"
        is_embed = path.startswith("/embed/")
        is_youtu_be = hostname == "youtu.be" and len(path) > 1

        if is_watch:
            query_params = parse_qs(parsed.query)
            if "v" not in query_params or not query_params["v"][0]:
                return False, "", "youtube", "YouTube watch URL is missing video ID parameter ('v')."
        elif not is_short and not is_embed and not is_youtu_be:
            return False, "", "youtube", "URL path is missing a specific YouTube video reference."

        return True, url, "youtube", ""

    # TikTok check
    if hostname in ALLOWED_TIKTOK_HOSTS:
        # Path check: must have a video or share path
        if not parsed.path or parsed.path == "/":
            return False, "", "tiktok", "URL path is missing a specific video reference."
        return True, url, "tiktok", ""

    return False, "", "unknown", f"Hostname '{hostname}' is not an authorized domain. Only YouTube, TikTok, Instagram, and Facebook links are supported."


def validate_tiktok_url(raw_url: str) -> Tuple[bool, str, str]:
    """
    Strictly validate that a submitted URL is an official TikTok URL (backward-compatible).
    Returns: (is_valid, canonical_url_or_empty, error_message_or_empty)
    """
    is_valid, canon_url, platform, err = validate_media_url(raw_url)
    if not is_valid:
        # If rejected for unauthorized domain, preserve exact legacy phrasing
        if "not an authorized domain" in err:
            parsed = urlparse(raw_url.strip()) if raw_url else None
            hostname = (parsed.hostname or "").lower() if parsed else ""
            return False, "", f"Hostname '{hostname}' is not an authorized TikTok domain."
        return False, "", err

    if platform != "tiktok":
        return False, "", f"URL is from {platform}, not an authorized TikTok domain."

    return True, canon_url, ""
