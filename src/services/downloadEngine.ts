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
import { formatBytes, formatSpeed } from '../utils/formatters';

const activeDownloadSessions = new Map<string, FileSystem.DownloadResumable>();

/**
 * Determines whether a given job supports HTTP Range resumable streaming.
 * Direct CDN streams (TikTok, Instagram, Facebook) and progressive audio streams
 * support HTTP 206 Partial Content byte ranges.
 *
 * YouTube video streams are composite (video + audio remuxed by the backend). While the
 * backend is still remuxing, it computes Range lengths from an ESTIMATED file size, so a
 * resume can promise more/fewer bytes than the real file and the connection dies with
 * "peer closed connection without sending complete message body". The next retry then gets
 * HTTP 416 and wipes a file that was actually complete. Until the backend serves exact
 * ranges, YouTube video restarts from byte 0 (cheap: the backend serves it from its cache).
 */
export function isResumeSupported(job: Pick<DownloadJob, 'media'>): boolean {
  if (job.media.platform === 'youtube' && job.media.format !== 'mp3') {
    // Streams fetched directly from YouTube on the phone are written piece by piece, in order, so they
    // can continue from the bytes already on disk. Anything that went through the old backend cannot.
    return /googlevideo\.com/i.test(String(job.media.mediaUrl ?? ''));
  }
  return true;
}

/** Part files an on-device YouTube download can leave behind (single file, or HD video + audio). */
function youTubePartPaths(tempPath: string): string[] {
  return [tempPath, `${tempPath}.video`, `${tempPath}.audio`];
}

async function deleteYouTubeParts(tempPath: string): Promise<void> {
  for (const path of youTubePartPaths(tempPath)) {
    try {
      await FileSystem.deleteAsync(path, { idempotent: true });
    } catch {
      // Ignore
    }
  }
}

/** Bytes already saved by an earlier attempt, across all part files. */
async function youTubePreservedBytes(tempPath: string): Promise<number> {
  let sum = 0;
  for (const path of youTubePartPaths(tempPath)) {
    try {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists && !info.isDirectory && info.size > 0) sum += info.size;
    } catch {
      // Ignore
    }
  }
  return sum;
}

