# DEPENDENCY AND LICENSING AUDIT: ClipSave

**Version:** 1.0.0  
**Date:** 2026-10-26  
**Auditor:** Antigravity Senior Application Security Engineer  

---

## 1. Mobile Client Dependencies (`package.json`)

| Package Name | Exact Version | License | Native Code | Purpose & Justification |
| :--- | :--- | :--- | :--- | :--- |
| `expo` | `~58.0.19` | MIT | Yes | Core application runtime and lifecycle management. |
| `expo-router` | `~58.0.26` | MIT | No | File-based navigation and deep link routing. |
| `expo-clipboard` | `~58.0.4` | MIT | Yes | Explicit user-tap clipboard ingestion without background polling. |
| `expo-file-system` | `~58.0.11` | MIT | Yes | Resumable foreground file streaming to private temp cache. |
| `expo-media-library` | `~58.0.12` | MIT | Yes | Scoped MediaStore public gallery saving on Android. |
| `expo-sharing` | `~58.0.20` | MIT | Yes | Native Android share sheet integration for saved videos. |
| `expo-constants` | `~58.0.13` | MIT | Yes | Runtime environment detection (Expo Go vs Development Build). |
| `expo-linking` | `~58.0.14` | MIT | Yes | Intent and deep link parameter parsing. |
| `expo-status-bar` | `~58.0.4` | MIT | No | Themed system status bar styling. |
| `@expo/vector-icons` | `^15.0.2` | MIT | No | Official maintained vector icon glyphs for UI controls. |
| `@react-native-async-storage/async-storage` | `2.2.0` | MIT | Yes | Persistent local storage for queue state, history, and settings. |
| `react` | `19.3.0` | MIT | No | UI component rendering library. |
| `react-native` | `0.88.0` | MIT | Yes | Cross-platform native mobile view framework. |
| `react-native-safe-area-context` | `~5.10.1` | MIT | Yes | Safe area insets handling for modern notch and navigation bars. |
| `react-native-screens` | `~4.30.0` | MIT | Yes | Native screen primitives for optimized memory management. |

### Mobile Development & Test Dependencies

| Package Name | Version | License | Purpose |
| :--- | :--- | :--- | :--- |
| `typescript` | `~6.0.3` | Apache-2.0 | Strict typechecking across the entire codebase. |
| `jest` | `~30.5.2` | MIT | Test runner and assertion library. |
| `jest-expo` | `~58.0.12` | MIT | Expo platform mocks and test preset. |
| `@types/jest` | `^30.0.0` | MIT | TypeScript definitions for Jest globals. |
| `ts-jest` | `^29.4.15` | MIT | TypeScript transformer for Jest. |

---

## 2. Resolver Backend Dependencies (`backend/requirements.txt`)

| Package Name | Minimum Pinned Version | License | Purpose & Justification |
| :--- | :--- | :--- | :--- |
| `fastapi` | `0.115.0+` | MIT | High-performance ASGI framework with Pydantic v2 validation. |
| `uvicorn[standard]` | `0.32.0+` | BSD-3-Clause | Production ASGI server for async request handling. |
| `pydantic-settings` | `2.6.0+` | MIT | Type-safe environment variable parsing and validation. |
| `yt-dlp` | `2025.01.26+` | Unlicense | Python API for metadata resolution and stream URL extraction. |
| `httpx` | `0.28.0+` | BSD-3-Clause | Async HTTP client for load testing and contract integration tests. |
| `pytest` | `8.3.0+` | MIT | Test framework for unit, SSRF, and contract test suites. |
| `pytest-asyncio` | `0.24.0+` | Apache-2.0 | Async test execution support for FastAPI endpoints. |

---

## 3. Supply-Chain & Privacy Verification

1. **Telemetry & Ads:** No analytics, advertising, or crash reporting packages (such as Sentry, Firebase, or Google Analytics) are installed or bundled.
2. **License Compatibility:** All dependencies utilize permissive open-source licenses (MIT, Apache-2.0, BSD-3-Clause, Unlicense). No copyleft or proprietary code is present.
3. **No Dynamic Code Loading:** No remote code execution or arbitrary JavaScript bridges are included.
