# REQUIREMENTS TRACEABILITY MATRIX: ClipSave

**Version:** 1.0.0  
**Date:** 2026-10-26  

---

| Req ID | Category | Requirement Description | Implementation Files | Planned Test IDs | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-01** | First-Use | Explain purpose, ownership disclaimer, and privacy policy without blocking on remote health. | `app/index.tsx`, `src/components/DisclaimerBanner.tsx` | `UT-UI-01`, `E2E-01` | Planned (Phase 1) |
| **REQ-02** | Input | Provide validated URL input with explicit paste, clear button, and resolve action. | `src/features/home/UrlInputSection.tsx`, `src/utils/urlValidator.ts` | `UT-VAL-01` to `UT-VAL-10` | Planned (Phase 1/2) |
| **REQ-03** | Validation | Strict TikTok hostname allowlist, rejection of lookalikes, userinfo, non-HTTP schemes. | `src/utils/urlValidator.ts`, `backend/app/security/url_validation.py` | `UT-VAL-01` to `UT-VAL-15`, `BE-SSRF-01` | Planned (Phase 2) |
| **REQ-04** | SSRF Defense | Backend DNS resolution check rejecting RFC 1918, loopback, link-local, and cloud metadata. | `backend/app/security/ssrf.py` | `BE-SSRF-01` to `BE-SSRF-10` | Planned (Phase 2) |
| **REQ-05** | API Contract | Typed `POST /v1/resolve` returning metadata (title, author, thumbnail, mediaUrl, expiry). | `backend/app/routes/resolve.py`, `src/services/apiClient.ts` | `BE-API-01` to `BE-API-06`, `UT-API-01` | Planned (Phase 2) |
| **REQ-06** | Mock Resolver | Deterministic mock resolver for UI testing and CI without network requests. | `src/services/mockResolver.ts`, `backend/tests/conftest.py` | `UT-MOCK-01`, `BE-MOCK-01` | Planned (Phase 2) |
| **REQ-07** | Preview UI | Resolve confirmation sheet showing validated metadata and honest size/format info. | `src/features/preview/PreviewModal.tsx` | `UT-UI-02`, `E2E-03` | Planned (Phase 3) |
| **REQ-08** | Download Engine | Foreground streaming download with real byte-level progress reporting. | `src/services/downloadEngine.ts` | `UT-DL-01` to `UT-DL-05` | Planned (Phase 4) |
| **REQ-09** | Cancellation | Safe, responsive download cancellation with immediate private temp file cleanup. | `src/services/downloadEngine.ts`, `src/features/queue/QueueItem.tsx` | `UT-DL-06`, `E2E-07` | Planned (Phase 4) |
| **REQ-10** | Resume / Range | Pause and resume only when CDN supports HTTP 206 byte ranges; clean restart otherwise. | `src/services/downloadEngine.ts` | `UT-DL-07`, `E2E-08` | Planned (Phase 4) |
| **REQ-11** | File Naming | Safe filename sanitizer removing path traversal, control chars, emojis, reserved names. | `src/utils/filenameSanitizer.ts` | `UT-SAN-01` to `UT-SAN-08` | Planned (Phase 4) |
| **REQ-12** | Gallery Save | Android MediaStore insertion via scoped storage without broad storage permissions. | `src/services/mediaManager.ts` | `UT-FS-01`, `E2E-06` | Planned (Phase 4) |
| **REQ-13** | History | Persistent local history, open, share, remove record, and separate delete file option. | `src/features/history/HistoryScreen.tsx`, `src/storage/historyStore.ts` | `UT-HIST-01` to `UT-HIST-05`, `E2E-09` | Planned (Phase 5) |
| **REQ-14** | Settings | Real, functional settings: Theme (system/light/dark), clear history, clear cache. | `src/features/settings/SettingsScreen.tsx`, `src/storage/settingsStore.ts` | `UT-SET-01` to `UT-SET-04`, `E2E-10` | Planned (Phase 5) |
| **REQ-15** | Accessibility | Touch targets >= 48dp, WCAG AA contrast, TalkBack labels, dynamic font scaling. | `src/theme/`, `src/components/` | `UT-A11Y-01` to `UT-A11Y-04` | Planned (Phase 5) |
| **REQ-16** | Failure Recovery | Startup orphan temp file cleanup, interrupted download recovery, expired CDN retry. | `src/services/recoveryCoordinator.ts` | `UT-REC-01` to `UT-REC-04` | Planned (Phase 6) |
| **REQ-17** | Rate Limiting | Backend token-bucket rate limiting returning HTTP 429 with `Retry-After`. | `backend/app/security/rate_limit.py` | `BE-RL-01` to `BE-RL-04` | Planned (Phase 2/6) |
| **REQ-18** | Redacted Logging | Redact query strings, signed tokens, and PII from all mobile and backend logs. | `src/utils/logger.ts`, `backend/app/security/logging.py` | `BE-LOG-01`, `UT-LOG-01` | Planned (Phase 6) |
| **REQ-19** | Zero Telemetry | Zero tracking SDKs, zero advertising IDs, zero analytics libraries. | `package.json`, `docs/DEPENDENCIES.md` | `SEC-AUDIT-01` | Planned (Phase 6) |
| **REQ-20** | CI Workflows | Reproducible lint, type-check, unit tests, and backend tests in GitHub Actions. | `.github/workflows/ci.yml` | `CI-RUN-01` | Planned (Phase 9) |
