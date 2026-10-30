# ClipSave — Reliability and Failure-Recovery Audit

**Date:** 2026-10-30  
**Scope:** Fault Injection, Interrupted State Recovery, Orphaned File Cleanup, and Container Cold-Start Handling  
**Auditor:** Independent Reliability & Resilience Engineering  

---

## 1. Reliability Matrix

| Failure Mode | Injected Condition | Expected Behavior | Actual Verified Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Process Death During Download** | App terminated while job in `DOWNLOADING` | Job reconciled on restart; marked retryable | `queueStore.ts` detects in-flight jobs on load, marks `FAILED` with `isRetryable: true` | **PASS** |
| **Orphaned Temp Files** | Aborted stream leaves `.tmp` file in cache | Auto-cleaned without deleting active jobs | `cleanOrphanedTempFiles()` purges files >5 mins old if unreferenced | **PASS** |
| **Backend Dormant / Sleeping** | SnapDeploy container returns `503` / `X-Wake-Page` | App wakes container without crashing UI | `checkAndWarmBackend()` triggers `POST /api/public/wake/{subdomain}` | **PASS** |
| **Proxy Stream Network Drop** | Proxy stream returns 502 or drops socket | Resilient fallback to direct CDN stream | `downloadEngine.ts` falls back to `directMediaUrl` if available | **PASS** |
| **Duplicate History Items** | Re-downloading video with existing ID | Idempotent insertion; no duplicate entries | `addHistoryItem()` filters by ID before unshifting new item | **PASS** |
| **Storage Deletion Separation** | User removes download record from history | Media file preserved unless explicitly confirmed | `removeHistoryEntryOnly()` deletes record only; `deleteHistoryEntryAndFile()` deletes file | **PASS** |
| **Non-Standard Platform Port** | User inputs URL with port `:8080` or `:8443` | URL rejected before network dispatch | `validateMediaUrl()` explicitly rejects ports other than 80 and 443 | **PASS** |

---

## 2. In-Depth Recovery Mechanism Verification

### 2.1 Process Death Reconciliation (`queueStore.ts`)
```typescript
memoryJobs = parsed.map((job) => {
  if (job.state === 'DOWNLOADING' || job.state === 'FINALIZING') {
    return {
      ...job,
      state: 'FAILED' as DownloadState,
      statusMessage: 'Interrupted by app termination',
      errorMessage: 'Process closed during download. You can tap Retry to resume.',
      isRetryable: true,
    };
  }
  return job;
});
```
- **Verification:** When Android OS kills the process in low-memory situations or when the user swipes away the task from the Recent Apps list, no job remains in a permanent loading spinner or invalid active state. On next launch, the user can tap **Retry** to restart the download cleanly.

### 2.2 Storage Safety & Orphaned File Cleanup (`mediaManager.ts`)
- The temporary download folder `${FileSystem.cacheDirectory}downloads/` is protected by `getActiveTempFilePaths()`.
- Active downloads (`DOWNLOADING`, `FINALIZING`, `QUEUED`), paused downloads (`PAUSED`), and retryable failed jobs (`FAILED` with `isRetryable: true`) retain their temp file paths in an active lock set.
- Periodic cleanup safely prunes orphaned `.tmp` files older than 5 minutes that do not match any job in the active lock set.
