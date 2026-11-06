import { AppState, AppStateStatus } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { DownloadJob, ResolvedMedia } from '../types';
import {
  addJobToQueue,
  updateJobInQueue,
  removeJobFromQueue,
  getQueue,
} from '../storage/queueStore';
import { addHistoryItem } from '../storage/historyStore';
import { getSettings } from '../storage/settingsStore';
import { sanitizeFilename } from '../utils/filenameSanitizer';
import { createSpeedTracker } from '../utils/speedTracker';
import {
  ensureTempDirectory,
  saveCompletedMedia,
  ensureMediaLibraryPermissions,
  DOWNLOADS_TEMP_DIR,
} from './mediaManager';
import {
  notifyDownloadStarted,
  notifyDownloadProgress,
  notifyDownloadCompleted,
  dismissDownloadNotification,
  requestNotificationPermissions,
} from './notificationManager';
import { formatSpeed } from '../utils/formatters';

const activeDownloadSessions = new Map<string, FileSystem.DownloadResumable>();

/**
 * Determines whether a given job supports HTTP Range resumable streaming.
 * Direct CDN streams (TikTok, Instagram, Facebook) and progressive audio streams
 * support HTTP 206 Partial Content byte ranges.
 * YouTube video streams currently use live ffmpeg DASH remuxing on the backend,
 * which outputs dynamic unseekable pipe streams (Accept-Ranges: none) until the
 * backend range-caching audit is completed.
 */
export function isResumeSupported(job: Pick<DownloadJob, 'media'>): boolean {
  if (job.media.platform === 'youtube' && job.media.format !== 'mp3') {
    return false;
  }
  return true;
}

export function getActiveDownloadSessionsCount(): number {
  return activeDownloadSessions.size;
}

export function _resetActiveSessionsForTesting(): void {
  activeDownloadSessions.clear();
}

export async function processNextQueuedJob(): Promise<void> {
  const settings = await getSettings();
  const maxConcurrency = Math.max(1, settings.maxConcurrentDownloads || 2);
  if (activeDownloadSessions.size >= maxConcurrency) {
    return;
  }

  const queue = getQueue();
  // Find the earliest job in QUEUED state (queue is ordered newest first, reverse to find oldest)
  const nextJob = queue.slice().reverse().find((j) => j.state === 'QUEUED');
  if (!nextJob) {
    return;
  }

  const safeName = sanitizeFilename(
    nextJob.media.title,
    `ClipSave_${nextJob.media.platform || 'media'}`,
    nextJob.media.format || 'mp4'
  );
  const tempPath = nextJob.tempFilePath || `${DOWNLOADS_TEMP_DIR}${nextJob.id}.tmp`;

  const canResume = isResumeSupported(nextJob) && nextJob.bytesDownloaded > 0;

  updateJobInQueue(nextJob.id, {
    state: 'DOWNLOADING',
    statusMessage: canResume ? 'Resuming media download...' : 'Connecting to media server...',
  });

  executeDownloadStream(nextJob.id, nextJob.media.mediaUrl, tempPath, safeName, canResume);
}

