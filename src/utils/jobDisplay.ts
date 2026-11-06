import { DownloadJob } from '../types';
import { formatBytes } from './formatters';

export type JobBucket = 'active' | 'failed' | 'done';

export function jobBucket(job: DownloadJob): JobBucket {
  switch (job.state) {
    case 'COMPLETED':
      return 'done';
    case 'FAILED':
    case 'CANCELLED':
      return 'failed';
    default:
      return 'active';
  }
}

/** 0..1 when the total size (or estimated size) is known, otherwise undefined (indeterminate). */
export function jobProgressFraction(job: DownloadJob): number | undefined {
  if (job.state === 'COMPLETED') {
    return 1;
  }

  const total =
    job.totalBytes && job.totalBytes > 0
      ? job.totalBytes
      : job.media?.estimatedSizeBytes && job.media.estimatedSizeBytes > 0
      ? job.media.estimatedSizeBytes
      : undefined;

  if (!total || total <= 0) return undefined;

  const fraction = job.bytesDownloaded / total;
  // If totalBytes is explicitly set, clamp to 1. If only estimatedSizeBytes is known, cap at 0.98 until COMPLETED.
  const hasExactTotal = Boolean(job.totalBytes && job.totalBytes > 0);
  return Math.min(Math.max(fraction, 0), hasExactTotal ? 1 : 0.98);
}

export function jobStatusLabel(job: DownloadJob): string {
  switch (job.state) {
    case 'DOWNLOADING':
      return 'Downloading';
    case 'PAUSED':
      return 'Paused';
    case 'FINALIZING':
      return 'Saving';
    case 'QUEUED':
    case 'RESOLVING':
    case 'READY':
      return 'Waiting';
    case 'COMPLETED':
      return 'Saved';
    case 'CANCELLED':
      return 'Cancelled';
    case 'FAILED':
    default:
      return 'Failed';
  }
}

/** Real byte counts or estimated total: formats byte progress cleanly. */
export function jobProgressDetail(job: DownloadJob): string {
  const fraction = jobProgressFraction(job);
  const total =
    job.totalBytes && job.totalBytes > 0
      ? job.totalBytes
      : job.media?.estimatedSizeBytes && job.media.estimatedSizeBytes > 0
      ? job.media.estimatedSizeBytes
      : undefined;

  if (fraction === undefined || !total) {
    return `${formatBytes(job.bytesDownloaded)} received`;
  }
  return `${formatBytes(job.bytesDownloaded)} of ${formatBytes(total)} · ${Math.round(fraction * 100)}%`;
}

/** Changes only when something other than byte progress changes. */
export function jobStructureKey(job: DownloadJob): string {
  return [job.id, job.state, job.retryCount, job.errorMessage ?? '', job.finalFileUri ?? ''].join(':');
}
