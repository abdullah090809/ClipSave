import os
import re
import urllib.request
import json
import asyncio
import concurrent.futures
import secrets
import time
import threading
from typing import Optional, Dict, Any, List
import yt_dlp

from ..config import settings
from ..models import ResolvedMediaResponse, MediaFormatOption
from ..security.logging import log_safe_info, log_safe_error
from ..security.ssrf import verify_url_ssrf_safety

_cookie_lock = threading.Lock()
_cached_cookie_path: Optional[str] = None

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
    estimated_size: Optional[int] = None,
) -> None:
    now = time.time()
    expired = [k for k, v in _stream_sessions.items() if now - v.get("created_at", 0) > 7200]
    for k in expired:
        _stream_sessions.pop(k, None)

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
        "estimated_size": estimated_size,
        "created_at": now,
    }


def get_stream_session(stream_id: str) -> Optional[Dict[str, Any]]:
    return _stream_sessions.get(stream_id)


def clear_stream_sessions() -> None:
    """Clear all stream sessions."""
    _stream_sessions.clear()


INVIDIOUS_INSTANCES = [
    "https://yt.chocolatemoo53.com",
    "https://invidious.protokolla.fi",
    "https://inv.nadeko.net",
    "https://invidious.nerdvpn.de",
    "https://invidious.privacydev.net",
]


_inv_cache: Dict[str, Any] = {"ts": 0.0, "list": []}


def _get_invidious_instances() -> List[str]:
    """Static list plus live healthy instances from api.invidious.io (cached 1h)."""
    now = time.monotonic()
    if _inv_cache["list"] and now - _inv_cache["ts"] < 3600:
        return _inv_cache["list"]
    live: List[str] = []
    try:
        req = urllib.request.Request(
            "https://api.invidious.io/instances.json?sort_by=health",
            headers={"User-Agent": _PROBE_UA},
        )
        with urllib.request.urlopen(req, timeout=4) as r:
            for _name, meta in json.loads(r.read().decode()):
                if meta.get("type") == "https" and meta.get("api") and meta.get("uri"):
                    live.append(meta["uri"].rstrip("/"))
    except Exception:
        pass
    merged = list(dict.fromkeys(INVIDIOUS_INSTANCES + live[:10]))
    _inv_cache.update(ts=now, list=merged)
    return merged


def _extract_youtube_id(url: str) -> Optional[str]:
    m = re.search(r"(?:v=|\/shorts\/|\/embed\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})", url)
    return m.group(1) if m else None


_PROBE_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


def _probe_stream_url(raw_url: Optional[str], instance: str) -> bool:
    if not raw_url:
        return False
    full = f"{instance}{raw_url}" if raw_url.startswith("/") else raw_url
    is_safe, _ = verify_url_ssrf_safety(full)
    if not is_safe:
        return False
    try:
        req = urllib.request.Request(
            full,
            headers={
                "User-Agent": _PROBE_UA,
                "Referer": "https://www.youtube.com/",
                "Range": "bytes=0-0",
            },
        )
        with urllib.request.urlopen(req, timeout=3) as r:
            return r.status in (200, 206)
    except Exception:
        return False