export async function startDownload(media: ResolvedMedia): Promise<string> {
  await ensureTempDirectory();
  // Request media library and notification permissions upfront while user gesture is active
  await ensureMediaLibraryPermissions().catch(() => {});
  requestNotificationPermissions().catch(() => {});

  const settings = await getSettings();
  const maxConcurrency = Math.max(1, settings.maxConcurrentDownloads || 2);
  const isSlotAvailable = activeDownloadSessions.size < maxConcurrency;

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const safeName = sanitizeFilename(
    media.title,
    `ClipSave_${media.platform || 'media'}`,
    media.format || 'mp4'
  );
  const tempPath = `${DOWNLOADS_TEMP_DIR}${jobId}.tmp`;
  const canResume = isResumeSupported({ media });

  const newJob: DownloadJob = {
    id: jobId,
    sourceUrl: media.sourceUrl,
    media,
    state: isSlotAvailable ? 'DOWNLOADING' : 'QUEUED',
    bytesDownloaded: 0,
    totalBytes: media.estimatedSizeBytes ?? undefined,
    statusMessage: isSlotAvailable ? 'Connecting to media server...' : 'Waiting in queue...',
    retryCount: 0,
    supportsResume: canResume,
    tempFilePath: tempPath,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  addJobToQueue(newJob);

  if (isSlotAvailable) {
    executeDownloadStream(jobId, media.mediaUrl, tempPath, safeName, false);
  }
  return jobId;
}

async function finalizeSuccessfulDownload(
  jobId: string,
  tempPath: string,
  safeFilename: string
) {
  activeDownloadSessions.delete(jobId);

  updateJobInQueue(jobId, {
    state: 'FINALIZING',
    statusMessage: 'Saving media to gallery...',
    speedBytesPerSecond: 0,
  });

  const saveResult = await saveCompletedMedia(tempPath, safeFilename, true);

  if (!saveResult.success) {
    dismissDownloadNotification(jobId).catch(() => {});
    updateJobInQueue(jobId, {
      state: 'FAILED',
      statusMessage: 'Save error',
      errorMessage: saveResult.message || 'Could not commit file to storage.',
      isRetryable: false,
    });
    return;
  }

  // Record in history
  const queue = getQueue();
  const currentJob = queue.find((j) => j.id === jobId);

  if (currentJob) {
    await addHistoryItem({
      id: `hist_${jobId}`,
      sourceUrl: currentJob.sourceUrl,
      platform: (currentJob.media.platform as any) || 'generic',
      format: currentJob.media.format,
      quality: currentJob.media.quality,
      title: currentJob.media.title,
      author: currentJob.media.author,
      thumbnailUrl: currentJob.media.thumbnailUrl ?? undefined,
      fileUri: saveResult.finalUri,
      fileSizeBytes: currentJob.bytesDownloaded,
      durationSeconds: currentJob.media.durationSeconds ?? undefined,
      savedAt: new Date().toISOString(),
      fileExists: true,
    });
  }

  notifyDownloadCompleted(jobId, currentJob?.media.title || safeFilename).catch(() => {});

  updateJobInQueue(jobId, {
    state: 'COMPLETED',
    statusMessage: saveResult.savedToGallery ? 'Saved to Gallery' : 'Saved to App Storage',
    finalFileUri: saveResult.finalUri,
    speedBytesPerSecond: 0,
  });

  processNextQueuedJob().catch(() => {});
}

async function executeDownloadStream(
  jobId: string,
  mediaUrl: string,
  tempPath: string,
  safeFilename: string,
  isResume: boolean = false
) {
  try {
    const currentJob = getQueue().find((j) => j.id === jobId);
    const canResume = currentJob ? isResumeSupported(currentJob) : false;

    let resumeOffset = 0;
    if (isResume && canResume) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(tempPath);
        if (fileInfo.exists && !fileInfo.isDirectory && fileInfo.size > 0) {
          resumeOffset = fileInfo.size;
        }
      } catch {
        resumeOffset = 0;
      }
    } else if (!isResume) {
      // Fresh download: clean any stale partial file from a previous aborted attempt
      try {
        await FileSystem.deleteAsync(tempPath, { idempotent: true });
      } catch {
        // Ignore
      }
    }

    updateJobInQueue(jobId, {
      state: 'DOWNLOADING',
      statusMessage: resumeOffset > 0 ? 'Resuming video bytes...' : 'Streaming video bytes...',
      speedBytesPerSecond: 0,
      bytesDownloaded: resumeOffset,
    });

    const estimatedTotal =
      currentJob?.totalBytes && currentJob.totalBytes > 0
        ? currentJob.totalBytes
        : currentJob?.media.estimatedSizeBytes && currentJob.media.estimatedSizeBytes > 0
        ? currentJob.media.estimatedSizeBytes
        : undefined;

    const speedTracker = createSpeedTracker(0.25);
    let lastProgressTime = 0;
    const callback = (data: FileSystem.DownloadProgressData) => {
      const now = Date.now();
      const isComplete =
        data.totalBytesExpectedToWrite > 0 &&
        data.totalBytesWritten >= data.totalBytesExpectedToWrite;

      if (!isComplete && now - lastProgressTime < 150) {
        return;
      }
      lastProgressTime = now;

      const bytesDownloaded = data.totalBytesWritten;
      const speed = speedTracker.update(bytesDownloaded, now);
      const totalBytes =
        data.totalBytesExpectedToWrite > 0
          ? data.totalBytesExpectedToWrite
          : estimatedTotal;

      updateJobInQueue(jobId, {
        bytesDownloaded,
        totalBytes,
        speedBytesPerSecond: speed,
        statusMessage: 'Downloading...',
      });

      const pct = totalBytes && totalBytes > 0 ? (bytesDownloaded / totalBytes) * 100 : 0;
      notifyDownloadProgress(
        jobId,
        currentJob?.media.title || 'Video',
        pct,
        formatSpeed(speed)
      ).catch(() => {});
    };

    notifyDownloadStarted(jobId, currentJob?.media.title || 'Video').catch(() => {});

    // Ensure secure HTTPS URL on Android for remote production domains (preserve HTTP for local IPs)
    let targetUrl = mediaUrl;
    const isLocalNetwork = /^(https?:\/\/)?(127\.0\.0\.1|localhost|10\.\d+|192\.168\.\d+|172\.(1[6-9]|2\d|3[0-1]))(:[0-9]+)?/i.test(targetUrl);
    if (targetUrl.startsWith('http://') && !isLocalNetwork) {
      targetUrl = targetUrl.replace(/^http:\/\//i, 'https://');
    }

    // Proxy endpoints (/v1/stream) already have upstream headers stored on the server.
    // Direct CDN URLs need the extracted TikTok cookies & headers.
    // Also include ngrok bypass header so ngrok tunnels stream seamlessly.
    const isProxyUrl = targetUrl.includes('/v1/stream/');
    const headers: Record<string, string> = {
      ...(isProxyUrl ? {} : (currentJob?.media.httpHeaders || {})),
      'ngrok-skip-browser-warning': 'true',
    };

    let downloadResumable = FileSystem.createDownloadResumable(
      targetUrl,
      tempPath,
      { headers },
      callback,
      resumeOffset > 0 ? String(resumeOffset) : undefined
    );

    activeDownloadSessions.set(jobId, downloadResumable);

    let result: FileSystem.FileSystemDownloadResult | undefined;
    try {
      result = await downloadResumable.downloadAsync();
    } catch (streamErr) {
      console.warn(`Resumable stream download threw for ${jobId}, checking fallback:`, streamErr);
      if (resumeOffset === 0) {
        try {
          result = await FileSystem.downloadAsync(targetUrl, tempPath, { headers });
        } catch (directErr) {
          console.warn(`Direct downloadAsync also failed:`, directErr);
        }
      }
    }

    // Check if job was paused or cancelled while download was in flight
    const jobAfter = getQueue().find((j) => j.id === jobId);
    if (jobAfter?.state === 'PAUSED' || jobAfter?.state === 'CANCELLED') {
      return;
    }

    // Resilient fallback: If proxy stream failed, attempt direct CDN URL
    if (
      (!result || (result.status !== 200 && result.status !== 206)) &&
      currentJob?.media.directMediaUrl &&
      isProxyUrl
    ) {
      const directUrl = currentJob.media.directMediaUrl;
      const directHeaders = currentJob.media.httpHeaders;
      downloadResumable = FileSystem.createDownloadResumable(
        directUrl,
        tempPath,
        directHeaders ? { headers: directHeaders } : {},
        callback,
        resumeOffset > 0 ? String(resumeOffset) : undefined
      );
      activeDownloadSessions.set(jobId, downloadResumable);
      result = await downloadResumable.downloadAsync();
    }

    if (!result || (result.status !== 200 && result.status !== 206)) {
      activeDownloadSessions.delete(jobId);

      let partialBytes = 0;
      try {
        const fileInfo = await FileSystem.getInfoAsync(tempPath);
        if (fileInfo.exists && !fileInfo.isDirectory && fileInfo.size > 0) {
          partialBytes = fileInfo.size;
        }
      } catch {
        partialBytes = 0;
      }

      updateJobInQueue(jobId, {
        state: 'FAILED',
        bytesDownloaded: canResume && partialBytes > 0 ? partialBytes : (currentJob?.bytesDownloaded || 0),
        statusMessage: canResume && partialBytes > 0 ? 'Download interrupted. Tap to resume.' : 'Download failed',
        errorMessage: `Server returned HTTP status ${result?.status ?? 'unknown'}.`,
        isRetryable: true,
        supportsResume: canResume && partialBytes > 0,
      });
      processNextQueuedJob().catch(() => {});
      return;
    }

    await finalizeSuccessfulDownload(jobId, tempPath, safeFilename);
  } catch (err: any) {
    dismissDownloadNotification(jobId).catch(() => {});
    const jobAfterError = getQueue().find((j) => j.id === jobId);
    if (jobAfterError?.state === 'CANCELLED' || jobAfterError?.state === 'PAUSED') {
      return;
    }

    // Attempt direct CDN fallback on network/socket error from proxy
    if (jobAfterError?.media.directMediaUrl && mediaUrl.includes('/v1/stream/')) {
      try {
        const directUrl = jobAfterError.media.directMediaUrl;
        const directHeaders = jobAfterError.media.httpHeaders;
        const fallbackResumable = FileSystem.createDownloadResumable(
          directUrl,
          tempPath,
          directHeaders ? { headers: directHeaders } : {},
          (data) => {
            const fallbackTotal =
              data.totalBytesExpectedToWrite > 0
                ? data.totalBytesExpectedToWrite
                : jobAfterError.totalBytes ?? jobAfterError.media.estimatedSizeBytes;
            updateJobInQueue(jobId, {
              bytesDownloaded: data.totalBytesWritten,
              totalBytes: fallbackTotal,
              statusMessage: 'Downloading...',
            });
          }
        );
        activeDownloadSessions.set(jobId, fallbackResumable);
        const fallbackResult = await fallbackResumable.downloadAsync();
        if (fallbackResult && (fallbackResult.status === 200 || fallbackResult.status === 206)) {
          await finalizeSuccessfulDownload(jobId, tempPath, safeFilename);
          return;
        }
      } catch {
        // Fall through to error handler
      }
    }

    activeDownloadSessions.delete(jobId);

    let savedBytes = 0;
    try {
      const fileInfo = await FileSystem.getInfoAsync(tempPath);
      if (fileInfo.exists && !fileInfo.isDirectory && fileInfo.size > 0) {
        savedBytes = fileInfo.size;
      }
    } catch {
      savedBytes = 0;
    }

    const canResume = jobAfterError ? isResumeSupported(jobAfterError) : false;

    if (!canResume && savedBytes > 0) {
      // For unseekable streams (like live ffmpeg pipe without range support), clear partial corrupt data
      try {
        await FileSystem.deleteAsync(tempPath, { idempotent: true });
      } catch {
        // Ignore
      }
      savedBytes = 0;
    }

    updateJobInQueue(jobId, {
      state: 'FAILED',
      bytesDownloaded: savedBytes > 0 ? savedBytes : (jobAfterError?.bytesDownloaded || 0),
      statusMessage: canResume && savedBytes > 0
        ? 'Connection interrupted. Tap Retry to resume.'
        : 'Download interrupted',
      errorMessage: err?.message || 'Download was interrupted. Please retry.',
      isRetryable: true,
      supportsResume: canResume && savedBytes > 0,
    });
    processNextQueuedJob().catch(() => {});
  }
}

