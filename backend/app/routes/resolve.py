import asyncio
import os
import shutil
import uuid
from urllib.parse import urljoin
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from ..models import ResolveRequest, ResolvedMediaResponse, ErrorResponse
from ..security.url_validation import validate_media_url
from ..security.ssrf import verify_url_ssrf_safety
from ..security.rate_limit import rate_limit_dependency
from ..security.logging import log_safe_info, log_safe_error
from ..services.extractor import (
    extract_media_metadata,
    get_stream_session,
    ExtractionError,
)

router = APIRouter(prefix="/v1", tags=["resolve"])


@router.post(
    "/resolve",
    response_model=ResolvedMediaResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid link or parameter"},
        403: {"model": ErrorResponse, "description": "Private or restricted video"},
        404: {"model": ErrorResponse, "description": "Video deleted or not found"},
        422: {"model": ErrorResponse, "description": "Extraction or metadata failure"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
        504: {"model": ErrorResponse, "description": "Upstream timeout"},
    },
    dependencies=[Depends(rate_limit_dependency)],
)
async def resolve_media_endpoint(body: ResolveRequest, request: Request):
    """
    Resolve public YouTube (Shorts & Videos) and TikTok metadata and direct media stream URLs.
    Supports quality options (1080p, 720p, 360p) and audio only option (MP3).
    Defends against SSRF, rate limit abuse, and malformed inputs.
    """
    req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    raw_url = body.url

    # Step 1: Strict URL parsing & allowlist verification (YouTube, TikTok, future platforms)
    is_valid, canon_url, platform, err_msg = validate_media_url(raw_url)
    if not is_valid:
        log_safe_info(f"Rejected invalid URL: {err_msg}", raw_url)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_URL", "message": err_msg, "requestId": req_id},
        )

    # Step 2: SSRF Pre-flight DNS Verification
    is_safe, ssrf_err = verify_url_ssrf_safety(canon_url)
    if not is_safe:
        log_safe_error("SSRF defense triggered", Exception(ssrf_err), canon_url)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "SSRF_RESTRICTED", "message": "Host is not permitted for resolution.", "requestId": req_id},
        )

    # Step 3: Metadata Extraction with streaming proxy base URL
    try:
        base_url = str(request.base_url)
        hostname = request.url.hostname or ""
        is_local_ip = (
            hostname == "localhost"
            or hostname.startswith("127.")
            or hostname.startswith("192.168.")
            or hostname.startswith("10.")
            or hostname.startswith("172.")
        )
        # Force HTTPS only on public cloud containers (e.g. SnapDeploy, ngrok, domains), keep HTTP for local LAN
        if base_url.startswith("http://") and not is_local_ip:
            base_url = "https://" + base_url[len("http://"):]

        resolved = await extract_media_metadata(canon_url, base_url=base_url)
        return resolved
    except ExtractionError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail={"code": e.code, "message": e.message, "requestId": req_id},
        )
    except Exception as e:
        log_safe_error("Unhandled resolve error", e, canon_url)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred while resolving the video.",
                "requestId": req_id,
            },
        )


