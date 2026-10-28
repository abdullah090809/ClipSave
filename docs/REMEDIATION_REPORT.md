# ClipSave — Complete Remediation & Hardening Record

## 1. Executive Summary
This document provides an engineering record of all code changes, security mitigations, performance optimizations, and reliability enhancements implemented across the ClipSave repository.

---

## 2. Detailed Remediation Changelog

### Remediation 1: SSRF Defense on Media Stream Proxy Redirects
- **Files Modified:** `backend/app/routes/resolve.py`
- **Severity / Category:** High (P1) / Application Security (SSRF)
- **Problem:** `stream_media_endpoint` previously used `follow_redirects=True` and did not validate upstream or redirect targets against private IP / cloud metadata allowlists. A malicious upstream could redirect to `http://169.254.169.254/latest/meta-data/` to leak cloud provider credentials.
- **Solution:**
  - Set `follow_redirects=False`.
  - Implemented an iterative redirect loop (max 5 hops).
  - Every redirect target is resolved using `urljoin()` and verified with `verify_url_ssrf_safety()`.
  - Upstream URL is also pre-flight checked before opening connections.
- **Verification:** `backend/tests/test_ssrf.py::test_stream_proxy_ssrf_redirect_to_metadata_blocked` and `test_stream_proxy_ssrf_upstream_rejected` pass.

### Remediation 2: Stream Session Cryptographic Entropy & Memory Bounding
- **Files Modified:** `backend/app/services/extractor.py`, `backend/tests/test_stream_session.py`
- **Severity / Category:** High (P1) / Session Security & DoS Prevention
- **Problem:** Session tokens were truncated UUIDs (`uuid.uuid4().hex[:12]`), yielding only 48 bits of entropy. Furthermore, the `_stream_sessions` dictionary had no capacity bound, risking memory exhaustion under continuous load.
- **Solution:**
  - Upgraded token generation to `f"stream_{secrets.token_urlsafe(24)}"`, providing **192 bits of cryptographic entropy**.
  - Implemented `MAX_STREAM_SESSIONS = 5000` with oldest-first LRU eviction when capacity is exceeded.
  - Retained automatic expiration sweep for sessions older than 7,200s (2 hours).
- **Verification:** `backend/tests/test_stream_session.py` passes all 3 tests.

### Remediation 3: Rate Limiter Unbounded Memory Growth Fix
- **Files Modified:** `backend/app/security/rate_limit.py`, `backend/tests/test_rate_limit.py`
- **Severity / Category:** Medium (P2) / Memory Leak & Reliability
- **Problem:** Client IP keys were stored indefinitely in a `defaultdict(list)`. Stale IP entries with empty timestamp lists were never removed from RAM.
- **Solution:**
  - Expired timestamps are removed; if an IP's list becomes empty, the IP key is deleted via `_request_history.pop(client_ip, None)`.
  - Added periodic global sweep when tracked IP count exceeds 500.
  - Enforced a hard capacity ceiling (`MAX_TRACKED_IPS = 10000`).
- **Verification:** `backend/tests/test_rate_limit.py::test_rate_limit_stale_ip_pruning` and `test_rate_limit_hard_cap_enforcement` pass.

### Remediation 4: CORS Range Headers & Lifespan Thread Pool Cleanup
- **Files Modified:** `backend/app/main.py`
- **Severity / Category:** Medium (P2) / API Standards & Graceful Shutdown
- **Problem:** CORSMiddleware omitted `Range` from `allow_headers` and omitted `Content-Range`, `Accept-Ranges`, `Content-Length` from `expose_headers`, causing stream clients to fail on resumable byte requests. Additionally, the extractor thread pool lacked graceful shutdown.
- **Solution:**
  - Added `Range`, `Origin`, and `User-Agent` to `allow_headers`.
  - Added `HEAD` to `allow_methods`.
  - Added `expose_headers=["Content-Range", "Accept-Ranges", "Content-Length", "Content-Type", "X-Request-ID", "X-Response-Time-Ms"]`.
  - Added FastAPI `lifespan` handler that triggers `_thread_pool.shutdown(wait=False)` on app termination.
- **Verification:** Pytest suite passes; CORS headers verified in ASGI tests.

### Remediation 5: Client-Side Concurrency Queueing & Dequeueing
- **Files Modified:** `src/services/downloadEngine.ts`, `src/services/downloadEngine.test.ts`
- **Severity / Category:** Medium (P2) / Mobile Resource Management
- **Problem:** Mobile downloads started immediately regardless of `maxConcurrentDownloads`, potentially causing bandwidth contention and excessive background threads.
- **Solution:**
  - `startDownload` checks `activeDownloadSessions.size` against `maxConcurrentDownloads`.
  - If slots are full, job is created with `state: 'QUEUED'` and `statusMessage: 'Waiting in queue...'`.
  - Added `processNextQueuedJob()` to dequeue the oldest pending job whenever an active job finishes, fails, is cancelled, or is removed.
- **Verification:** `src/services/downloadEngine.test.ts::UT-DL-09` passes.

### Remediation 6: Structured Backend Error Detail Parsing
- **Files Modified:** `src/services/apiClient.ts`
- **Severity / Category:** Low (P3) / UX & Error Handling
- **Problem:** FastAPI structured error objects are formatted as `{"detail": {"code": "...", "message": "..."}}`. The client only checked `data?.code`, falling back to generic HTTP error messages.
- **Solution:**
  - Added safe extraction of `data?.detail?.code` and `data?.detail?.message`.
- **Verification:** `src/services/apiClient.test.ts` passes all 9 tests.

### Remediation 7: Touch Target Accessibility Compliance
- **Files Modified:** `src/components/TabHeader.tsx`
- **Severity / Category:** Low (P3) / Accessibility (WCAG 2.5.5)
- **Problem:** Visual action buttons (38x38dp) did not meet the 48x48dp minimum physical touch target standard.
- **Solution:**
  - Added `hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}` to all header action buttons, expanding the interactive hit target to **54x54dp**.
- **Verification:** Visual aesthetics preserved; touch target compliant.

### Remediation 8: Git & Archive Hygiene
- **Files Modified:** `.gitignore`, `backend/.gitignore`
- **Severity / Category:** Low (P3) / Repository Hygiene
- **Problem:** Archive zip files (`*.zip`) were untracked and risked accidental check-in.
- **Solution:** Added `*.zip` to root `.gitignore` and `backend/.gitignore`.
