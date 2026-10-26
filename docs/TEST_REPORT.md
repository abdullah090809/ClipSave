# TEST EXECUTION REPORT: ClipSave

**Date:** 2026-10-26  
**Environment:** Windows Host, Node.js v24.18.0, npm 11.16.0, Python 3.13.14  
**QA Lead:** Antigravity Senior QA Automation Engineer  

---

## 1. Summary of Execution

| Suite | Runner | Total Tests | Passed | Failed | Skipped | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Mobile TypeScript Strict Check** | `tsc --noEmit` | Entire project | Clean (0 errors) | 0 | 0 | **PASSED** |
| **Mobile Unit Test Suite** | Jest 30.5.2 | 49 | 49 | 0 | 0 | **PASSED** |
| **Backend Integration Suite** | pytest 9.1.1 | 22 | 22 | 0 | 0 | **PASSED** |
| **Total Automated Tests** | Jest & Pytest | **71** | **71** | **0** | **0** | **PASSED (100%)** |
| **Expo Configuration Check** | `npx expo config` | Config validation | Clean | 0 | 0 | **PASSED** |
| **Backend Benchmark / Load** | `load_test.py` | 50 requests | 50 | 0 | 0 | **VERIFIED** |
| **Android Physical/Emulator E2E**| Phone Test Runbook | Scenarios A–M | 0 | 0 | 13 | **NOT RUN** (Reason below) |

---

## 2. Detailed Test Results

### 2.1 Mobile Frontend Test Suite (Jest)
Command: `npm test`  
Result: 9 suites passed, 49 tests passed

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
- `src/storage/settingsStore.test.ts` (3 tests) -> **PASS**
  - returns default settings when no preferences stored
  - saveSettings merges partial updates and persists to storage
  - getDefaultBackendUrl returns valid default address
- `src/services/apiClient.test.ts` (3 tests) -> **PASS**
  - resolves valid public TikTok URL in mock resolver mode
  - rejects private video link with appropriate user-facing explanation
  - rejects deleted or missing video link
- `src/services/downloadEngine.test.ts` (7 tests) -> **PASS**
  - `UT-DL-01`: startDownload creates job and completes successfully
  - `UT-DL-02`: pauseDownload transitions active session to PAUSED
  - `UT-DL-03`: resumeDownload resumes paused download session to COMPLETED
  - `UT-DL-04`: cancelDownload terminates session and cleans temp file
  - `UT-DL-05`: retryDownload increments retry count and restarts stream
  - `UT-DL-06`: server HTTP error sets state to FAILED with retryable flag
  - `UT-DL-07`: storage save failure marks job FAILED without retry
- `src/services/mediaManager.test.ts` (6 tests) -> **PASS**
  - `UT-MM-01`: ensureTempDirectory creates directory when it does not exist
  - `UT-MM-02`: cleanOrphanedTempFiles deletes files older than threshold
  - `UT-MM-03`: saveCompletedMedia rejects corrupted or zero-byte file
  - `UT-MM-04`: saveCompletedMedia saves to gallery when permissions granted
  - `UT-MM-05`: saveCompletedMedia falls back to document storage when gallery denied
  - `UT-MM-06`: shareSavedMedia invokes native share dialog

### 2.2 Backend Test Suite (Pytest)
Command: `.\backend\.venv\Scripts\pytest -v backend\tests`  
Result: 4 modules passed, 22 tests passed

- `backend/tests/test_rate_limit.py` (1 test) -> **PASSED**
  - `test_rate_limit_sliding_window`
- `backend/tests/test_resolve_api.py` (9 tests) -> **PASSED**
  - `test_healthz_and_readyz`
  - `test_resolve_valid_mock_url`
  - `test_resolve_invalid_domain_rejected`
  - `test_resolve_malformed_json`
  - `test_resolve_missing_url_field`
  - `test_resolve_non_string_url`
  - `test_security_headers_present`
  - `test_request_id_forwarding`
  - `test_cors_local_network_origin`
- `backend/tests/test_ssrf.py` (5 tests) -> **PASSED**
  - `test_blocked_ip_ranges` (Loopback, RFC 1918, CGNAT, Cloud metadata, IPv6 Unique/Link Local, Multicast)
  - `test_verify_url_ssrf_safety_direct_ip`
  - `test_verify_url_ssrf_safety_public`
  - `test_verify_url_ssrf_dns_rebinding_simulation`
  - `test_verify_url_ssrf_metadata_dns_simulation`
- `backend/tests/test_url_validation.py` (7 tests) -> **PASSED**
  - `test_valid_tiktok_urls`
  - `test_reject_lookalike_domains`
  - `test_reject_invalid_schemes`
  - `test_reject_userinfo`
  - `test_reject_non_standard_ports`
  - `test_reject_missing_path`
  - `test_reject_control_characters`

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

---

## 3. Tests NOT RUN (Honest Disclosure)

| Test ID | Description | Reason NOT RUN |
| :--- | :--- | :--- |
| **Phone Tests A–M** | Android Physical Device Scenarios A–M | Requires physical Android phone running Expo Go on the local Wi-Fi network. Prepared step-by-step in `docs/PHONE_TEST_CHECKLIST.md`. |
| **LIVE-TIKTOK-01** | High-volume live scraping tests against TikTok servers | Disallowed by Rule 7.2 ("Never load-test TikTok or any third-party service. Load-test only your local/staging backend with a mocked extractor."). |
| **SOAK-01** | 6-hour continuous soak test | Marked `NOT RUN` due to interactive session constraints; local load test script verified baseline stability. |
| **BUILD-APK-01** | Standalone Android APK local Gradle compilation | Blocked because host machine has Java 8 (`1.8.0_401`) and lacks Android SDK (`ANDROID_HOME`). JDK 17 is required for React Native 0.88 native builds. |
