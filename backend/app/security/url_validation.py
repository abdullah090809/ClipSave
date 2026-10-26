import re
from urllib.parse import urlparse
from typing import Tuple

ALLOWED_TIKTOK_HOSTS = {
    "tiktok.com",
    "www.tiktok.com",
    "m.tiktok.com",
    "vm.tiktok.com",
    "vt.tiktok.com",
    "v.douyin.com",
}

MAX_URL_LENGTH = 2048


def validate_tiktok_url(raw_url: str) -> Tuple[bool, str, str]:
    """
    Strictly validate that a submitted URL is an official TikTok URL.
    Returns: (is_valid, canonical_url_or_empty, error_message_or_empty)
    """
    if not raw_url or not isinstance(raw_url, str):
        return False, "", "URL must be a non-empty string."

    url = raw_url.strip()
    if len(url) > MAX_URL_LENGTH:
        return False, "", "URL exceeds maximum permitted length."

    # Reject ASCII control characters
    if any(ord(c) < 32 or ord(c) == 127 for c in url):
        return False, "", "URL contains illegal control characters."

    # Parse URL
    try:
        parsed = urlparse(url)
    except Exception:
        return False, "", "URL parsing failed."

    # Scheme check: only https (or http in testing)
    if parsed.scheme not in ("https", "http"):
        return False, "", f"Scheme '{parsed.scheme}' is not permitted. Only HTTP/HTTPS is allowed."

    # Userinfo check (user:pass@host is forbidden)
    if parsed.username or parsed.password:
        return False, "", "URLs with embedded credentials are forbidden."

    # Port check: standard HTTP/HTTPS ports only
    if parsed.port and parsed.port not in (80, 443):
        return False, "", "Non-standard network ports are forbidden."

    hostname = (parsed.hostname or "").lower()
    if not hostname:
        return False, "", "Missing hostname in URL."

    # Exact hostname allowlist match
    if hostname not in ALLOWED_TIKTOK_HOSTS:
        return False, "", f"Hostname '{hostname}' is not an authorized TikTok domain."

    # Path check: must have a video or share path
    if not parsed.path or parsed.path == "/":
        return False, "", "URL path is missing a specific video reference."

    return True, url, ""
