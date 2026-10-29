import asyncio
import concurrent.futures
import secrets
import time
from typing import Optional, Dict, Any, List
import yt_dlp

from ..config import settings
from ..models import ResolvedMediaResponse, MediaFormatOption
from ..security.logging import log_safe_info, log_safe_error

# In-memory stream session registry for proxying protected streams
# Bounded to prevent memory exhaustion under continuous load
MAX_STREAM_SESSIONS = 5000
_stream_sessions: Dict[str, Dict[str, Any]] = {}


def register_stream_session(
    stream_id: str,
    media_url: str,
    headers: Dict[str, str],
    title: str,
    audio_url: Optional[str] = None,
    is_audio_only: bool = False,
    ext: str = "mp4",
) -> None:
    now = time.time()
    # Expire sessions older than 2 hours (7200 seconds)
    expired = [k for k, v in _stream_sessions.items() if now - v.get("created_at", 0) > 7200]
    for k in expired:
        _stream_sessions.pop(k, None)

    # Enforce capacity cap: evict oldest sessions if registry is full
    if len(_stream_sessions) >= MAX_STREAM_SESSIONS:
        excess = len(_stream_sessions) - MAX_STREAM_SESSIONS + 1
        sorted_keys = sorted(_stream_sessions.keys(), key=lambda k: _stream_sessions[k].get("created_at", 0))
        for ok in sorted_keys[:excess]:
            _stream_sessions.pop(ok, None)

    _stream_sessions[stream_id] = {
        "media_url": media_url,
        "audio_url": audio_url,
        "headers": headers,
        "title": title,
        "is_audio_only": is_audio_only,
        "ext": ext,
        "created_at": now,
    }


def get_stream_session(stream_id: str) -> Optional[Dict[str, Any]]:
    return _stream_sessions.get(stream_id)


