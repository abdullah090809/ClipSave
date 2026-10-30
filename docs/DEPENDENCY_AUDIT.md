# ClipSave — Dependency and Supply-Chain Audit

**Date:** 2026-10-30  
**Scope:** Direct & Transitive Dependencies across npm (Client) and pip (Backend)  
**Auditor:** Independent Software Supply-Chain & Dependency Engineering  

---

## 1. Mobile Dependencies (`package.json`)

### 1.1 Direct Production Dependencies
| Package | Version | Status | License | Purpose |
| :--- | :---: | :---: | :---: | :--- |
| `expo` | `~58.0.19` | Up-to-date | MIT | Core application runtime framework |
| `react` | `19.3.0` | Up-to-date | MIT | Component tree and hooks |
| `react-native` | `0.88.0` | Up-to-date | MIT | Native Android bridge and primitives |
| `expo-router` | `~58.0.26` | Up-to-date | MIT | File-system-based navigation and deep linking |
| `expo-file-system` | `~58.0.11` | Up-to-date | MIT | Chunked streaming downloads (`createDownloadResumable`) |
| `expo-media-library` | `~58.0.12` | Up-to-date | MIT | Android MediaStore insertion (`createAssetAsync`) |
| `@react-native-async-storage/async-storage` | `2.2.0` | Up-to-date | MIT | Key-value persistence for settings, queue, and history |
| `expo-clipboard` | `~58.0.4` | Up-to-date | MIT | Clipboard inspection for auto-paste prompt chip |
| `expo-sharing` | `~58.0.20` | Up-to-date | MIT | Android system share sheet intent trigger |
| `expo-intent-launcher` | `^58.0.3` | Up-to-date | MIT | Native video player launch intent (`android.intent.action.VIEW`) |
| `@expo/vector-icons` | `^15.0.2` | Up-to-date | MIT | Ionicons vector iconography |

### 1.2 Mobile Audit Analysis (`npm audit`)
- **Reported:** 13 vulnerabilities (9 low, 4 high).
- **Flagged Packages:** `deepmerge`, `node-forge`, `zod`.
- **Impact Assessment:** All flagged packages are transitive build-time dependencies of `@expo/cli` and `jest-config`. None of these packages are bundled into the Hermes compiled client bytecode (`_expo/static/js/android/entry-*.hbc`).
- **Remediation Recommendation:** Do NOT run `npm audit fix --force` as it forces a major downgrade of Expo to version 51 (breaking React 19 compatibility).

---

## 2. Backend Dependencies (`backend/requirements.txt`)

### 2.1 Direct Python Dependencies
| Package | Version Pin | Status | License | Purpose |
| :--- | :---: | :---: | :---: | :--- |
| `fastapi` | `>=0.115.0` | Secure | MIT | ASGI web framework, Pydantic routing, validation |
| `uvicorn[standard]` | `>=0.32.0` | Secure | BSD-3 | High-performance ASGI server with uvloop/httptools |
| `pydantic-settings` | `>=2.6.0` | Secure | MIT | Typed environment variable configuration |
| `yt-dlp[default,curl-cffi]` | `>=2025.01.26` | Secure | Unlicense | Video metadata extraction engine |
| `curl-cffi` | `>=0.16.0,<0.17.0` | Secure | MIT | Browser TLS fingerprint impersonation |
| `httpx` | `>=0.28.0` | Secure | BSD-3 | Async HTTP client for streaming proxy |
| `pytest` | `>=8.3.0` | Secure | MIT | Backend test runner |
| `pytest-asyncio` | `>=0.24.0` | Secure | Apache-2.0 | Async test fixtures and event loop management |

### 2.2 Python Dependency Check (`pip check`)
- Execution of `python -m pip check` completed with **exit code 0** and confirmed: `No broken requirements found.`
- All transitive dependencies satisfy required version constraints without version clashes.
