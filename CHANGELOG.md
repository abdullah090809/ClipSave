# CHANGELOG: ClipSave

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-10-26

### Added
- **Mobile Client:**
  - Complete React Native + Expo + TypeScript strict mode project structure.
  - Tab navigation with Expo Router: Home, Queue, History, Settings, About.
  - Theme system supporting System, Light, and Dark modes with slate/cyan tokens.
  - Strict client-side TikTok URL parser and hostname allowlist.
  - Transparent video preview modal displaying validated metadata and rights reminder.
  - Truthful download engine reporting real byte transfers with pause/resume and safe cancellation.
  - Android MediaStore scoped storage integration (`expo-media-library`) and fallback share integration (`expo-sharing`).
  - Persistent local history with distinct actions for removing records vs deleting files from device.
  - Mock resolver mode toggleable in Settings for local, offline, and CI verification.
  - Full Jest unit test suite covering filename sanitization, formatters, URL validation, queue coordinator, history store, and API client (33/33 tests passing).
- **Backend Resolver:**
  - FastAPI stateless service utilizing Python `yt-dlp` API.
  - Multi-tier SSRF protection verifying DNS lookups against loopback, private RFC 1918, link-local, and cloud metadata ranges.
  - Sliding-window rate limiting per client IP returning HTTP 429 with `Retry-After`.
  - Bounded concurrency semaphore and strict timeout enforcement.
  - Security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Server: ClipSave-Resolver`).
  - Liveness and readiness endpoints (`/healthz`, `/readyz`).
  - Full Pytest test suite covering SSRF defense, rate limiting, and contract endpoints (15/15 tests passing).
  - Production multi-stage, non-root Dockerfile and Docker Compose definition.
- **Documentation:**
  - `README.md`, `REPOSITORY_AUDIT.md`, `ARCHITECTURE.md`, `EXPO_GO_LIMITATIONS.md`, `REQUIREMENTS_TRACEABILITY.md`, `PRIVACY.md`, `DEPENDENCIES.md`, `THREAT_MODEL.md`, `TEST_PLAN.md`, `TEST_REPORT.md`, `RUNBOOK.md`, `OPERATIONS.md`, `DEPLOYMENT.md`, `BUGS_AND_RISKS.md`, `INCIDENT_RESPONSE.md`.