def _resolve_youtube_fallback(url: str, base_url: Optional[str] = None, budget: float = 6.0) -> Optional[ResolvedMediaResponse]:
    video_id = _extract_youtube_id(url)
    if not video_id:
        return None

    def _try_instance(inst: str):
        is_safe, _ = verify_url_ssrf_safety(inst)
        if not is_safe:
            return None
        try:
            req = urllib.request.Request(
                f"{inst}/api/v1/videos/{video_id}?local=true",
                headers={"User-Agent": _PROBE_UA}
            )
            with urllib.request.urlopen(req, timeout=3) as r:
                if r.status != 200:
                    return None
                candidate = json.loads(r.read().decode())
        except Exception:
            return None
        probe_formats = candidate.get("adaptiveFormats") or []
        probe_video = next((f.get("url") for f in probe_formats if "video" in f.get("type", "") and f.get("url")), None)
        probe_audio = next((f.get("url") for f in probe_formats if "audio" in f.get("type", "") and f.get("url")), None)
        if not _probe_stream_url(probe_video, inst):
            return None
        if probe_audio and not _probe_stream_url(probe_audio, inst):
            return None
        return candidate, inst

    # Race all instances in parallel; the first healthy one wins. Total time is
    # capped so the request answers before the hosting gateway gives up.
    data = None
    used_instance = None
    instances = _get_invidious_instances()[:8]
    pool = concurrent.futures.ThreadPoolExecutor(max_workers=len(instances) or 1)
    futures = [pool.submit(_try_instance, inst) for inst in instances]
    try:
        for fut in concurrent.futures.as_completed(futures, timeout=budget):
            res = fut.result()
            if res:
                data, used_instance = res
                break
    except concurrent.futures.TimeoutError:
        pass
    finally:
        pool.shutdown(wait=False, cancel_futures=True)

    if not data:
        return None

    title = data.get("title") or "YouTube Video"
    author = data.get("author") or "YouTube Creator"
    duration = float(data.get("lengthSeconds") or 0)
    thumb = f"https://i.ytimg.com/vi/{video_id}/maxresdefault.jpg"

    adaptive = data.get("adaptiveFormats", [])
    if not adaptive:
        return None

    def _normalize_url(raw_u):
        if not raw_u:
            return None
        if raw_u.startswith("/"):
            return f"{used_instance}{raw_u}"
        return raw_u

    best_audio = next((f for f in adaptive if "audio" in f.get("type", "") and f.get("container") == "m4a"), None)
    if not best_audio:
        best_audio = next((f for f in adaptive if "audio" in f.get("type", "")), None)

    audio_url = _normalize_url(best_audio.get("url")) if best_audio else None

    def _get_bytes(fmt):
        if not fmt:
            return None
        val = fmt.get("clen") or fmt.get("contentLength")
        try:
            return int(val) if val else None
        except Exception:
            return None

    def _find_vid(res_prefix):
        matches = [f for f in adaptive if f.get("resolution") and str(res_prefix) in str(f.get("qualityLabel", ""))]
        mp4 = next((m for m in matches if m.get("container") == "mp4"), None)
        return mp4 or (matches[0] if matches else None)

    vid_1080 = _find_vid("1080")
    vid_720 = _find_vid("720")
    vid_480 = _find_vid("480")
    vid_360 = _find_vid("360")
    vid_240 = _find_vid("240")

    fallback_vid = None
    if not any([vid_1080, vid_720, vid_480, vid_360, vid_240]):
        fallback_vid = next((f for f in adaptive if "video" in f.get("type", "") and f.get("container") == "mp4"), None)
        if not fallback_vid:
            fallback_vid = next((f for f in adaptive if "video" in f.get("type", "")), None)

    host_prefix = base_url.rstrip("/") if base_url else "http://localhost:8080"
    formats = []

    stream_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.youtube.com/",
    }

    aud_bytes = _get_bytes(best_audio)

    candidates = [
        ("1080p", "1080p Full HD", vid_1080, "Full HD"),
        ("720p", "720p HD", vid_720, "HD"),
        ("480p", "480p SD", vid_480, "SD"),
        ("360p", "360p SD", vid_360, "SD"),
        ("240p", "240p SD", vid_240, "SD"),
    ]
    if fallback_vid:
        candidates.append(("video", "Standard Video (MP4)", fallback_vid, "SD"))

    for key, label, vid, note in candidates:
        if vid and vid.get("url"):
            vid_url = _normalize_url(vid.get("url"))
            vid_bytes = _get_bytes(vid)
            total_est_bytes = (vid_bytes + (aud_bytes or 0)) if vid_bytes else None
            if not total_est_bytes and duration:
                bitrate_table = {"1080p": 450_000, "720p": 250_000, "480p": 150_000, "360p": 100_000, "240p": 60_000}
                total_est_bytes = int(duration * bitrate_table.get(key, 100_000))

            sid = f"stream_{secrets.token_urlsafe(24)}"
            register_stream_session(
                sid,
                vid_url,
                stream_headers,
                title,
                audio_url=audio_url,
                ext="mp4",
                estimated_size=total_est_bytes,
            )
            formats.append(MediaFormatOption(
                id=key,
                label=label,
                quality=key,
                extension="mp4",
                isVideo=True,
                mediaUrl=f"{host_prefix}/v1/stream/{sid}",
                estimatedSizeBytes=total_est_bytes,
                note=note
            ))

    if audio_url:
        sid = f"stream_{secrets.token_urlsafe(24)}"
        total_aud = aud_bytes or (int(duration * 16_000) if duration else None)
        register_stream_session(
            sid,
            audio_url,
            stream_headers,
            title,
            is_audio_only=True,
            ext="mp3",
            estimated_size=total_aud,
        )
        formats.append(MediaFormatOption(
            id="audio",
            label="Audio Only (MP3)",
            quality="audio",
            extension="mp3",
            isVideo=False,
            mediaUrl=f"{host_prefix}/v1/stream/{sid}",
            estimatedSizeBytes=total_aud,
            note="High Quality Audio"
        ))

    if not formats:
        return None

    return ResolvedMediaResponse(
        id=video_id,
        sourceUrl=url,
        platform="youtube",
        title=title,
        author=author,
        authorUsername="@" + author.replace(" ", ""),
        durationSeconds=duration,
        thumbnailUrl=thumb,
        mediaUrl=formats[0].mediaUrl,
        directMediaUrl=formats[0].mediaUrl,
        httpHeaders={},
        estimatedSizeBytes=formats[0].estimatedSizeBytes,
        format="mp4",
        quality=formats[0].quality,
        availableFormats=formats,
        expiresAt=None,
        isCleanSourceVerified=False
    )


