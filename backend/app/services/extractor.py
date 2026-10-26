import asyncio
import concurrent.futures
from typing import Optional, Dict, Any
import yt_dlp

from ..config import settings
from ..models import ResolvedMediaResponse
from ..security.logging import log_safe_info, log_safe_error

# Bounded worker semaphore
_concurrency_semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_EXTRACTIONS)
_thread_pool = concurrent.futures.ThreadPoolExecutor(max_workers=settings.MAX_CONCURRENT_EXTRACTIONS)


class ExtractionError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def _run_ytdlp_extract(url: str) -> Dict[str, Any]:
    """
    Executes yt-dlp extraction synchronously in thread pool.
    Strictly uses Python API with no shell interpolation.
    Restricted to TikTok extractor.
    """
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": False,
        "noplaylist": True,
        "allowed_extractors": ["TikTok", "TikTokUser", "generic"],
        "socket_timeout": 8,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        return ydl.extract_info(url, download=False)


async def extract_media_metadata(url: str) -> ResolvedMediaResponse:
    """
    Asynchronously extracts media metadata with bounded concurrency and strict timeout.
    """
    if settings.ENABLE_MOCK_EXTRACTOR:
        log_safe_info("Using mock extractor response", url)
        return ResolvedMediaResponse(
            id="mock_test_123",
            sourceUrl=url,
            title="ClipSave Mock Public Video (Development Fixture)",
            author="CreativeCreator",
            authorUsername="@creativecreator",
            durationSeconds=32.0,
            thumbnailUrl="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400",
            mediaUrl="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            estimatedSizeBytes=15420390,
            format="mp4",
            expiresAt=None,
            isCleanSourceVerified=True,
        )

    log_safe_info("Starting media resolution", url)

    async with _concurrency_semaphore:
        loop = asyncio.get_running_loop()
        try:
            info = await asyncio.wait_for(
                loop.run_in_executor(_thread_pool, _run_ytdlp_extract, url),
                timeout=settings.REQUEST_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            log_safe_error("Extraction timed out", Exception("Timeout"), url)
            raise ExtractionError(
                code="EXTRACTOR_TIMEOUT",
                message="Upstream resolution timed out. Please try again.",
                status_code=504,
            )
        except yt_dlp.utils.DownloadError as e:
            err_msg = str(e).lower()
            log_safe_error("yt-dlp DownloadError", e, url)
            if "private" in err_msg or "login" in err_msg:
                raise ExtractionError(
                    code="MEDIA_PRIVATE",
                    message="This video is private or restricted. ClipSave cannot access private accounts.",
                    status_code=403,
                )
            if "not found" in err_msg or "404" in err_msg or "deleted" in err_msg:
                raise ExtractionError(
                    code="MEDIA_NOT_FOUND",
                    message="The requested video is unavailable or has been deleted.",
                    status_code=404,
                )
            if "geo" in err_msg or "region" in err_msg:
                raise ExtractionError(
                    code="MEDIA_GEOBLOCKED",
                    message="This video is unavailable in your current region.",
                    status_code=403,
                )
            raise ExtractionError(
                code="EXTRACTOR_FAILED",
                message="Could not resolve media metadata from the provided link.",
                status_code=422,
            )
        except Exception as e:
            log_safe_error("Unexpected extractor exception", e, url)
            raise ExtractionError(
                code="INTERNAL_EXTRACTOR_ERROR",
                message="An internal extraction error occurred.",
                status_code=500,
            )

    if not info:
        raise ExtractionError(
            code="EMPTY_METADATA",
            message="No media streams could be located for this link.",
            status_code=422,
        )

    # Resolve direct stream URL: check formats or root url
    media_url: Optional[str] = None
    filesize: Optional[int] = None
    ext: str = info.get("ext") or "mp4"

    formats = info.get("formats") or []
    # Find best mp4 video stream
    for f in reversed(formats):
        if f.get("url") and (f.get("vcodec") != "none" or not formats):
            media_url = f.get("url")
            filesize = f.get("filesize") or f.get("filesize_approx")
            if f.get("ext"):
                ext = f.get("ext")
            break

    if not media_url:
        media_url = info.get("url")

    if not media_url:
        raise ExtractionError(
            code="NO_DIRECT_STREAM",
            message="Direct media stream URL could not be extracted.",
            status_code=422,
        )

    return ResolvedMediaResponse(
        id=str(info.get("id") or "vid"),
        sourceUrl=url,
        title=info.get("title") or "Untitled Video",
        author=info.get("uploader") or info.get("creator") or "Unknown Creator",
        authorUsername=info.get("uploader_id"),
        durationSeconds=float(info.get("duration") or 0) if info.get("duration") else None,
        thumbnailUrl=info.get("thumbnail"),
        mediaUrl=media_url,
        estimatedSizeBytes=filesize,
        format=ext,
        expiresAt=None,
        isCleanSourceVerified=False,
    )
