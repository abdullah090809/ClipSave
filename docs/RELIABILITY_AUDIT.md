# ClipSave — Reliability, Silent Failures & Error Handling Audit

## 1. Executive Summary & Resilience Posture
This audit investigates potential points of failure, unhandled promise rejections, state desynchronization, and edge-case behaviors across the ClipSave mobile client and backend.

All identified edge cases and silent failure modes have been hardened in code and backed by automated regression tests.

---

## 2. Silent Failures & Critical Edge Cases Audited

### 2.1 File Sharing & Playback Failure (`ExpoSharing.shareAsync`)
- **Symptom:** Tapping "Play" on a downloaded video caused `ExpoSharing.shareAsync has been rejected: Not allowed to read file under given URL`.
- **Root Cause Analysis:** Android 10+ Scoped Storage prevents arbitrary access to `content://media/external/...` URIs from external sharing activities unless granted via ContentProvider. `saveCompletedMedia` previously returned the Android MediaStore asset URI rather than the app's sandboxed local `file://` path.
- **Remediation in `mediaManager.ts`:**
  1. `saveCompletedMedia` now consistently returns the permanent `file://` path (`destinationPath`).
  2. `shareSavedMedia` checks if the URI begins with `content://` and attempts resolution to `localUri` via `MediaLibrary.getAssetInfoAsync()`.
  3. Pre-flight `FileSystem.getInfoAsync()` checks file existence before invoking `shareAsync()`, displaying a helpful alert if the file was deleted externally rather than throwing an unhandled rejection.

### 2.2 Filesystem Move Fallback Failure
- **Symptom:** Renaming or moving files on some Android vendor skins (Xiaomi MIUI, Samsung OneUI) occasionally throws `ExponentFileSystem.moveAsync has been rejected`.
- **Remediation in `mediaManager.ts`:**
  - Implemented a 3-tier move strategy:
    1. Primary move to sanitized destination name.
    2. Fallback move to safe timestamp filename (`ClipSave_{Date.now()}.mp4`).
    3. Copy-and-delete fallback (`FileSystem.copyAsync` followed by `FileSystem.deleteAsync`).

### 2.3 Process Death & Mid-Download Interruption
- **Symptom:** If the user swipes away the app from the Android task switcher or iOS app switcher during a download, the job is left in `DOWNLOADING` state indefinitely in AsyncStorage.
- **Remediation in `queueStore.ts`:**
  - During `loadQueueFromStorage()`, state reconciliation scans all jobs.
  - Any job stored in `DOWNLOADING` or `FINALIZING` is automatically reconciled to `FAILED` with `statusMessage: 'Interrupted by app termination'` and `isRetryable: true`.
  - The user can resume or retry the download with one tap.

### 2.4 Unhandled Rejection in Backend Structured Error Parsing
- **Symptom:** Backend returned structured errors inside `{"detail": {"code": "...", "message": "..."}}`. The mobile client previously only inspected `data?.code` and `data?.message`, causing it to lose the server's specific message (e.g. `MEDIA_PRIVATE`, `INVALID_URL`) and fall back to generic error text.
- **Remediation in `apiClient.ts`:**
  - Safely extracts `data?.detail?.code` and `data?.detail?.message`.
  - Supports string details, object details, and status-code fallbacks.

### 2.5 In-Flight Storage Deduplication
- **Symptom:** Concurrent calls to `loadQueueFromStorage()` from multiple mounting screens initiated duplicate `AsyncStorage.getItem()` requests, risking race conditions.
- **Remediation in `queueStore.ts`:**
  - Implemented promise deduplication: `let loadQueuePromise: Promise<DownloadJob[]> | null`.
  - Concurrent callers receive the identical in-flight promise.

---

## 3. Upstream Edge Case Handling Matrix

| Scenario | Upstream Error Code | Backend Handling | Mobile UX Presentation |
| :--- | :--- | :--- | :--- |
| **Private Video** | `yt-dlp` DownloadError (login required) | `HTTP 403 (MEDIA_PRIVATE)` | Displays `"This video is private or restricted. ClipSave cannot access private content."` with no retry loop. |
| **Deleted / Missing Video** | `yt-dlp` DownloadError (404/not found) | `HTTP 404 (MEDIA_NOT_FOUND)` | Displays `"The requested video is unavailable or has been deleted."` |
| **Geo-Blocked Video** | `yt-dlp` DownloadError (geo/region restricted) | `HTTP 403 (MEDIA_GEOBLOCKED)` | Displays `"This video is unavailable in your current region."` |
| **SSRF Attempt / Malicious Link** | IP validation / DNS safety check fails | `HTTP 400 (SSRF_RESTRICTED)` | Displays `"Host is not permitted for resolution."` |
| **Dormant Server Cold-Start** | SnapDeploy sleeping container (503) | Auto-wake trigger & 503 response | Displays calm progression (`"Waking up server..."` -> `"Almost ready..."`) and automatically polls until warm. |
| **Rate Limit Exceeded** | Sliding window count >= 30 | `HTTP 429 (TOO_MANY_REQUESTS)` with `Retry-After` | Displays `"Too many requests. Please wait a moment before trying again."` |