async function executeResumeStream(
  jobId: string,
  session: FileSystem.DownloadResumable,
  tempPath: string,
  safeFilename: string
) {
  try {
    let result: FileSystem.FileSystemDownloadResult | undefined;
    try {
      result = await session.resumeAsync();
    } catch (resumeErr) {
      console.warn(`session.resumeAsync failed for ${jobId}, falling back to reconstructed stream:`, resumeErr);
      const job = getQueue().find((j) => j.id === jobId);
      if (job && isResumeSupported(job)) {
        await executeDownloadStream(jobId, job.media.mediaUrl, tempPath, safeFilename, true);
        return;
      }
      throw resumeErr;
    }

    const jobAfter = getQueue().find((j) => j.id === jobId);
    if (jobAfter?.state === 'PAUSED' || jobAfter?.state === 'CANCELLED') {
      return;
    }

    if (!result || (result.status !== 200 && result.status !== 206)) {
      activeDownloadSessions.delete(jobId);
      updateJobInQueue(jobId, {
        state: 'FAILED',
        statusMessage: 'Download failed',
        errorMessage: `Server returned HTTP status ${result?.status ?? 'unknown'}.`,
        isRetryable: true,
      });
      return;
    }

    await finalizeSuccessfulDownload(jobId, tempPath, safeFilename);
  } catch (err: any) {
    dismissDownloadNotification(jobId).catch(() => {});
    const jobAfterError = getQueue().find((j) => j.id === jobId);
    if (jobAfterError?.state === 'CANCELLED' || jobAfterError?.state === 'PAUSED') {
      return;
    }
    activeDownloadSessions.delete(jobId);
    updateJobInQueue(jobId, {
      state: 'FAILED',
      statusMessage: 'Download error',
      errorMessage: err?.message || 'An unexpected error occurred during resumed download.',
      isRetryable: true,
    });
  }
}

