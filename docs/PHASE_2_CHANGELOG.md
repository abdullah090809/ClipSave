# ClipSave — Phase 2 Backend Changelog

All modifications made during Phase 2 Backend Security, Performance, and Reliability Audit.

---

## [2.1.0] - Phase 2 Backend Audit & Hardening

### Security Enhancements
- **SSRF Hardening for Fallback Instances**:
  - Implemented `verify_url_ssrf_safety(inst)` check before executing external HTTP calls to Invidious instances in `backend/app/services/extractor.py`.
  - Added strict 3.0-second timeout on fallback network requests to prevent slow loris / outbound resource starvation.
- **Request Body Size Limit (HTTP 413)**:
  - Added `MAX_BODY_BYTES: int = 1048576` (1MB) in `backend/app/config.py`.
  - Implemented body size guard in `backend/app/main.py` middleware that rejects payloads over 1MB with `413 Content Too Large` and standard error structure (`PAYLOAD_TOO_LARGE`).
- **Privacy-Preserving Log Redaction**:
  - Enhanced `redact_url` in `backend/app/security/logging.py` to strip credentials (`user:pass@host`), query parameters, and fragments from logs.
- **Error Message Sanitization**:
  - Sanitized internal filesystem paths and sensitive parameters from exception messages before raising `ExtractionError` in `backend/app/services/extractor.py`.
- **FFmpeg Protocol Sandbox**:
  - Enforced `-protocol_whitelist "file,http,https,tcp,tls,crypto"` on FFmpeg child processes in `backend/app/routes/resolve.py` to prevent unauthorized local file access or arbitrary protocol execution.

### Performance & Resource Management
- **Shared Persistent HTTP Client Pool**:
  - Configured a persistent `httpx.AsyncClient` pool with bounded keepalive connections (`max_keepalive_connections=20, max_connections=100`) managed within the FastAPI application lifespan in `backend/app/main.py`.
  - Updated `/v1/stream/{stream_id}` in `backend/app/routes/resolve.py` to reuse this shared client pool, eliminating repetitive TCP/TLS handshake overhead on stream chunk proxies.
- **Optimized Stream Buffer Size**:
  - Introduced `CHUNK_SIZE_BYTES: int = 262144` (256 KB) in `backend/app/config.py` (replacing tiny 64 KB chunks) to reduce kernel context switches and async event loop overhead during high-speed video transfers.
- **DASH Remuxing Read/Write Timeout**:
  - Added `-rw_timeout 15000000` (15s) to FFmpeg remuxing pipelines to fail fast when upstream connections stall.
- **Subprocess Concurrency Bounding**:
  - Added `_streaming_semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_STREAMS)` in `backend/app/routes/resolve.py` to prevent runaway FFmpeg and proxy processes from crashing memory-constrained containers.
  - Added bounded process termination with `asyncio.wait_for(proc.wait(), timeout=2.0)` and SIGKILL fallback.

### Reliability & Bug Fixes
- **YouTube Progress Percentage Bug Fixed**:
  - **Root Cause**: YouTube DASH adaptive formats omit `filesize` and `filesize_approx`. The backend previously served chunked streams without `Content-Length`, leading `expo-file-system` to receive `totalBytesExpectedToWrite = -1`, resulting in the download progress freezing at 0%.
  - **Resolution**:
    1. Added bitrate-based size estimation fallback in `backend/app/services/extractor.py` (`(tbr * 1000 / 8) * duration` or resolution bitrate lookup).
    2. Passed `estimated_size` into `register_stream_session` across all formats (1080p, 720p, 360p, and audio).
    3. Populated `estimatedSizeBytes` in `MediaFormatOption` models so the mobile client can accurately calculate progress even if `Content-Length` is missing.
    4. Exposed `X-Estimated-Content-Length` in CORS `expose_headers` and streaming response headers.
- **Independent Stream Rate Limiting**:
  - Separated stream connection rate limiting (`STREAM_RATE_LIMIT_PER_MINUTE = 120`) from resolve API rate limiting (`RATE_LIMIT_PER_MINUTE = 30`).
  - Implemented `stream_rate_limit_dependency` in `backend/app/security/rate_limit.py` with separate IP tracking bucket to prevent media downloads from blocking resolution queries.
- **Thread-Safe Cookie Handling**:
  - Added `_cookie_lock = threading.Lock()` and `_cached_cookie_path` in `backend/app/services/extractor.py` to prevent race conditions during concurrent cookie file writes.
- **Container Hardening**:
  - Added `ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1` in `backend/Dockerfile`.
  - Added explicit `/tmp` and `/app/cache` directory creation with appropriate non-root ownership (`10001:10001`).

## [2.2.0] - Phase 2 Extension: YouTube Seekable Range Resuming & Upstream Buffer Optimization

### YouTube 720p/1080p Mid-Stream Resume Implementation
- **Seekable Disk Range Buffering (`stream_cache.py`)**:
  - Implemented `StreamCacheManager` and `StreamRemuxJob` in `backend/app/services/stream_cache.py`.
  - FFmpeg writes fragmented MP4 output (`-movflags frag_keyframe+empty_moov+default_base_moof`) to disk storage.
  - Generates full HTTP Range specification support:
    - `206 Partial Content` on valid byte ranges (`bytes=start-end`, `bytes=start-`, `bytes=-suffix`).
    - `416 Range Not Satisfiable` on out-of-bounds or invalid ranges.
    - `Accept-Ranges: bytes` and `Content-Range: bytes start-end/total`.
  - Supports concurrent progressive reading while FFmpeg writes to disk.
  - Multi-client coordination ensures concurrent requests for the same `stream_id` share the single remuxing job without file corruption or duplicate processes.
  - Cache storage cap enforced at `MAX_CACHE_SIZE_BYTES = 500MB` with LRU eviction and 30-minute TTL cleanup.
- **Frontend Resumption Capability Activated**:
  - Updated `isResumeSupported` in `src/services/downloadEngine.ts` to return `true` for all platforms including YouTube video formats, enabling `createDownloadResumable` byte offset preservation across network drops, screen off, or app minimize.

### Upstream Download Throughput & Buffer Tuning
- **FFmpeg Upstream Socket Window**:
  - Added `-recv_buffer_size 1048576` (1MB socket receive buffer) and `-buffer_size 1048576` (1MB buffer) on FFmpeg input connections to prevent TCP window starvation from remote CDNs.
- **Tmpfs Storage Integration**:
  - Configured `get_cache_dir()` to dynamically prioritize container tmpfs mount (`/tmp/clipsave_cache` and `/app/cache`), preventing disk I/O bottlenecks in read-only container root environments.

- Created `backend/tests/test_phase2_backend_audit.py` with 7 new automated tests verifying:
  - Separate stream rate limit bucket isolation.
  - Stream rate limit 429 enforcement.
  - 413 Payload Too Large enforcement on oversized requests.
  - URL credential and parameter redaction.
  - Redaction edge cases (null, empty, invalid URLs).
  - Stream session estimated size registration.
  - CORS header exposure for `X-Estimated-Content-Length`.
- Backend test suite increased from 45 to 52 passing tests (100% pass rate).
