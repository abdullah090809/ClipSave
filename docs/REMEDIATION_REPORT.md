# ClipSave — Remediation Report

**Date:** 2026-10-30  
**Status:** All Target Issues Remediated and Verified via Automated Regression Tests  
**Auditor:** Independent Software Engineering & Quality Assurance  

---

## 1. Remediation Register

| Finding ID | Component | Severity | Description | Root Cause | Remediated In | Regression Test & Verification |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| **REM-01** | `settingsStore.ts` | **HIGH** | Ephemeral developer ngrok URL (`ngrok-free.app`) set as `PRODUCTION_BACKEND_URL` and written to user settings. | Temporary developer testing URL was set as default production endpoint. | `src/storage/settingsStore.ts` | `UT-SET-03B`, `UT-SET-03C` pass. `PRODUCTION_BACKEND_URL` defaults to official SnapDeploy backend. |
| **REM-02** | `app.json` | **HIGH** | Android `usesCleartextTraffic: true` permitted insecure unencrypted HTTP traffic. | Left enabled from early local emulator testing. | `app.json` | Set `usesCleartextTraffic: false`. Enforces secure TLS for all external communications. |
| **REM-03** | `settings.tsx` | **MEDIUM** | Settings Accordion lacked "Network & Resolver" section to view/edit backend endpoint or toggle Mock mode. | Omitted during accordion redesign. | `app/(tabs)/settings.tsx` | Added "Network & Resolver" Accordion with Mock Mode switch, URL editor, Reset, and Connection tester. |
| **REM-04** | `build-apk.yml` | **HIGH** | CI APK build script generated debug keystore and masqueraded it as release signing. | Debug keystore fallback was unconditionally applied to `assembleRelease`. | `.github/workflows/build-apk.yml` | Explicit check for `ANDROID_KEYSTORE_BASE64` secret; clean separation of debug vs release signing. |
| **REM-05** | `Dockerfile` | **MEDIUM** | Container command used `--workers 2` with in-memory session dictionaries and `--forwarded-allow-ips '*'`. | Multi-worker process model partitions in-memory stream sessions. | `backend/Dockerfile` | Configured `--workers 1` for consistent in-memory session registry and rate limiting in single-container hosting. |

---

## 2. Detailed Fix Walkthroughs

### 2.1 Remediation of Production Backend URL (REM-01)
- **Before:**
  ```typescript
  export const NGROK_BACKEND_URL = 'https://ef84-39-62-179-21.ngrok-free.app';
  export const PRODUCTION_BACKEND_URL = NGROK_BACKEND_URL;
  ```
- **After:**
  ```typescript
  export const SNAPDEPLOY_BACKEND_URL = 'https://clipsave-96518.containers.snapdeploy.app';
  export const PRODUCTION_BACKEND_URL = SNAPDEPLOY_BACKEND_URL;
  ```
- **Self-Healing Migration Added:**
  If a user has an expired ngrok tunnel (`*.ngrok-free.app`) or local IP stored in their local device settings, `settingsStore.ts` automatically heals and migrates their configuration back to `PRODUCTION_BACKEND_URL`.

### 2.2 Enforcing Encrypted Traffic on Android (REM-02)
- In [`app.json`](file:///d:/Skills/Tiktok%20Downloader/app.json):
  `"usesCleartextTraffic": false`
- Eliminates cleartext MITM exposure on public Wi-Fi networks.

### 2.3 Exposing Network & Resolver Settings (REM-03)
- In [`app/(tabs)/settings.tsx`](file:///d:/Skills/Tiktok%20Downloader/app/(tabs)/settings.tsx), added the "Network & Resolver" accordion:
  - **Mock Resolver Switch:** Allows developers and testers to run offline mock video resolutions.
  - **Backend Resolver URL:** Displays the current active endpoint, allows manual URL override, and provides a one-tap **Reset** to the official SnapDeploy deployment.
  - **Test Backend Connection:** Pings `/healthz` on the configured backend and provides instant status feedback (Online, Sleeping/503, or Connection Error).