/** Old stream links expire after a few hours, so a resumed download asks for fresh ones first. */
async function freshYouTubeUrl(jobId: string, part: 'video' | 'audio', fallback: string): Promise<string> {
  try {
    const fresh = await makeYouTubeUrlRefresher(jobId, part)();
    return fresh || fallback;
  } catch {
    return fallback;
  }
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

/**
 * YouTube sometimes refuses pieces for about a minute after a burst of downloading. The chunked
 * downloader waits and retries; these two helpers keep the user informed and fetch a fresh stream
 * URL (same quality) when the old one may have gone stale.
 */
function youTubeWaitNotice(jobId: string) {
  return ({ waitedMs }: { waitedMs: number; status: number }) => {
    const secs = Math.round(waitedMs / 1000);
    updateJobInQueue(jobId, {
      statusMessage:
        secs < 5
          ? 'YouTube paused the download. Resuming automatically...'
          : `YouTube paused the download. Still waiting (${secs}s)...`,
      speedBytesPerSecond: 0,
    });
  };
}

function makeYouTubeUrlRefresher(jobId: string, part: 'video' | 'audio') {
  return async (): Promise<string | undefined> => {
    const job = getQueue().find((j) => j.id === jobId);
    if (!job) return undefined;
    const { resolveYouTubeOnDevice } = await import('./youtubeLocal');
    const fresh = await resolveYouTubeOnDevice(job.media.sourceUrl);
    const option = fresh.availableFormats?.find((f) => f.quality === job.media.quality);
    if (!option) return undefined;
    return part === 'audio' ? option.audioUrl ?? option.mediaUrl : option.mediaUrl;
  };
}

async function runYouTubeChunkedDownload(
  jobId: string,
  mediaUrl: string,
  tempPath: string,
  safeFilename: string,
  headers: Record<string, string>,
  estimatedTotal: number | undefined,
  onProgress: (data: FileSystem.DownloadProgressData) => void,
  isResume: boolean = false
): Promise<void> {
  let stopped = false;
  const stopper = {
    cancelAsync: async () => {
      stopped = true;
    },
    pauseAsync: async () => {
      stopped = true;
    },
  };
  activeDownloadSessions.set(jobId, stopper as unknown as FileSystem.DownloadResumable);

  const stoppedByUser = () => {
    const state = getQueue().find((j) => j.id === jobId)?.state;
    return stopped || state === 'CANCELLED' || state === 'PAUSED';
  };

  try {
    const { downloadYouTubeChunked } = await import('./youtubeChunkedDownload');
    const streamUrl = isResume ? await freshYouTubeUrl(jobId, 'video', mediaUrl) : mediaUrl;
    await downloadYouTubeChunked({
      url: streamUrl,
      headers,
      destUri: tempPath,
      totalBytes: estimatedTotal,
      resume: isResume,
      shouldStop: () => stopped,
      onWaiting: youTubeWaitNotice(jobId),
      refreshUrl: makeYouTubeUrlRefresher(jobId, 'video'),
      onProgress: (written, total) =>
        onProgress({
          totalBytesWritten: written,
          totalBytesExpectedToWrite: total ?? -1,
        } as FileSystem.DownloadProgressData),
    });
  } catch (err: any) {
    activeDownloadSessions.delete(jobId);
    dismissDownloadNotification(jobId).catch(() => {});
    if (stoppedByUser()) {
      return;
    }
    // The bytes already saved are good, so keep them: Retry continues from there.
    updateJobInQueue(jobId, {
      state: 'FAILED',
      statusMessage: 'Download failed',
      errorMessage: err?.message || 'Download was interrupted. Please retry.',
      isRetryable: true,
      supportsResume: true,
    });
    processNextQueuedJob().catch(() => {});
    return;
  }

  if (stoppedByUser()) {
    activeDownloadSessions.delete(jobId);
    return;
  }
  await finalizeSuccessfulDownload(jobId, tempPath, safeFilename);
}

/**
 * YouTube HD: downloads the video-only and audio-only streams in ranged pieces into two part
 * files, joins them into one MP4 with the native muxer (no re-encoding), then saves it.
 */
async function runYouTubeAdaptiveDownload(
  jobId: string,
  videoUrl: string,
  audioUrl: string,
  tempPath: string,
  safeFilename: string,
  headers: Record<string, string>,
  onProgress: (data: FileSystem.DownloadProgressData) => void,
  isResume: boolean = false
): Promise<void> {
  const videoPart = `${tempPath}.video`;
  const audioPart = `${tempPath}.audio`;
  let stopped = false;
  const stopper = {
    cancelAsync: async () => {
      stopped = true;
    },
    pauseAsync: async () => {
      stopped = true;
    },
  };
  activeDownloadSessions.set(jobId, stopper as unknown as FileSystem.DownloadResumable);

  const stoppedByUser = () => {
    const state = getQueue().find((j) => j.id === jobId)?.state;
    return stopped || state === 'CANCELLED' || state === 'PAUSED';
  };
  const removeParts = async () => {
    for (const path of [videoPart, audioPart]) {
      try {
        await FileSystem.deleteAsync(path, { idempotent: true });
      } catch {
        // Ignore
      }
    }
  };

  let phase: 'download' | 'join' = 'download';
  try {
    const { downloadYouTubeChunked, parseContentLengthParam } = await import('./youtubeChunkedDownload');
    if (isResume) {
      // The links saved with the job may have expired while it was paused.
      videoUrl = await freshYouTubeUrl(jobId, 'video', videoUrl);
      audioUrl = await freshYouTubeUrl(jobId, 'audio', audioUrl);
    }
    const videoTotal = parseContentLengthParam(videoUrl);
    const audioTotal = parseContentLengthParam(audioUrl);
    const grandTotal = videoTotal !== undefined && audioTotal !== undefined ? videoTotal + audioTotal : undefined;

    // The video, the audio and the joined file exist side by side for a moment.
    if (grandTotal !== undefined && typeof (FileSystem as any).getFreeDiskStorageAsync === 'function') {
      try {
        const free: number = await (FileSystem as any).getFreeDiskStorageAsync();
        const needed = Math.ceil(grandTotal * 2.1);
        if (Number.isFinite(free) && free > 0 && free < needed) {
          throw new Error(
            `Not enough free storage. This download needs about ${formatBytes(needed)} free while it is being joined (you have ${formatBytes(free)}). Free some space or pick a lower quality.`
          );
        }
      } catch (storageErr: any) {
        if (/Not enough free storage/.test(storageErr?.message || '')) throw storageErr;
        // Could not read free space: carry on.
      }
    }

    // Audio first: it is small (about 30 MB), and YouTube tends to start pausing us after a lot of
    // video has been fetched, so the audio should not be left for the end.
    const audioBytes = await downloadYouTubeChunked({
      url: audioUrl,
      headers,
      destUri: audioPart,
      totalBytes: audioTotal,
      resume: isResume,
      shouldStop: () => stopped,
      onWaiting: youTubeWaitNotice(jobId),
      refreshUrl: makeYouTubeUrlRefresher(jobId, 'audio'),
      onProgress: (written) =>
        onProgress({
          totalBytesWritten: written,
          totalBytesExpectedToWrite: grandTotal ?? -1,
        } as FileSystem.DownloadProgressData),
    });
    await downloadYouTubeChunked({
      url: videoUrl,
      headers,
      destUri: videoPart,
      totalBytes: videoTotal,
      resume: isResume,
      shouldStop: () => stopped,
      onWaiting: youTubeWaitNotice(jobId),
      refreshUrl: makeYouTubeUrlRefresher(jobId, 'video'),
      onProgress: (written) =>
        onProgress({
          totalBytesWritten: audioBytes + written,
          totalBytesExpectedToWrite: grandTotal ?? -1,
        } as FileSystem.DownloadProgressData),
    });

    if (stoppedByUser()) {
      // Paused (keep the parts) or cancelled (cancelDownload deletes them).
      activeDownloadSessions.delete(jobId);
      return;
    }

    phase = 'join';
    updateJobInQueue(jobId, {
      state: 'FINALIZING',
      statusMessage: 'Joining video and sound...',
      speedBytesPerSecond: 0,
    });
    const { muxVideoAndAudio } = await import('./videoMuxer');
    await muxVideoAndAudio(videoPart, audioPart, tempPath);
    await removeParts();
  } catch (err: any) {
    activeDownloadSessions.delete(jobId);
    dismissDownloadNotification(jobId).catch(() => {});
    // Pause, cancel and download errors keep the part files so the download can continue;
    // only a failed join throws them away (cancel and remove delete them separately).
    if (phase === 'join') await removeParts();
    if (stoppedByUser()) {
      return;
    }
    try {
      await FileSystem.deleteAsync(tempPath, { idempotent: true });
    } catch {
      // Ignore
    }
    const detail = err?.message || 'Download was interrupted. Please retry.';
    updateJobInQueue(jobId, {
      state: 'FAILED',
      statusMessage: phase === 'join' ? 'Could not join video and sound' : 'Download failed',
      errorMessage: phase === 'join' ? `Could not join video and sound: ${detail}` : detail,
      isRetryable: true,
      supportsResume: phase === 'download',
    });
    processNextQueuedJob().catch(() => {});
    return;
  }

  if (stoppedByUser()) {
    activeDownloadSessions.delete(jobId);
    return;
  }
  await finalizeSuccessfulDownload(jobId, tempPath, safeFilename);
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

    const isYouTubeDirect =
      currentJob?.media.platform === 'youtube' && /googlevideo\.com/i.test(mediaUrl);

    let resumeOffset = 0;
    if (isResume && canResume) {
      try {
        if (isYouTubeDirect) {
          // HD downloads keep two part files, so count both.
          resumeOffset = await youTubePreservedBytes(tempPath);
        } else {
          const fileInfo = await FileSystem.getInfoAsync(tempPath);
          if (fileInfo.exists && !fileInfo.isDirectory && fileInfo.size > 0) {
            resumeOffset = fileInfo.size;
          }
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

    // YouTube HD: separate video + audio streams, downloaded in pieces and joined on the phone.
    if (currentJob?.media.platform === 'youtube' && currentJob.media.audioUrl && /googlevideo\.com/i.test(mediaUrl)) {
      await runYouTubeAdaptiveDownload(
        jobId,
        mediaUrl,
        currentJob.media.audioUrl,
        tempPath,
        safeFilename,
        currentJob.media.httpHeaders || {},
        callback,
        isResume && canResume
      );
      return;
    }

    // YouTube direct streams are fetched in small ranged pieces; one big request gets refused or throttled.
    if (currentJob?.media.platform === 'youtube' && /googlevideo\.com/i.test(mediaUrl)) {
      await runYouTubeChunkedDownload(
        jobId,
        mediaUrl,
        tempPath,
        safeFilename,
        currentJob.media.httpHeaders || {},
        estimatedTotal,
        callback,
        isResume && canResume
      );
      return;
    }

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

      // If server returned 416 Range Not Satisfiable, server cache lacks the offset.
      // Reset partial bytes so the next retry restarts cleanly from 0% without looping!
      if (result?.status === 416) {
        try {
          await FileSystem.deleteAsync(tempPath, { idempotent: true });
        } catch {
          // Ignore
        }
      }

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

  if (job.media.platform === 'youtube' && job.media.format !== 'mp3' && isResumeSupported(job)) {
    updateJobInQueue(jobId, {
      state: 'DOWNLOADING',
      statusMessage: 'Resuming download...',
    });
    // Let the paused download finish writing its last piece first, so two writers never touch one file.
    for (let i = 0; i < 240 && activeDownloadSessions.has(jobId); i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    executeDownloadStream(jobId, job.media.mediaUrl, tempPath, safeName, true);
    return true;
  }

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
    await deleteYouTubeParts(job.tempFilePath);
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
    await deleteYouTubeParts(job.tempFilePath);
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
      if (job.media.platform === 'youtube' && job.media.format !== 'mp3') {
        preservedBytes = await youTubePreservedBytes(tempPath);
      } else {
        const fileInfo = await FileSystem.getInfoAsync(tempPath);
        if (fileInfo.exists && !fileInfo.isDirectory && fileInfo.size > 0) {
          preservedBytes = fileInfo.size;
        }
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
