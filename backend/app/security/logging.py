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
    Strips userinfo credentials, query parameters, and fragments from URL for privacy-safe logging.
    e.g. https://user:pass@host/path?token=secret -> https://host/path
    """
    if not url:
        return ""
    try:
        parsed = urlparse(url)
        port_suffix = f":{parsed.port}" if parsed.port and parsed.port not in (80, 443) else ""
        return f"{parsed.scheme}://{parsed.hostname or 'unknown'}{port_suffix}{parsed.path}"
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
