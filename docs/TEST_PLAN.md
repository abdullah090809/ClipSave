# TEST PLAN & TEST SUITE MATRIX: ClipSave

**Version:** 1.0.0  
**Date:** 2026-10-26  
**QA Lead:** Antigravity Senior QA Automation Engineer  

---

## 1. Test Perspectives & Strategy

Testing is conducted from four distinct perspectives:
1. **Developer:** Strict TypeScript type safety, Jest unit tests, state machine transitions, edge-case sanitization.
2. **User:** Core user journeys (paste URL -> resolve -> download with truthful progress -> open/share -> history deletion).
3. **Operator:** Health/readiness checks, concurrency limits, rate limiting, graceful shutdowns, load benchmarks.
4. **Attacker:** SSRF evasion, malformed URLs, lookalike domains, oversized requests, path traversal filenames.

---

## 2. Test Suite Inventory

| Test Category | Test File | Scope / Purpose |
| :--- | :--- | :--- |
| **Unit - URL Validator** | `src/utils/urlValidator.test.ts` | Host allowlist, lookalikes, scheme validation, tracking params, control chars. |
| **Unit - Sanitizer** | `src/utils/filenameSanitizer.test.ts` | Path traversal, reserved names, Unicode/emojis, max length. |
| **Unit - Formatters** | `src/utils/formatters.test.ts` | Byte formatting, duration, date formatting. |
| **Unit - Queue Store** | `src/storage/queueStore.test.ts` | Queue lifecycle, status transitions, listener notifications. |
| **Unit - History Store** | `src/storage/historyStore.test.ts` | History add, retrieve, record-only removal, clear all. |
| **Unit - API Client** | `src/services/apiClient.test.ts` | Mock mode resolution, error handling, private/deleted video handling. |
| **Backend - SSRF** | `backend/tests/test_ssrf.py` | Private IP detection, DNS verification, loopback and cloud metadata defense. |
| **Backend - Validation** | `backend/tests/test_url_validation.py` | TikTok host allowlist, lookalike domain rejection, scheme/userinfo rejection. |
| **Backend - Rate Limiting**| `backend/tests/test_rate_limit.py` | Sliding window burst limit checking and Retry-After headers. |
| **Backend - API Contract**| `backend/tests/test_resolve_api.py` | Liveness/readiness probes, POST /v1/resolve contracts, security headers. |
| **Operator - Load Test** | `backend/load_test.py` | Concurrency, throughput (req/s), and latency percentiles (p50, p95, p99). |

---

## 3. Environment & Runtime Constraints

- **Local Development Environment:** Windows host with Node.js v24.18.0, npm 11.16.0, Python 3.13.14.
- **Android Emulator / Physical Device:** ADB / Android SDK is not locally installed on this host. Therefore, physical device flashing and Android emulator tests are documented as `NOT RUN` with reasons explained in `docs/TEST_REPORT.md`.