_yt_dlp_gate = threading.Semaphore(2)


def _run_ytdlp_guarded(url: str) -> Dict[str, Any]:
    """Allow at most 2 YouTube yt-dlp runs at once; a cancelled request's thread
    keeps running, so without this repeated retries pile up and overload the box."""
    if not _yt_dlp_gate.acquire(blocking=False):
        raise yt_dlp.utils.DownloadError("extractor busy")
    try:
        return _run_ytdlp_extract(url)
    finally:
        _yt_dlp_gate.release()


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
    Supports YouTube (Shorts & Videos), TikTok, Instagram, Facebook, and generic extractors.
    """
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": False,
        "noplaylist": True,
        "socket_timeout": 15,
        "check_formats": False,
        "js_runtimes": {"node": {}},
        "extractor_args": {
            "youtube": {
                "player_client": ["visionos", "ios", "mweb"],
            }
        },
    }

    yt_proxy = os.environ.get("YT_PROXY") or getattr(settings, "YT_PROXY", None)
    _is_yt_url = "youtube.com" in url.lower() or "youtu.be" in url.lower()
    if _is_yt_url:
        ydl_opts["socket_timeout"] = 5
        ydl_opts["extractor_retries"] = 0
    if yt_proxy and _is_yt_url:
        ydl_opts["proxy"] = yt_proxy

    cookies_content = os.environ.get("COOKIES_CONTENT") or getattr(settings, "COOKIES_CONTENT", None)
    cookies_path = getattr(settings, "COOKIES_FILE", None) or os.environ.get("COOKIES_FILE")

    master_cookie_data = None
    if cookies_content and cookies_content.strip():
        raw_val = cookies_content.strip()
        import base64
        try:
            decoded = base64.b64decode(raw_val).decode("utf-8")
            if "youtube" in decoded or "# Netscape" in decoded:
                raw_val = decoded
        except Exception:
            pass
        if "\\n" in raw_val and "\n" not in raw_val:
            raw_val = raw_val.replace("\\n", "\n")
        if "youtube" in raw_val or "# Netscape" in raw_val:
            master_cookie_data = raw_val

    if not master_cookie_data:
        if cookies_path and os.path.exists(cookies_path):
            try:
                with open(cookies_path, "r", encoding="utf-8") as f:
                    master_cookie_data = f.read()
            except Exception:
                pass

    global _cached_cookie_path
    if master_cookie_data:
        import tempfile
        with _cookie_lock:
            if not _cached_cookie_path or not os.path.exists(_cached_cookie_path):
                try:
                    runtime_cookie = os.path.join(tempfile.gettempdir(), f"clipsave_runtime_cookies_{os.getpid()}.txt")
                    with open(runtime_cookie, "w", encoding="utf-8") as f:
                        f.write(master_cookie_data)
                    _cached_cookie_path = runtime_cookie
                except Exception:
                    pass
        if _cached_cookie_path and os.path.exists(_cached_cookie_path):
            ydl_opts["cookiefile"] = _cached_cookie_path

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if info:
                cookie_dict = {c.name: c.value for c in ydl.cookiejar}
                info["_extracted_cookies"] = cookie_dict
            return info
    except yt_dlp.utils.DownloadError as e:
        is_yt = "youtube.com" in url.lower() or "youtu.be" in url.lower()
        if is_yt and yt_proxy:
            # Retry each player client on its own, without cookies. Clients that
            # don't need a PO token (android_vr, tv) often pass the bot check.
            cascade_deadline = time.monotonic() + 4.0
            for client in ("android_vr", "tv", "web_safari"):
                if time.monotonic() > cascade_deadline:
                    break
                fallback_opts = dict(ydl_opts)
                fallback_opts["socket_timeout"] = 4
                fallback_opts.pop("cookiefile", None)
                fallback_opts["extractor_args"] = {"youtube": {"player_client": [client]}}
                try:
                    with yt_dlp.YoutubeDL(fallback_opts) as fydl:
                        info = fydl.extract_info(url, download=False)
                        if info:
                            cookie_dict = {c.name: c.value for c in fydl.cookiejar}
                            info["_extracted_cookies"] = cookie_dict
                            return info
                except Exception:
                    continue
        raise e


async def extract_media_metadata(url: str, base_url: Optional[str] = None) -> ResolvedMediaResponse:
    """
    Asynchronously extracts media metadata with bounded concurrency, strict timeout,
    and multiple format options (1080p, 720p, 360p, audio only).
    """
    is_youtube = "youtube.com" in url.lower() or "youtu.be" in url.lower()
    is_instagram = "instagram.com" in url.lower() or "instagr.am" in url.lower() or "ddinstagram.com" in url.lower()
    is_facebook = "facebook.com" in url.lower() or "fb.watch" in url.lower() or "fb.com" in url.lower()
    platform = (
        "youtube"
        if is_youtube
        else ("instagram" if is_instagram else ("facebook" if is_facebook else "tiktok"))
    )

    if settings.ENABLE_MOCK_EXTRACTOR:
        log_safe_info("Using mock extractor response", url)
        host_prefix = base_url.rstrip("/") if base_url else "http://test"

        if is_youtube:
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

        if is_instagram:
            formats = [
                MediaFormatOption(
                    id="1080p",
                    label="Instagram HD Video",
                    quality="1080p",
                    extension="mp4",
                    isVideo=True,
                    mediaUrl=f"{host_prefix}/v1/stream/mock_ig_1080p",
                    estimatedSizeBytes=14500000,
                    note="HD Reel",
                ),
                MediaFormatOption(
                    id="audio",
                    label="Audio Only (MP3)",
                    quality="audio",
                    extension="mp3",
                    isVideo=False,
                    mediaUrl=f"{host_prefix}/v1/stream/mock_ig_audio",
                    estimatedSizeBytes=1800000,
                    note="Audio Track",
                ),
            ]
            return ResolvedMediaResponse(
                id="mock_ig_123",
                sourceUrl=url,
                platform="instagram",
                title="Sample Instagram Reel (Development Fixture)",
                author="InstagramCreator",
                authorUsername="@instagramcreator",
                durationSeconds=28.0,
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

        if is_facebook:
            formats = [
                MediaFormatOption(
                    id="1080p",
                    label="Facebook HD Video",
                    quality="1080p",
                    extension="mp4",
                    isVideo=True,
                    mediaUrl=f"{host_prefix}/v1/stream/mock_fb_1080p",
                    estimatedSizeBytes=19200000,
                    note="HD Video",
                ),
                MediaFormatOption(
                    id="audio",
                    label="Audio Only (MP3)",
                    quality="audio",
                    extension="mp3",
                    isVideo=False,
                    mediaUrl=f"{host_prefix}/v1/stream/mock_fb_audio",
                    estimatedSizeBytes=2200000,
                    note="Audio Track",
                ),
            ]
            return ResolvedMediaResponse(
                id="mock_fb_123",
                sourceUrl=url,
                platform="facebook",
                title="Sample Facebook Video (Development Fixture)",
                author="FacebookCreator",
                authorUsername="@facebookcreator",
                durationSeconds=45.0,
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
        yt_proxy_set = bool(os.environ.get("YT_PROXY") or getattr(settings, "YT_PROXY", None))
        fast_tried = False
        try:
            if is_youtube and not yt_proxy_set:
                fast_tried = True
                # Run yt-dlp and the Invidious race side by side and take whichever
                # succeeds first. The whole thing answers within ~4.5s, because the
                # hosting gateway cuts off slow requests with a non-JSON error page.
                fb_task = asyncio.ensure_future(asyncio.wait_for(
                    loop.run_in_executor(_thread_pool, _resolve_youtube_fallback, url, base_url, 3.5),
                    timeout=4.5))
                yt_task = asyncio.ensure_future(asyncio.wait_for(
                    loop.run_in_executor(_thread_pool, _run_ytdlp_guarded, url),
                    timeout=4.5))
                pending = {fb_task, yt_task}
                info = None
                yt_error: Optional[BaseException] = None
                while pending and info is None:
                    done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
                    for t in done:
                        if t is fb_task:
                            try:
                                quick = t.result()
                            except Exception as fb_err:
                                log_safe_error("YouTube Invidious path failed", fb_err, url)
                                quick = None
                            if quick:
                                yt_task.cancel()
                                log_safe_info("YouTube resolved via Invidious", url)
                                return quick
                        else:
                            try:
                                info = t.result()
                            except Exception as e_yt:
                                yt_error = e_yt
                if info is None:
                    fb_task.cancel()
                    raise yt_error if yt_error else asyncio.TimeoutError()
                fb_task.cancel()
            else:
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

            if is_youtube and not fast_tried:
                log_safe_info("Attempting YouTube datacenter fallback", url)
                try:
                    fallback_resp = await loop.run_in_executor(
                        _thread_pool, _resolve_youtube_fallback, url, base_url
                    )
                    if fallback_resp:
                        log_safe_info("YouTube fallback resolution successful", url)
                        return fallback_resp
                except Exception as fb_err:
                    log_safe_error("YouTube fallback failed", fb_err, url)

            clean_err = re.sub(r'(/[\w.-]+)+', '[path]', str(e))
            clean_err = re.sub(r'[A-Za-z]:\\[\w.-]+(\\[\w.-]+)*', '[path]', clean_err)
            clean_err = re.sub(r'[?&][^=]+=[^& \n]+', '[param]', clean_err)
            if is_youtube and ("confirm you" in err_msg and "bot" in err_msg):
                raise ExtractionError(
                    code="YOUTUBE_BOT_CHECK",
                    message="YouTube is blocking this server right now. Please try again later.",
                    status_code=503,
                )
            if "private" in err_msg or "empty media response" in err_msg or "not granting access" in err_msg:
                raise ExtractionError(
                    code="MEDIA_PRIVATE",
                    message="This video is private, restricted, or requires an account login. ClipSave only accesses publicly accessible videos.",
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
                message=f"Could not resolve media metadata: {clean_err[:180]}",
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
    elif "instagram" in extractor_key or "instagram.com" in url.lower() or "instagr.am" in url.lower() or "ddinstagram.com" in url.lower():
        detected_platform = "instagram"
    elif "facebook" in extractor_key or "facebook.com" in url.lower() or "fb.watch" in url.lower() or "fb.com" in url.lower():
        detected_platform = "facebook"
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

    audio_formats = [
        f for f in formats
        if f.get("vcodec") == "none" and f.get("acodec") != "none" and _is_direct_stream(f)
    ]
    m4a_audios = [f for f in audio_formats if f.get("ext") in ("m4a", "mp3")]
    best_audio = m4a_audios[-1] if m4a_audios else (audio_formats[-1] if audio_formats else None)
    audio_url = best_audio.get("url") if best_audio else None
    audio_size = (best_audio.get("filesize") or best_audio.get("filesize_approx")) if best_audio else None
    duration_sec = float(info.get("duration") or 0)
    if not audio_size and best_audio and duration_sec > 0:
        abr = best_audio.get("abr") or 128
        audio_size = int((abr * 1000 / 8) * duration_sec)

    available_format_options: List[MediaFormatOption] = []

    if detected_platform == "youtube":
        direct_video_formats = [
            f for f in formats
            if f.get("vcodec") != "none" and _is_direct_stream(f)
        ]
        video_formats = direct_video_formats if direct_video_formats else [
            f for f in formats if f.get("vcodec") != "none" and f.get("url")
        ]

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

        for f in video_formats:
            h = f.get("height") or 0
            if h >= 1080 and "1080p" not in tiers:
                tiers["1080p"] = f
            elif 720 <= h < 1080 and "720p" not in tiers:
                tiers["720p"] = f
            elif 360 <= h < 720 and "360p" not in tiers:
                tiers["360p"] = f

        if not tiers and video_formats:
            tiers["720p"] = video_formats[-1]

        for quality_key in ["1080p", "720p", "360p"]:
            if quality_key in tiers:
                fmt = tiers[quality_key]
                v_url = fmt.get("url")
                f_size = fmt.get("filesize") or fmt.get("filesize_approx")
                total_estimated_size = (f_size or 0) + (audio_size or 0) if f_size else None
                if not total_estimated_size and duration_sec > 0:
                    tbr = fmt.get("tbr") or ((fmt.get("vbr") or 0) + (best_audio.get("abr") or 0 if best_audio else 0))
                    if tbr and tbr > 0:
                        total_estimated_size = int((tbr * 1000 / 8) * duration_sec)
                    else:
                        bitrate_table = {"1080p": 450_000, "720p": 250_000, "360p": 100_000}
                        total_estimated_size = int(duration_sec * bitrate_table.get(quality_key, 250_000))

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
                    estimated_size=total_estimated_size,
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
                estimated_size=audio_size,
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
        selected_format: Optional[Dict[str, Any]] = None
        for f in reversed(formats):
            if (
                f.get("url")
                and _is_direct_stream(f)
                and f.get("vcodec") != "none"
                and f.get("acodec") != "none"
            ):
                selected_format = f
                break

        if not selected_format:
            for f in reversed(formats):
                if f.get("url") and _is_direct_stream(f) and f.get("vcodec") != "none":
                    selected_format = f
                    break

        if not selected_format and formats:
            selected_format = formats[-1]

        media_url = selected_format.get("url") if selected_format else info.get("url")
        filesize = (selected_format.get("filesize") or selected_format.get("filesize_approx")) if selected_format else None
        if not filesize and duration_sec > 0:
            tbr = (selected_format.get("tbr") or selected_format.get("vbr")) if selected_format else None
            if tbr and tbr > 0:
                filesize = int((tbr * 1000 / 8) * duration_sec)
            else:
                filesize = int(duration_sec * 250_000)

        if not media_url:
            raise ExtractionError(
                code="NO_DIRECT_STREAM",
                message="Direct media stream URL could not be extracted.",
                status_code=422,
            )

        needs_audio_mux = bool(
            selected_format
            and selected_format.get("acodec") == "none"
            and audio_url
        )
        a_url = audio_url if needs_audio_mux else None
        total_estimated_size = (filesize or 0) + (audio_size or 0) if (needs_audio_mux and filesize and audio_size) else filesize

        stream_id_video = f"stream_{secrets.token_urlsafe(24)}"
        register_stream_session(
            stream_id=stream_id_video,
            media_url=media_url,
            audio_url=a_url,
            headers=selected_headers,
            title=title,
            is_audio_only=False,
            ext="mp4",
            estimated_size=total_estimated_size,
        )
        client_video_url = f"{base_url.rstrip('/')}/v1/stream/{stream_id_video}" if base_url else media_url
        video_label = (
            "Facebook HD Video"
            if detected_platform == "facebook"
            else ("Instagram HD Video" if detected_platform == "instagram" else "1080p HD (No Watermark)")
        )
        video_note = "HD Reel / Video" if detected_platform in ("instagram", "facebook") else "Watermark Free"
        available_format_options.append(
            MediaFormatOption(
                id="1080p",
                label=video_label,
                quality="1080p",
                extension="mp4",
                isVideo=True,
                mediaUrl=client_video_url,
                estimatedSizeBytes=total_estimated_size,
                note=video_note,
            )
        )

        stream_id_audio = f"stream_{secrets.token_urlsafe(24)}"
        register_stream_session(
            stream_id=stream_id_audio,
            media_url=audio_url or media_url,
            audio_url=None,
            headers=selected_headers,
            title=title,
            is_audio_only=True,
            ext="mp3",
            estimated_size=audio_size or (filesize // 5 if filesize else None),
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

    default_format = available_format_options[0] if available_format_options else None
    default_media_url = default_format.mediaUrl if default_format else ""

    if detected_platform == "youtube":
        first_fmt = tiers.get(default_format.id) if (default_format and "tiers" in locals()) else None
        has_direct_audio = bool(first_fmt and first_fmt.get("acodec") != "none")
        direct_fallback = first_fmt.get("url") if has_direct_audio else None
    else:
        direct_fallback = media_url if not needs_audio_mux else None

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
        directMediaUrl=direct_fallback,
        httpHeaders=selected_headers,
        estimatedSizeBytes=default_format.estimatedSizeBytes if default_format else None,
        format=default_format.extension if default_format else "mp4",
        quality=default_format.quality if default_format else "1080p",
        availableFormats=available_format_options,
        expiresAt=None,
        isCleanSourceVerified=False,
    )