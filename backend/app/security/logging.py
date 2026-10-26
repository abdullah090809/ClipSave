import logging
import re
from urllib.parse import urlparse

logger = logging.getLogger("clipsave.resolver")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
)


def redact_url(url: str) -> str:
    """
    Strips query parameters and fragment from URL for privacy-safe logging.
    e.g. https://www.tiktok.com/@user/video/123?auth=secret -> https://www.tiktok.com/@user/video/123
    """
    if not url:
        return ""
    try:
        parsed = urlparse(url)
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    except Exception:
        return "[REDACTED_URL]"


def log_safe_info(message: str, url: str = ""):
    if url:
        safe_url = redact_url(url)
        logger.info(f"{message} | url={safe_url}")
    else:
        logger.info(message)


def log_safe_error(message: str, error: Exception, url: str = ""):
    # Redact sensitive patterns from error message
    err_str = str(error)
    err_str = re.sub(r"[?&][^=]+=[^& \n]+", "[PARAM_REDACTED]", err_str)
    if url:
        safe_url = redact_url(url)
        logger.error(f"{message} | error={err_str} | url={safe_url}")
    else:
        logger.error(f"{message} | error={err_str}")
