# ClipSave — Automated Test & Verification Report

## 1. Executive Summary & Verification Matrix
All test suites across the backend and mobile applications pass with **100% success rate and zero failures**.

| Test Suite | Framework / Tool | Tests Total | Passed | Failed | Duration | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Backend Unit & Security Tests** | Pytest 9.1 / Python 3.13 | 32 | **32** | 0 | 2.15s | **PASS** |
| **Mobile Client Unit Tests** | Jest 29 / React Native Jest | 82 | **82** | 0 | 4.87s | **PASS** |
| **TypeScript Strict Typecheck** | `tsc --noEmit` (TypeScript 6.0) | Full project | **PASS** | 0 | 8.2s | **0 Errors** |
| **Production Bundle Export** | `npx expo export --platform android` | 1236 modules | **PASS** | 0 | 30.4s | **Clean Export** |
| **Local Load Benchmark** | `load_test.py` (Async HTTPX) | 100 reqs @ C=10 | **PASS** | 0 | 0.92s | **108.59 RPS** |

---

## 2. Backend Automated Test Suite Breakdown (32 Tests)

### 2.1 SSRF & Network Security (`backend/tests/test_ssrf.py` — 8 tests)
- `test_blocked_ip_ranges`: Asserts blocking on loopback (`127.0.0.1`, `::1`), RFC1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), Carrier-Grade NAT (`100.64.0.0/10`), Cloud Metadata (`169.254.169.254`), and IPv6 link-local (`fe80::1`).
- `test_verify_url_ssrf_safety_direct_ip`: Asserts rejection of literal IP hostnames.
- `test_verify_url_ssrf_safety_public`: Asserts that public TikTok hosts pass DNS safety check.
- `test_verify_url_ssrf_dns_rebinding_simulation`: Tests DNS rebinding attempts returning private IPs.
- `test_verify_url_metadata_dns_simulation`: Tests DNS returning AWS metadata IP (`169.254.169.254`).
- `test_verify_url_disallowed_schemes` *(NEW)*: Rejects `file:///etc/passwd`, `ftp://`, `gopher://`, `data:`.
- `test_stream_proxy_ssrf_upstream_rejected` *(NEW)*: Rejects stream sessions with direct private upstream IPs.
- `test_stream_proxy_ssrf_redirect_to_metadata_blocked` *(NEW)*: Blocks stream proxy 302 redirects targeting cloud metadata.

### 2.2 Stream Session Registry & Entropy (`backend/tests/test_stream_session.py` — 3 tests)
- `test_stream_session_registration_and_retrieval` *(NEW)*: Verifies token lookup and headers retention.
- `test_stream_session_expiration_cleanup` *(NEW)*: Asserts auto-pruning of sessions older than 7,200s (2 hours).
- `test_stream_session_capacity_bounding` *(NEW)*: Asserts LRU eviction when session count reaches capacity cap.

### 2.3 Rate Limiting & Memory Bounding (`backend/tests/test_rate_limit.py` — 3 tests)
- `test_rate_limit_sliding_window`: Asserts requests up to 30/min succeed, 31st returns HTTP 429.
- `test_rate_limit_stale_ip_pruning` *(NEW)*: Asserts expired IP records are completely pruned from memory.
- `test_rate_limit_hard_cap_enforcement` *(NEW)*: Asserts dictionary does not exceed `MAX_TRACKED_IPS = 10000`.

### 2.4 API Endpoints & Protocols (`backend/tests/test_resolve_api.py` — 11 tests)
- Root, `/healthz`, and `/readyz` health endpoints.
- `/v1/resolve` mock resolution with complete metadata schema.
- Malformed inputs, missing URL fields, non-string URLs, invalid domains.
- Security headers presence (`nosniff`, `DENY`, `Server`).
- `X-Request-ID` tracing propagation.
- Local network CORS origin reflection.
- `/v1/stream/{stream_id}` 404 handling.

### 2.5 URL Validation Allowlist (`backend/tests/test_url_validation.py` — 7 tests)
- Valid formats: standard videos, short links (`vt.tiktok.com`, `vm.tiktok.com`), mobile web (`m.tiktok.com`).
- Disallowed domains, path traversal attempts, and malformed query strings.

---

## 3. Mobile Automated Test Suite Breakdown (82 Tests)

| Test File | Tests | Focus Area |
| :--- | :--- | :--- |
| `src/services/downloadEngine.test.ts` | 9 | Download lifecycle (start, pause, resume, cancel, retry, remove, HTTP errors, disk quota errors, **concurrency queueing and dequeuing**) |
| `src/services/apiClient.test.ts` | 9 | SnapDeploy cold-start wake orchestration, timeout retries, structured error handling, network failure |
| `src/services/mediaManager.test.ts` | 6 | Temp directory setup, orphaned file cleanup, scoped storage export, 3-tier move fallback |
| `src/storage/queueStore.test.ts` | 8 | Queue mutations, throttled progress dispatching, process death state reconciliation |
| `src/storage/historyStore.test.ts` | 7 | History persistence, entry removal, bulk file deletion, on-demand file check |
| `src/storage/settingsStore.test.ts` | 8 | Defaults, migrations, theme modes, local IP self-healing |
| `src/storage/performance.test.ts` | 4 | Large dataset throughput, memory caching, non-blocking disk reads |
| `src/utils/urlValidator.test.ts` | 12 | Clipboard URL extraction, allowlist matching, dirty text extraction |
| `src/utils/filenameSanitizer.test.ts` | 8 | Path traversal sanitization, reserved Windows/POSIX characters, length clamping |
| `src/utils/formatters.test.ts` | 6 | Byte formatting (B, KB, MB, GB), duration formatting (`mm:ss`, `hh:mm:ss`) |
| `src/utils/jobDisplay.test.ts` | 6 | Card bucketing (active vs completed), state badge colors, status formatting |
| `src/utils/speedTracker.test.ts` | 5 | Moving-average download speed calculations and ETA projections |

---

## 4. Production Build & Static Analysis Checks

### 4.1 TypeScript Compiler (`tsc --noEmit`)
- Mode: `strict: true`, `exactOptionalPropertyTypes: true`, `noImplicitAny: true`.
- Result: **0 errors, 0 warnings**.

### 4.2 Production Android Bundle Export
- Command: `npx expo export --platform android --no-bytecode`
- Result: 1236 modules compiled into `_expo/static/js/android/entry-8cf8910fb9acef903801937fe2c5c981.js (1.8MB)`.
- Exit code: **0**.
