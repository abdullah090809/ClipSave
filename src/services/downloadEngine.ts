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
import {
  ensureTempDirectory,
  saveCompletedMedia,
  DOWNLOADS_TEMP_DIR,
} from './mediaManager';

const activeDownloadSessions = new Map<string, FileSystem.DownloadResumable>();

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

  const safeName = sanitizeFilename(nextJob.media.title);
  const tempPath = nextJob.tempFilePath || `${DOWNLOADS_TEMP_DIR}${nextJob.id}.tmp`;

  updateJobInQueue(nextJob.id, {
    state: 'DOWNLOADING',
    statusMessage: 'Connecting to media server...',
  });

  executeDownloadStream(nextJob.id, nextJob.media.mediaUrl, tempPath, safeName);
}

export async function startDownload(media: ResolvedMedia): Promise<string> {
  await ensureTempDirectory();

  const settings = await getSettings();
  const maxConcurrency = Math.max(1, settings.maxConcurrentDownloads || 2);
  const isSlotAvailable = activeDownloadSessions.size < maxConcurrency;

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const safeName = sanitizeFilename(media.title);
  const tempPath = `${DOWNLOADS_TEMP_DIR}${jobId}.tmp`;

  const newJob: DownloadJob = {
    id: jobId,
    sourceUrl: media.sourceUrl,
    media,
    state: isSlotAvailable ? 'DOWNLOADING' : 'QUEUED',
    bytesDownloaded: 0,
    totalBytes: media.estimatedSizeBytes ?? undefined,
    statusMessage: isSlotAvailable ? 'Connecting to media server...' : 'Waiting in queue...',
    retryCount: 0,
    supportsResume: false,
    tempFilePath: tempPath,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  addJobToQueue(newJob);

  if (isSlotAvailable) {
    executeDownloadStream(jobId, media.mediaUrl, tempPath, safeName);
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
  });

  const saveResult = await saveCompletedMedia(tempPath, safeFilename, true);

  if (!saveResult.success) {
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

  updateJobInQueue(jobId, {
    state: 'COMPLETED',
    statusMessage: saveResult.savedToGallery ? 'Saved to Gallery' : 'Saved to App Storage',
    finalFileUri: saveResult.finalUri,
  });

  processNextQueuedJob().catch(() => {});
}

async function executeDownloadStream(
  jobId: string,
  mediaUrl: string,
  tempPath: string,
  safeFilename: string
) {
  try {
    updateJobInQueue(jobId, {
      state: 'DOWNLOADING',
      statusMessage: 'Streaming video bytes...',
    });

    let lastProgressTime = 0;
    const callback = (data: FileSystem.DownloadProgressData) => {
      const now = Date.now();
      const isComplete =
        data.totalBytesExpectedToWrite > 0 &&
        data.totalBytesWritten >= data.totalBytesExpectedToWrite;

      if (!isComplete && now - lastProgressTime < 120) {
        return;
      }
      lastProgressTime = now;

      const bytesDownloaded = data.totalBytesWritten;
      const totalBytes =
        data.totalBytesExpectedToWrite > 0
          ? data.totalBytesExpectedToWrite
          : undefined;

      updateJobInQueue(jobId, {
        bytesDownloaded,
        totalBytes,
        statusMessage: totalBytes
          ? `Downloading...`
          : `Downloading (stream)...`,
      });
    };

    const currentJob = getQueue().find((j) => j.id === jobId);
    const headers = currentJob?.media.httpHeaders;

    const downloadResumable = FileSystem.createDownloadResumable(
      mediaUrl,
      tempPath,
      headers ? { headers } : {},
      callback
    );

    activeDownloadSessions.set(jobId, downloadResumable);

    const result = await downloadResumable.downloadAsync();

    // Check if job was paused or cancelled while download was in flight
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
      processNextQueuedJob().catch(() => {});
      return;
    }

    await finalizeSuccessfulDownload(jobId, tempPath, safeFilename);
  } catch (err: any) {
    const jobAfterError = getQueue().find((j) => j.id === jobId);
    if (jobAfterError?.state === 'CANCELLED' || jobAfterError?.state === 'PAUSED') {
      return;
    }
    activeDownloadSessions.delete(jobId);
    updateJobInQueue(jobId, {
      state: 'FAILED',
      statusMessage: 'Download error',
      errorMessage: err?.message || 'An unexpected error occurred during download.',
      isRetryable: true,
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
    const result = await session.resumeAsync();

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
  const session = activeDownloadSessions.get(jobId);
  if (!session) return false;

  const job = getQueue().find((j) => j.id === jobId);
  if (!job) return false;

  try {
    updateJobInQueue(jobId, {
      state: 'DOWNLOADING',
      statusMessage: 'Resuming download...',
    });
    const safeName = sanitizeFilename(job.media.title);
    const tempPath = job.tempFilePath || `${DOWNLOADS_TEMP_DIR}${jobId}.tmp`;
    executeResumeStream(jobId, session, tempPath, safeName);
    return true;
  } catch {
    return false;
  }
}

export async function cancelDownload(jobId: string): Promise<void> {
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

  updateJobInQueue(jobId, {
    state: isSlotAvailable ? 'DOWNLOADING' : 'QUEUED',
    statusMessage: isSlotAvailable ? `Retrying (attempt ${retryCount})...` : 'Waiting in queue...',
    errorMessage: undefined,
    retryCount,
    bytesDownloaded: 0,
  });

  if (isSlotAvailable) {
    executeDownloadStream(jobId, job.media.mediaUrl, tempPath, safeName);
  }
}