def clear_stream_sessions() -> None:
    """Clear all stream sessions (used primarily for test isolation)."""
    _stream_sessions.clear()


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
    Supports YouTube (Shorts & Videos), TikTok, and generic extractors.
    """
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": False,
        "noplaylist": True,
        "allowed_extractors": [
            "TikTok",
            "TikTokUser",
            "youtube",
            "Youtube",
            "YoutubeShorts",
            "generic",
        ],
        "socket_timeout": 15,
        "js_runtimes": {"node": {}},
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        if info:
            cookie_dict = {c.name: c.value for c in ydl.cookiejar}
            info["_extracted_cookies"] = cookie_dict
        return info


async def extract_media_metadata(url: str, base_url: Optional[str] = None) -> ResolvedMediaResponse:
    """
    Asynchronously extracts media metadata with bounded concurrency, strict timeout,
    and multiple format options (1080p, 720p, 360p, audio only).
    """
    is_youtube = "youtube.com" in url.lower() or "youtu.be" in url.lower()
    platform = "youtube" if is_youtube else "tiktok"

    if settings.ENABLE_MOCK_EXTRACTOR:
        log_safe_info("Using mock extractor response", url)
        host_prefix = base_url.rstrip("/") if base_url else "http://test"

        if is_youtube:
            # YouTube Mock Metadata
            formats = [
                MediaFormatOption(
                    id="1080p",
                    label="1080p Full HD",
                    quality="1080p",
                    extension="mp4",
                    isVideo=True,
                    mediaUrl=f"{host_prefix}/v1/stream/mock_yt_1080p",
                    estimatedSizeBytes=45200000,
                    note="Full HD",
                ),
                MediaFormatOption(
                    id="720p",
                    label="720p HD",
                    quality="720p",
                    extension="mp4",
                    isVideo=True,
                    mediaUrl=f"{host_prefix}/v1/stream/mock_yt_720p",
                    estimatedSizeBytes=22100000,
                    note="HD",
                ),
                MediaFormatOption(
                    id="360p",
                    label="360p SD",
                    quality="360p",
                    extension="mp4",
                    isVideo=True,
                    mediaUrl=f"{host_prefix}/v1/stream/mock_yt_360p",
                    estimatedSizeBytes=8400000,
                    note="Fast / Data Saver",
                ),
                MediaFormatOption(
                    id="audio",
                    label="Audio Only (MP3)",
                    quality="audio",
                    extension="mp3",
                    isVideo=False,
                    mediaUrl=f"{host_prefix}/v1/stream/mock_yt_audio",
                    estimatedSizeBytes=3800000,
                    note="High Quality MP3",
                ),
            ]
            return ResolvedMediaResponse(
                id="mock_yt_123",
                sourceUrl=url,
                platform="youtube",
                title="Sample YouTube Video (Development Fixture)",
                author="YouTubeCreator",
                authorUsername="@youtubecreator",
                durationSeconds=180.0,
                thumbnailUrl="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400",
                mediaUrl=formats[0].mediaUrl,
                directMediaUrl="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
                estimatedSizeBytes=formats[0].estimatedSizeBytes,
                format="mp4",
                quality="1080p",
                availableFormats=formats,
                expiresAt=None,
                isCleanSourceVerified=True,
            )

        # TikTok Mock Metadata
        formats = [
            MediaFormatOption(
                id="1080p",
                label="1080p HD (No Watermark)",
                quality="1080p",
                extension="mp4",
                isVideo=True,
                mediaUrl=f"{host_prefix}/v1/stream/mock_tt_1080p",
                estimatedSizeBytes=15420390,
                note="Watermark Free",
            ),
            MediaFormatOption(
                id="audio",
                label="Audio Only (MP3)",
                quality="audio",
                extension="mp3",
                isVideo=False,
                mediaUrl=f"{host_prefix}/v1/stream/mock_tt_audio",
                estimatedSizeBytes=2500000,
                note="Audio Track",
            ),
        ]
        return ResolvedMediaResponse(
            id="mock_test_123",
            sourceUrl=url,
            platform="tiktok",
            title="ClipSave Mock Public Video (Development Fixture)",
            author="CreativeCreator",
            authorUsername="@creativecreator",
            durationSeconds=32.0,
            thumbnailUrl="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400",
            mediaUrl=formats[0].mediaUrl,
            directMediaUrl="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            estimatedSizeBytes=formats[0].estimatedSizeBytes,
            format="mp4",
            quality="1080p",
            availableFormats=formats,
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
            if "ip address is blocked" in err_msg or "blocked" in err_msg:
                raise ExtractionError(
                    code="MEDIA_RATE_LIMITED",
                    message="TikTok is temporarily rate-limiting requests. Please try again in a moment.",
                    status_code=429,
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

    extractor_key = str(info.get("extractor_key") or "").lower()
    if "youtube" in extractor_key or "youtube.com" in url.lower() or "youtu.be" in url.lower():
        detected_platform = "youtube"
    elif "tiktok" in extractor_key or "tiktok.com" in url.lower():
        detected_platform = "tiktok"
    else:
        detected_platform = "generic"

    title = info.get("title") or "video"
    formats = info.get("formats") or []
    selected_headers = info.get("http_headers", {}).copy()
    cookies = info.get("_extracted_cookies", {})
    if cookies:
        cookie_str = "; ".join([f"{k}={v}" for k, v in cookies.items()])
        selected_headers["Cookie"] = cookie_str

    def _is_direct_stream(fmt_dict: Dict[str, Any]) -> bool:
        url_str = str(fmt_dict.get("url") or "")
        proto_str = str(fmt_dict.get("protocol") or "")
        return (
            bool(url_str)
            and not url_str.endswith(".m3u8")
            and "manifest" not in url_str
            and "m3u8" not in proto_str
            and "dash" not in proto_str
        )

    # 1. Locate best audio stream (strictly direct streams)
    audio_formats = [
        f for f in formats
        if f.get("vcodec") == "none" and f.get("acodec") != "none" and _is_direct_stream(f)
    ]
    m4a_audios = [f for f in audio_formats if f.get("ext") in ("m4a", "mp3")]
    best_audio = m4a_audios[-1] if m4a_audios else (audio_formats[-1] if audio_formats else None)
    audio_url = best_audio.get("url") if best_audio else None
    audio_size = (best_audio.get("filesize") or best_audio.get("filesize_approx")) if best_audio else None

    available_format_options: List[MediaFormatOption] = []

    if detected_platform == "youtube":
        # Video streams (strictly direct streams, excluding m3u8 playlists)
        direct_video_formats = [
            f for f in formats
            if f.get("vcodec") != "none" and _is_direct_stream(f)
        ]
        video_formats = direct_video_formats if direct_video_formats else [
            f for f in formats if f.get("vcodec") != "none" and f.get("url")
        ]

        # Group into 1080p, 720p, 360p tiers (preferring highest quality MP4 stream in each tier)
        tiers: Dict[str, Dict[str, Any]] = {}
        for f in video_formats:
            h = f.get("height") or 0
            ext = f.get("ext") or ""
            if h >= 1080 and ext == "mp4":
                tiers["1080p"] = f
            elif 720 <= h < 1080 and ext == "mp4":
                tiers["720p"] = f
            elif 360 <= h < 720 and ext == "mp4":
                tiers["360p"] = f

        # Fallback to webm or other containers if missing a tier
        for f in video_formats:
            h = f.get("height") or 0
            if h >= 1080 and "1080p" not in tiers:
                tiers["1080p"] = f
            elif 720 <= h < 1080 and "720p" not in tiers:
                tiers["720p"] = f
            elif 360 <= h < 720 and "360p" not in tiers:
                tiers["360p"] = f

        # If still empty, check for progressive formats or root url
        if not tiers and video_formats:
            tiers["720p"] = video_formats[-1]

        # Register sessions for each tier
        for quality_key in ["1080p", "720p", "360p"]:
            if quality_key in tiers:
                fmt = tiers[quality_key]
                v_url = fmt.get("url")
                f_size = fmt.get("filesize") or fmt.get("filesize_approx")
                total_estimated_size = (f_size or 0) + (audio_size or 0) if f_size else None

                # If format has no audio, pair with audio_url for live ffmpeg remux
                needs_audio_mux = fmt.get("acodec") == "none" and bool(audio_url)
                a_url = audio_url if needs_audio_mux else None

                stream_id = f"stream_{secrets.token_urlsafe(24)}"
                register_stream_session(
                    stream_id=stream_id,
                    media_url=v_url,
                    audio_url=a_url,
                    headers=selected_headers,
                    title=title,
                    is_audio_only=False,
                    ext="mp4",
                )
                client_url = f"{base_url.rstrip('/')}/v1/stream/{stream_id}" if base_url else v_url
                label = f"{quality_key} Full HD" if quality_key == "1080p" else (f"{quality_key} HD" if quality_key == "720p" else f"{quality_key} SD")
                available_format_options.append(
                    MediaFormatOption(
                        id=quality_key,
                        label=label,
                        quality=quality_key,
                        extension="mp4",
                        isVideo=True,
                        mediaUrl=client_url,
                        estimatedSizeBytes=total_estimated_size,
                        note="Full HD" if quality_key == "1080p" else ("HD" if quality_key == "720p" else "SD"),
                    )
                )

        # Audio Only Option
        if audio_url:
            stream_id_audio = f"stream_{secrets.token_urlsafe(24)}"
            register_stream_session(
                stream_id=stream_id_audio,
                media_url=audio_url,
                audio_url=None,
                headers=selected_headers,
                title=title,
                is_audio_only=True,
                ext="mp3",
            )
            client_audio_url = f"{base_url.rstrip('/')}/v1/stream/{stream_id_audio}" if base_url else audio_url
            available_format_options.append(
                MediaFormatOption(
                    id="audio",
                    label="Audio Only (MP3)",
                    quality="audio",
                    extension="mp3",
                    isVideo=False,
                    mediaUrl=client_audio_url,
                    estimatedSizeBytes=audio_size,
                    note="High Quality Audio",
                )
            )
    else:
        # TikTok (and generic progressive video)
        # Find best mp4 video stream
        media_url: Optional[str] = None
        filesize: Optional[int] = None
        for f in reversed(formats):
            if f.get("url") and (f.get("vcodec") != "none" or not formats):
                media_url = f.get("url")
                filesize = f.get("filesize") or f.get("filesize_approx")
                break

        if not media_url:
            media_url = info.get("url")

        if not media_url:
            raise ExtractionError(
                code="NO_DIRECT_STREAM",
                message="Direct media stream URL could not be extracted.",
                status_code=422,
            )

        stream_id_video = f"stream_{secrets.token_urlsafe(24)}"
        register_stream_session(
            stream_id=stream_id_video,
            media_url=media_url,
            audio_url=None,
            headers=selected_headers,
            title=title,
            is_audio_only=False,
            ext="mp4",
        )
        client_video_url = f"{base_url.rstrip('/')}/v1/stream/{stream_id_video}" if base_url else media_url
        available_format_options.append(
            MediaFormatOption(
                id="1080p",
                label="1080p HD (No Watermark)",
                quality="1080p",
                extension="mp4",
                isVideo=True,
                mediaUrl=client_video_url,
                estimatedSizeBytes=filesize,
                note="Watermark Free",
            )
        )

        # Audio Only for TikTok
        stream_id_audio = f"stream_{secrets.token_urlsafe(24)}"
        register_stream_session(
            stream_id=stream_id_audio,
            media_url=audio_url or media_url,
            audio_url=None,
            headers=selected_headers,
            title=title,
            is_audio_only=True,
            ext="mp3",
        )
        client_audio_url = f"{base_url.rstrip('/')}/v1/stream/{stream_id_audio}" if base_url else (audio_url or media_url)
        available_format_options.append(
            MediaFormatOption(
                id="audio",
                label="Audio Only (MP3)",
                quality="audio",
                extension="mp3",
                isVideo=False,
                mediaUrl=client_audio_url,
                estimatedSizeBytes=audio_size or (filesize // 5 if filesize else None),
                note="Original Audio",
            )
        )

    # Pick top default format
    default_format = available_format_options[0] if available_format_options else None
    default_media_url = default_format.mediaUrl if default_format else ""

    return ResolvedMediaResponse(
        id=str(info.get("id") or "vid"),
        sourceUrl=url,
        platform=detected_platform,
        title=title,
        author=info.get("uploader") or info.get("creator") or "Unknown Creator",
        authorUsername=info.get("uploader_id"),
        durationSeconds=float(info.get("duration") or 0) if info.get("duration") else None,
        thumbnailUrl=info.get("thumbnail"),
        mediaUrl=default_media_url,
        directMediaUrl=info.get("url"),
        httpHeaders=selected_headers,
        estimatedSizeBytes=default_format.estimatedSizeBytes if default_format else None,
        format=default_format.extension if default_format else "mp4",
        quality=default_format.quality if default_format else "1080p",
        availableFormats=available_format_options,
        expiresAt=None,
        isCleanSourceVerified=False,
    )