export async function pauseDownload(jobId: string): Promise<boolean> {
  dismissDownloadNotification(jobId).catch(() => {});
  const session = activeDownloadSessions.get(jobId);
  if (!session) return false;

  try {
    updateJobInQueue(jobId, {
      state: 'PAUSED',
      statusMessage: 'Paused by user',
    });
    await session.pauseAsync();
    processNextQueuedJob().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

export async function resumeDownload(jobId: string): Promise<boolean> {
  const job = getQueue().find((j) => j.id === jobId);
  if (!job) return false;

  const session = activeDownloadSessions.get(jobId);
  const safeName = sanitizeFilename(job.media.title);
  const tempPath = job.tempFilePath || `${DOWNLOADS_TEMP_DIR}${jobId}.tmp`;

  if (session) {
    try {
      updateJobInQueue(jobId, {
        state: 'DOWNLOADING',
        statusMessage: 'Resuming download...',
      });
      executeResumeStream(jobId, session, tempPath, safeName);
      return true;
    } catch {
      // Fall through to reconstructed resume
    }
  }

  // Session was not in memory (e.g. app was minimized, backgrounded, or restarted)
  if (isResumeSupported(job)) {
    updateJobInQueue(jobId, {
      state: 'DOWNLOADING',
      statusMessage: 'Resuming download...',
    });
    executeDownloadStream(jobId, job.media.mediaUrl, tempPath, safeName, true);
    return true;
  }

  // Fallback: restart if resume not supported for this media type
  await retryDownload(jobId);
  return true;
}

export async function cancelDownload(jobId: string): Promise<void> {
  dismissDownloadNotification(jobId).catch(() => {});
  const session = activeDownloadSessions.get(jobId);
  if (session) {
    try {
      await session.cancelAsync();
    } catch {
      // Ignore
    }
    activeDownloadSessions.delete(jobId);
  }

  const job = getQueue().find((j) => j.id === jobId);
  if (job?.tempFilePath) {
    try {
      await FileSystem.deleteAsync(job.tempFilePath, { idempotent: true });
    } catch {
      // Ignore
    }
  }

  updateJobInQueue(jobId, {
    state: 'CANCELLED',
    statusMessage: 'Cancelled by user',
  });
  processNextQueuedJob().catch(() => {});
}

export async function removeDownloadJob(jobId: string): Promise<void> {
  dismissDownloadNotification(jobId).catch(() => {});
  const session = activeDownloadSessions.get(jobId);
  if (session) {
    try {
      await session.cancelAsync();
    } catch {
      // Ignore
    }
    activeDownloadSessions.delete(jobId);
  }

  const job = getQueue().find((j) => j.id === jobId);
  if (job?.tempFilePath) {
    try {
      await FileSystem.deleteAsync(job.tempFilePath, { idempotent: true });
    } catch {
      // Ignore
    }
  }

  removeJobFromQueue(jobId);
  processNextQueuedJob().catch(() => {});
}

export async function retryDownload(jobId: string): Promise<void> {
  const job = getQueue().find((j) => j.id === jobId);
  if (!job) return;

  const settings = await getSettings();
  const maxConcurrency = Math.max(1, settings.maxConcurrentDownloads || 2);
  const isSlotAvailable = activeDownloadSessions.size < maxConcurrency;

  const retryCount = (job.retryCount || 0) + 1;
  const safeName = sanitizeFilename(job.media.title);
  const tempPath = job.tempFilePath || `${DOWNLOADS_TEMP_DIR}${jobId}.tmp`;

  const canResume = isResumeSupported(job);
  let preservedBytes = 0;
  if (canResume) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(tempPath);
      if (fileInfo.exists && !fileInfo.isDirectory && fileInfo.size > 0) {
        preservedBytes = fileInfo.size;
      }
    } catch {
      preservedBytes = 0;
    }
  }

  updateJobInQueue(jobId, {
    state: isSlotAvailable ? 'DOWNLOADING' : 'QUEUED',
    statusMessage: isSlotAvailable
      ? preservedBytes > 0
        ? `Resuming (attempt ${retryCount})...`
        : `Retrying (attempt ${retryCount})...`
      : 'Waiting in queue...',
    errorMessage: undefined,
    retryCount,
    bytesDownloaded: preservedBytes,
    supportsResume: canResume && preservedBytes > 0,
  });

  if (isSlotAvailable) {
    executeDownloadStream(jobId, job.media.mediaUrl, tempPath, safeName, preservedBytes > 0);
  }
}

// Auto-reconnect backgrounded downloads when app returns to foreground
if (typeof AppState?.addEventListener === 'function') {
  AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      const queue = getQueue();
      // Look for active downloading jobs whose network connection dropped while backgrounded
      const droppedJobs = queue.filter(
        (j) => j.state === 'DOWNLOADING' && !activeDownloadSessions.has(j.id)
      );
      for (const dropped of droppedJobs) {
        resumeDownload(dropped.id).catch(() => {});
      }
    }
  });
}
