# REQUIREMENTS TRACEABILITY MATRIX: ClipSave

**Version:** 1.0.0  
**Date:** 2026-10-26  
**Status:** Pre-Device Verification Baseline Verified  

---

| Req ID | Category | Requirement Description | Implementation Files | Verified Test Suites & Test IDs | Current Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-01** | First-Use | Explain purpose, ownership disclaimer, and privacy policy without blocking on remote health. | `app/(tabs)/index.tsx`, `src/components/DisclaimerBanner.tsx` | Visual Inspection, `Phone Checklist Test A` | **PASS** |
| **REQ-02** | Input | Provide validated URL input with explicit paste, clear button, and resolve action. | `app/(tabs)/index.tsx` | `urlValidator.test.ts` (12 tests), `Phone Checklist Test B` | **PASS** |
| **REQ-03** | Validation | Strict TikTok hostname allowlist, rejection of lookalikes, userinfo, non-HTTP schemes. | `src/utils/urlValidator.ts`, `backend/app/security/url_validation.py` | `urlValidator.test.ts` (12 tests), `test_url_validation.py` (7 tests) | **PASS** |
| **REQ-04** | SSRF Defense | Backend DNS resolution check rejecting RFC 1918, loopback, link-local, and cloud metadata. | `backend/app/security/ssrf.py` | `test_ssrf.py` (5 tests covering IP ranges, direct IPs, public hosts, DNS rebinding, and cloud metadata) | **PASS** |
| **REQ-05** | API Contract | Typed `POST /v1/resolve` returning metadata (title, author, thumbnail, mediaUrl, expiry). | `backend/app/routes/resolve.py`, `src/services/apiClient.ts` | `test_resolve_api.py` (10 tests), `apiClient.test.ts` (3 tests) | **PASS** |
| **REQ-06** | Mock Resolver | Deterministic mock resolver for UI testing and CI without network requests. | `src/services/mockResolver.ts`, `backend/app/services/extractor.py` | `apiClient.test.ts`, `test_resolve_api.py::test_resolve_valid_mock_url` | **PASS** |
| **REQ-07** | Preview UI | Resolve confirmation sheet showing validated metadata and honest size/format info. | `app/preview.tsx` | Visual inspection, `Phone Checklist Test C & D` | **PASS** |
| **REQ-08** | Download Engine | Foreground streaming download with real byte-level progress reporting. | `src/services/downloadEngine.ts` | `downloadEngine.test.ts::UT-DL-01` | **PASS** |
| **REQ-09** | Cancellation | Safe, responsive download cancellation with immediate private temp file cleanup. | `src/services/downloadEngine.ts` | `downloadEngine.test.ts::UT-DL-04` | **PASS** |
| **REQ-10** | Resume / Range | Pause and resume download session; safe fallback if range unacknowledged. | `src/services/downloadEngine.ts` | `downloadEngine.test.ts::UT-DL-02`, `UT-DL-03` | **PASS** |
| **REQ-11** | File Naming | Safe filename sanitizer removing path traversal, control chars, emojis, reserved names. | `src/utils/filenameSanitizer.ts` | `filenameSanitizer.test.ts` (6 tests) | **PASS** |
| **REQ-12** | Gallery Save | Android MediaStore insertion via scoped storage without broad storage permissions. | `src/services/mediaManager.ts` | `mediaManager.test.ts::UT-MM-04`, `UT-MM-05` | **PARTIAL** (Full in Dev Build / Scoped in Expo Go) |
| **REQ-13** | History | Persistent local history, open, share, remove record, and separate delete file option. | `app/(tabs)/history.tsx`, `src/storage/historyStore.ts` | `historyStore.test.ts` (3 tests), `Phone Checklist Test I & J` | **PASS** |
| **REQ-14** | Settings | Real, functional settings: Theme (system/light/dark), clear history, clear cache, backend URL. | `app/(tabs)/settings.tsx`, `src/storage/settingsStore.ts` | `settingsStore.test.ts` (3 tests), `Phone Checklist Test A, K` | **PASS** |
| **REQ-15** | Accessibility | Touch targets >= 48dp, WCAG AA contrast, TalkBack labels, dynamic font scaling. | `src/theme/`, `src/components/` | Visual Inspection, TalkBack accessibility labeling | **PASS** |
| **REQ-16** | Failure Recovery | Startup orphan temp file cleanup (>15 mins), interrupted download recovery, expired retry. | `app/_layout.tsx`, `src/services/mediaManager.ts` | `mediaManager.test.ts::UT-MM-02` | **PASS** |
| **REQ-17** | Rate Limiting | Backend token-bucket rate limiting returning HTTP 429 with `Retry-After`. | `backend/app/security/rate_limit.py` | `test_rate_limit.py::test_rate_limit_sliding_window` | **PASS** |
| **REQ-18** | Redacted Logging | Redact query strings, signed tokens, and PII from all mobile and backend logs. | `backend/app/security/logging.py`, `src/utils/logger.ts` | Code inspection & manual audit | **PASS** |
| **REQ-19** | Zero Telemetry | Zero tracking SDKs, zero advertising IDs, zero analytics libraries. | `package.json`, `docs/DEPENDENCIES.md` | Codebase audit | **PASS** |
| **REQ-20** | CI Workflows | Reproducible lint, type-check, unit tests, and backend tests in GitHub Actions. | `.github/workflows/ci.yml` | `npm run typecheck`, `npm test`, `pytest` | **PASS** |
| **TEST-01** | Device Verification | Physical Android phone testing covering scenarios A through M. | `docs/PHONE_TEST_CHECKLIST.md` | `Phone Checklist Tests A through M` | **NOT RUN** (Awaiting user device test) |
| **BUILD-01**| Native Compilation | Standalone APK build generation via `gradlew assembleRelease` or EAS. | Local Gradle / EAS CLI | Local Android SDK / JDK 17 missing | **BLOCKED** |
