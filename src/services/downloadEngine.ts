import * as FileSystem from 'expo-file-system/legacy';
import { DownloadJob, ResolvedMedia } from '../types';
import {
  addJobToQueue,
  updateJobInQueue,
  getQueue,
} from '../storage/queueStore';
import { addHistoryItem } from '../storage/historyStore';
import { sanitizeFilename } from '../utils/filenameSanitizer';
import {
  ensureTempDirectory,
  saveCompletedMedia,
  DOWNLOADS_TEMP_DIR,
} from './mediaManager';

const activeDownloadSessions = new Map<string, FileSystem.DownloadResumable>();

export async function startDownload(media: ResolvedMedia): Promise<string> {
  await ensureTempDirectory();

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const safeName = sanitizeFilename(media.title);
  const tempPath = `${DOWNLOADS_TEMP_DIR}${jobId}.tmp`;

  const newJob: DownloadJob = {
    id: jobId,
    sourceUrl: media.sourceUrl,
    media,
    state: 'DOWNLOADING',
    bytesDownloaded: 0,
    totalBytes: media.estimatedSizeBytes ?? undefined,
    statusMessage: 'Connecting to media server...',
    retryCount: 0,
    supportsResume: false,
    tempFilePath: tempPath,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  addJobToQueue(newJob);

  executeDownloadStream(jobId, media.mediaUrl, tempPath, safeName);
  return jobId;
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

    const callback = (data: FileSystem.DownloadProgressData) => {
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

    const downloadResumable = FileSystem.createDownloadResumable(
      mediaUrl,
      tempPath,
      {},
      callback
    );

    activeDownloadSessions.set(jobId, downloadResumable);

    const result = await downloadResumable.downloadAsync();
    activeDownloadSessions.delete(jobId);

    if (!result || (result.status !== 200 && result.status !== 206)) {
      updateJobInQueue(jobId, {
        state: 'FAILED',
        statusMessage: 'Download failed',
        errorMessage: `Server returned HTTP status ${result?.status ?? 'unknown'}.`,
        isRetryable: true,
      });
      return;
    }

    // Finalize
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
  } catch (err: any) {
    activeDownloadSessions.delete(jobId);
    updateJobInQueue(jobId, {
      state: 'FAILED',
      statusMessage: 'Download error',
      errorMessage: err?.message || 'An unexpected error occurred during download.',
      isRetryable: true,
    });
  }
}

export async function pauseDownload(jobId: string): Promise<boolean> {
  const session = activeDownloadSessions.get(jobId);
  if (!session) return false;

  try {
    await session.pauseAsync();
    updateJobInQueue(jobId, {
      state: 'PAUSED',
      statusMessage: 'Paused by user',
    });
    return true;
  } catch {
    return false;
  }
}

export async function resumeDownload(jobId: string): Promise<boolean> {
  const session = activeDownloadSessions.get(jobId);
  if (!session) return false;

  try {
    updateJobInQueue(jobId, {
      state: 'DOWNLOADING',
      statusMessage: 'Resuming download...',
    });
    session.resumeAsync();
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
}

export async function retryDownload(jobId: string): Promise<void> {
  const job = getQueue().find((j) => j.id === jobId);
  if (!job) return;

  const retryCount = (job.retryCount || 0) + 1;
  const safeName = sanitizeFilename(job.media.title);
  const tempPath = job.tempFilePath || `${DOWNLOADS_TEMP_DIR}${jobId}.tmp`;

  updateJobInQueue(jobId, {
    state: 'DOWNLOADING',
    statusMessage: `Retrying (attempt ${retryCount})...`,
    errorMessage: undefined,
    retryCount,
    bytesDownloaded: 0,
  });

  executeDownloadStream(jobId, job.media.mediaUrl, tempPath, safeName);
}
