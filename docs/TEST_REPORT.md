# TEST EXECUTION REPORT: ClipSave

**Date:** 2026-10-26  
**Environment:** Windows Host, Node.js v24.18.0, npm 11.16.0, Python 3.13.14  
**QA Lead:** Antigravity Senior QA Automation Engineer  

---

## 1. Summary of Execution

| Suite | Runner | Total Tests | Passed | Failed | Skipped | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Mobile TypeScript Strict Check** | `tsc --noEmit` | Entire project | Clean (0 errors) | 0 | 0 | **PASSED** |
| **Mobile Unit Test Suite** | Jest 30.5.2 | 33 | 33 | 0 | 0 | **PASSED** |
| **Backend Integration Suite** | pytest 9.1.1 | 15 | 15 | 0 | 0 | **PASSED** |
| **Expo Configuration Check** | `npx expo config` | Config validation | Clean | 0 | 0 | **PASSED** |
| **Backend Benchmark / Load** | `load_test.py` | 50 requests | 50 | 0 | 0 | **VERIFIED** |
| **Android Physical/Emulator E2E**| Maestro / ADB | Scenarios 1–25 | 0 | 0 | 25 | **NOT RUN** (Reason below) |

---

## 2. Detailed Test Results

### 2.1 Mobile Frontend Test Suite (Jest)
Command: `npm test`
- `src/utils/filenameSanitizer.test.ts` (6 tests) -> **PASS**
  - sanitizes standard title with mp4 extension
  - removes illegal path traversal characters (`/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`)
  - safely handles emojis and non-Latin unicode titles
  - handles Windows reserved device names (`CON`, `PRN`, `AUX`, `NUL`, `COM1`)
  - falls back to default prefix when title is empty or only whitespace
  - truncates excessively long titles to safe length
- `src/utils/urlValidator.test.ts` (12 tests) -> **PASS**
  - valid standard tiktok video url
  - valid shortened `vm.tiktok.com` link
  - valid url without protocol prepends https
  - strips tracking query parameters (`utm_source`, `fbclid`)
  - rejects lookalike phishing domains (`tiktok.com.attacker.example`)
  - rejects evil prefixes (`evil-tiktok.com`)
  - rejects embedded credentials in URL (`user:pass@host`)
  - rejects dangerous protocols (`file:`, `javascript:`, `intent:`)
  - rejects multiple candidate URLs in input
  - extracts single URL embedded in casual prose
  - rejects empty or whitespace-only input
  - rejects control characters in input
- `src/utils/formatters.test.ts` (7 tests) -> **PASS**
  - formats bytes correctly (0 B, 1 KB, 1.5 MB, 1 GB)
  - handles undefined and negative values honestly
  - formats seconds to MM:SS
  - handles undefined duration honestly
  - formats valid ISO date
- `src/storage/queueStore.test.ts` (4 tests) -> **PASS**
  - adds job and notifies subscribers
  - updates job state and progress
  - clearTerminalJobs removes completed, failed, and cancelled jobs
  - removeJobFromQueue removes specific job
- `src/storage/historyStore.test.ts` (3 tests) -> **PASS**
  - adds history item and retrieves it
  - removes history entry without deleting file
  - clearHistoryEntriesOnly clears all records
- `src/services/apiClient.test.ts` (3 tests) -> **PASS**
  - resolves valid public TikTok URL in mock resolver mode
  - rejects private video link with appropriate user-facing explanation
  - rejects deleted or missing video link

### 2.2 Backend Test Suite (Pytest)
Command: `.\backend\.venv\Scripts\pytest -v backend\tests`
- `backend/tests/test_rate_limit.py::test_rate_limit_sliding_window` -> **PASSED**
- `backend/tests/test_resolve_api.py::test_healthz_and_readyz` -> **PASSED**
- `backend/tests/test_resolve_api.py::test_resolve_valid_mock_url` -> **PASSED**
- `backend/tests/test_resolve_api.py::test_resolve_invalid_domain_rejected` -> **PASSED**
- `backend/tests/test_resolve_api.py::test_security_headers_present` -> **PASSED**
- `backend/tests/test_ssrf.py::test_blocked_ip_ranges` -> **PASSED**
- `backend/tests/test_ssrf.py::test_verify_url_ssrf_safety_direct_ip` -> **PASSED**
- `backend/tests/test_ssrf.py::test_verify_url_ssrf_safety_public` -> **PASSED**
- `backend/tests/test_url_validation.py::test_valid_tiktok_urls` -> **PASSED**
- `backend/tests/test_url_validation.py::test_reject_lookalike_domains` -> **PASSED**
- `backend/tests/test_url_validation.py::test_reject_invalid_schemes` -> **PASSED**
- `backend/tests/test_url_validation.py::test_reject_userinfo` -> **PASSED**
- `backend/tests/test_url_validation.py::test_reject_non_standard_ports` -> **PASSED**
- `backend/tests/test_url_validation.py::test_reject_missing_path` -> **PASSED**
- `backend/tests/test_url_validation.py::test_reject_control_characters` -> **PASSED**

### 2.3 Backend Mocked Concurrency & Load Benchmark
Command: `.\backend\.venv\Scripts\python backend\load_test.py`
- Target: `http://127.0.0.1:8080/v1/resolve` (Local mock resolver mode)
- Concurrency: 10 concurrent async workers
- Total Requests: 50 requests
- Successful Requests: 50 (0 errors, 100% success)
- Total Duration: 1.273 seconds
- Throughput: **39.27 requests / second**
- Latency Metrics:
  - Median (p50): **73.05 ms**
  - 95th Percentile (p95): **335.46 ms**
  - 99th Percentile (p99): **365.06 ms**
- *Note:* These metrics reflect local mock resolver throughput. Real TikTok network resolution latency will vary based on upstream platform CDN response times.

---

## 3. Tests NOT RUN (Honest Disclosure)

| Test ID | Description | Reason NOT RUN |
| :--- | :--- | :--- |
| **E2E-01 to E2E-25** | Android Emulator & Physical Device User Journey Scenarios | Android SDK / ADB is not installed in this execution environment; no connected Android emulator or physical device was available. In accordance with Rule 3 ("never fabricate screenshots, device coverage, benchmark results"), these are recorded as `NOT RUN`. |
| **LIVE-TIKTOK-01** | High-volume live scraping tests against TikTok servers | Strictly disallowed by Rule 7.2 ("Never load-test TikTok or any third-party service. Load-test only your local/staging backend with a mocked extractor."). |
| **SOAK-01** | 6-hour continuous soak test | Marked `NOT RUN` due to interactive session execution constraints; local load test script verified baseline. |