@router.get("/stream/{stream_id}")
async def stream_media_endpoint(stream_id: str, request: Request):
    """
    Proxies media stream with Range header support, SSRF redirect defense,
    authenticated session cookies, live ffmpeg DASH remuxing for YouTube,
    and audio extraction. Bypasses mobile TLS fingerprint blocking and CDN 403 hotlink errors.
    """
    req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    session = get_stream_session(stream_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "STREAM_EXPIRED", "message": "Stream session expired or not found. Please re-resolve the video link.", "requestId": req_id},
        )

    upstream_url = session["media_url"]
    audio_url = session.get("audio_url")
    is_audio_only = session.get("is_audio_only", False)
    ext = session.get("ext", "mp4")
    upstream_headers = session.get("headers", {}).copy()

    # Pre-flight SSRF check on primary upstream URL
    is_safe, ssrf_err = verify_url_ssrf_safety(upstream_url)
    if not is_safe:
        log_safe_error("SSRF defense triggered on stream upstream URL", Exception(ssrf_err), upstream_url)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "SSRF_RESTRICTED", "message": "Host is not permitted for streaming.", "requestId": req_id},
        )

    # CASE 1: Composite DASH stream (YouTube separate video and audio streams requiring live remux)
    if audio_url:
        is_safe_audio, ssrf_err_audio = verify_url_ssrf_safety(audio_url)
        if not is_safe_audio:
            log_safe_error("SSRF defense triggered on stream audio URL", Exception(ssrf_err_audio), audio_url)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "SSRF_RESTRICTED", "message": "Audio stream host is not permitted.", "requestId": req_id},
            )

        ffmpeg_bin = shutil.which("ffmpeg") or "ffmpeg"
        try:
            cmd = [
                ffmpeg_bin,
                "-y",
                "-i", upstream_url,
                "-i", audio_url,
                "-c", "copy",
                "-movflags", "frag_keyframe+empty_moov",
                "-f", "mp4",
                "pipe:1",
            ]
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )

            async def ffmpeg_stream_generator():
                try:
                    while True:
                        chunk = await proc.stdout.read(262144)
                        if not chunk:
                            break
                        yield chunk
                finally:
                    if proc.returncode is None:
                        try:
                            proc.kill()
                        except (ProcessLookupError, OSError):
                            pass
                    await proc.wait()

            return StreamingResponse(
                ffmpeg_stream_generator(),
                media_type="video/mp4",
                headers={
                    "Content-Type": "video/mp4",
                    "Accept-Ranges": "none",
                },
            )
        except Exception as ffmpeg_err:
            log_safe_error("Live ffmpeg remux failed, falling back to direct video stream", ffmpeg_err, upstream_url)
            # Gracefully proceed to direct stream fallback below

    # CASE 2: Direct progressive video or direct audio stream proxy
    client_range = request.headers.get("range") or request.headers.get("Range")
    if client_range:
        upstream_headers["Range"] = client_range

    client = httpx.AsyncClient(timeout=60.0, follow_redirects=False)
    MAX_REDIRECTS = 5
    current_url = upstream_url

    try:
        resp = None
        for _ in range(MAX_REDIRECTS):
            req = client.build_request("GET", current_url, headers=upstream_headers)
            resp = await client.send(req, stream=True)

            if resp.status_code in (301, 302, 303, 307, 308):
                location = resp.headers.get("location")
                await resp.aclose()
                if not location:
                    await client.aclose()
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail={"code": "STREAM_REDIRECT_ERROR", "message": "Redirect response missing Location header.", "requestId": req_id},
                    )

                redirect_url = urljoin(current_url, location)
                is_redir_safe, redir_err = verify_url_ssrf_safety(redirect_url)
                if not is_redir_safe:
                    log_safe_error("SSRF redirect blocked in stream proxy", Exception(redir_err), redirect_url)
                    await client.aclose()
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail={"code": "SSRF_RESTRICTED", "message": "Redirect target is restricted.", "requestId": req_id},
                    )
                current_url = redirect_url
            else:
                break
        else:
            if resp:
                await resp.aclose()
            await client.aclose()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={"code": "TOO_MANY_REDIRECTS", "message": "Too many upstream redirects encountered.", "requestId": req_id},
            )

        async def chunk_generator():
            try:
                async for chunk in resp.aiter_bytes(chunk_size=262144):
                    yield chunk
            finally:
                await resp.aclose()
                await client.aclose()

        content_type = (
            "audio/mpeg"
            if is_audio_only
            else resp.headers.get("content-type", "video/mp4" if ext == "mp4" else "audio/mpeg")
        )

        response_headers = {
            "Content-Type": content_type,
            "Accept-Ranges": "bytes",
        }
        if "content-length" in resp.headers:
            response_headers["Content-Length"] = resp.headers["content-length"]
        if "content-range" in resp.headers:
            response_headers["Content-Range"] = resp.headers["content-range"]

        return StreamingResponse(
            chunk_generator(),
            status_code=resp.status_code,
            headers=response_headers,
        )
    except HTTPException:
        raise
    except Exception as e:
        await client.aclose()
        log_safe_error("Streaming proxy failed", e, current_url)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "STREAM_PROXY_FAILED", "message": "Upstream media streaming failed.", "requestId": req_id},
        )
