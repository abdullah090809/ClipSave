import uuid
from urllib.parse import urljoin
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from ..models import ResolveRequest, ResolvedMediaResponse, ErrorResponse
from ..security.url_validation import validate_tiktok_url
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
    Resolve public TikTok video metadata and direct media stream URL.
    Defends against SSRF, rate limit abuse, and malformed inputs.
    """
    req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    raw_url = body.url

    # Step 1: Strict URL parsing & allowlist verification
    is_valid, canon_url, err_msg = validate_tiktok_url(raw_url)
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
        resolved = await extract_media_metadata(canon_url, base_url=str(request.base_url))
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
    and authenticated session cookies. Bypasses mobile TLS fingerprint blocking
    and CDN 403 hotlink errors.
    """
    req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    session = get_stream_session(stream_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "STREAM_EXPIRED", "message": "Stream session expired or not found. Please re-resolve the video link.", "requestId": req_id},
        )

    upstream_url = session["media_url"]
    upstream_headers = session["headers"].copy()

    # Pre-flight SSRF check on upstream URL
    is_safe, ssrf_err = verify_url_ssrf_safety(upstream_url)
    if not is_safe:
        log_safe_error("SSRF defense triggered on stream upstream URL", Exception(ssrf_err), upstream_url)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "SSRF_RESTRICTED", "message": "Host is not permitted for streaming.", "requestId": req_id},
        )

    # Forward client Range header for resumed downloads (HTTP 206)
    client_range = request.headers.get("range") or request.headers.get("Range")
    if client_range:
        upstream_headers["Range"] = client_range

    # Disable automatic redirect following to inspect each hop against SSRF allowlist
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
                async for chunk in resp.aiter_bytes(chunk_size=65536):
                    yield chunk
            finally:
                await resp.aclose()
                await client.aclose()

        response_headers = {
            "Content-Type": resp.headers.get("content-type", "video/mp4"),
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
