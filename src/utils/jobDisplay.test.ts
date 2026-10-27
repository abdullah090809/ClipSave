import {
  jobBucket,
  jobProgressDetail,
  jobProgressFraction,
  jobStatusLabel,
  jobStructureKey,
} from './jobDisplay';
import { DownloadJob, DownloadState } from '../types';

const make = (over: Partial<DownloadJob> = {}): DownloadJob => ({
  id: 'j1',
  sourceUrl: 'https://www.tiktok.com/@a/video/1',
  media: {
    id: 'm1',
    sourceUrl: 'https://www.tiktok.com/@a/video/1',
    title: 'T',
    author: 'A',
    mediaUrl: 'https://example.com/v.mp4',
    format: 'mp4',
    isCleanSourceVerified: false,
  },
  state: 'DOWNLOADING',
  bytesDownloaded: 0,
  statusMessage: '',
  retryCount: 0,
  supportsResume: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('jobDisplay', () => {
  test('buckets every state exactly once', () => {
    const expected: Record<DownloadState, string> = {
      QUEUED: 'active',
      RESOLVING: 'active',
      READY: 'active',
      DOWNLOADING: 'active',
      PAUSED: 'active',
      FINALIZING: 'active',
      COMPLETED: 'done',
      FAILED: 'failed',
      CANCELLED: 'failed',
    };
    (Object.keys(expected) as DownloadState[]).forEach((s) =>
      expect(jobBucket(make({ state: s }))).toBe(expected[s])
    );
  });

  test('progress fraction is undefined without a known total and is clamped', () => {
    expect(jobProgressFraction(make({ bytesDownloaded: 500 }))).toBeUndefined();
    expect(jobProgressFraction(make({ bytesDownloaded: 500, totalBytes: 1000 }))).toBe(0.5);
    expect(jobProgressFraction(make({ bytesDownloaded: 5000, totalBytes: 1000 }))).toBe(1);
  });

  test('detail text uses real bytes only', () => {
    expect(jobProgressDetail(make({ bytesDownloaded: 1024 }))).toBe('1 KB received');
    expect(jobProgressDetail(make({ bytesDownloaded: 1024 * 1024, totalBytes: 4 * 1024 * 1024 }))).toBe(
      '1 MB of 4 MB · 25%'
    );
  });

  test('status labels', () => {
    expect(jobStatusLabel(make({ state: 'PAUSED' }))).toBe('Paused');
    expect(jobStatusLabel(make({ state: 'CANCELLED' }))).toBe('Cancelled');
    expect(jobStatusLabel(make({ state: 'COMPLETED' }))).toBe('Saved');
  });

  test('structure key ignores byte progress but reacts to state and errors', () => {
    const a = make({ bytesDownloaded: 10 });
    expect(jobStructureKey(a)).toBe(jobStructureKey(make({ bytesDownloaded: 9999, statusMessage: 'x' })));
    expect(jobStructureKey(a)).not.toBe(jobStructureKey(make({ state: 'PAUSED' })));
    expect(jobStructureKey(a)).not.toBe(jobStructureKey(make({ errorMessage: 'boom' })));
    expect(jobStructureKey(a)).not.toBe(jobStructureKey(make({ retryCount: 1 })));
  });
});
