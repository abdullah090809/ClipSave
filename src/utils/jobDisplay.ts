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

/** 0..1 when the total size is known, otherwise undefined (indeterminate). */
export function jobProgressFraction(job: DownloadJob): number | undefined {
  if (!job.totalBytes || job.totalBytes <= 0) return undefined;
  return Math.min(Math.max(job.bytesDownloaded / job.totalBytes, 0), 1);
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

/** Real byte counts only: never invents a total or a percentage. */
export function jobProgressDetail(job: DownloadJob): string {
  const fraction = jobProgressFraction(job);
  if (fraction === undefined) {
    return `${formatBytes(job.bytesDownloaded)} received`;
  }
  return `${formatBytes(job.bytesDownloaded)} of ${formatBytes(job.totalBytes)} · ${Math.round(fraction * 100)}%`;
}

/** Changes only when something other than byte progress changes. */
export function jobStructureKey(job: DownloadJob): string {
  return [job.id, job.state, job.retryCount, job.errorMessage ?? '', job.finalFileUri ?? ''].join(':');
}
