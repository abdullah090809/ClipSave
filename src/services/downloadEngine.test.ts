import {
  startDownload,
  pauseDownload,
  resumeDownload,
  cancelDownload,
  retryDownload,
  removeDownloadJob,
  getActiveDownloadSessionsCount,
} from './downloadEngine';
import { getQueue, clearTerminalJobs } from '../storage/queueStore';
import { getHistory } from '../storage/historyStore';
import { ResolvedMedia } from '../types';
import * as FileSystem from 'expo-file-system/legacy';
import * as mediaManager from './mediaManager';

const sampleMedia: ResolvedMedia = {
  id: 'test_vid_001',
  sourceUrl: 'https://www.tiktok.com/@creator/video/1234567890',
  title: 'Sample Dance Video',
  author: 'DanceMaster',
  authorUsername: '@dancemaster',
  durationSeconds: 15.5,
  thumbnailUrl: 'https://example.com/thumb.jpg',
  mediaUrl: 'https://cdn.example.com/stream.mp4',
  estimatedSizeBytes: 4500000,
  format: 'mp4',
  isCleanSourceVerified: true,
};

describe('downloadEngine', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await clearTerminalJobs();
  });

  test('UT-DL-01: startDownload creates job and completes successfully', async () => {
    const jobId = await startDownload(sampleMedia);
    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');

    // Wait for async stream execution
    await new Promise((r) => setTimeout(r, 50));

    const queue = getQueue();
    const job = queue.find((j) => j.id === jobId);
    expect(job).toBeDefined();
    expect(job?.state).toBe('COMPLETED');
    expect(job?.statusMessage).toContain('Saved');

    // Verify history was recorded
    const history = await getHistory();
    const histItem = history.find((h) => h.id === `hist_${jobId}`);
    expect(histItem).toBeDefined();
    expect(histItem?.title).toBe(sampleMedia.title);

    // Verify session cleaned from active map
    expect(getActiveDownloadSessionsCount()).toBe(0);
  });

  test('UT-DL-02: pauseDownload transitions active session to PAUSED', async () => {
    let pauseCallback: (() => void) | null = null;
    const mockPause = jest.fn(async () => {});
    const mockDownload = jest.fn(
      () =>
        new Promise((resolve) => {
          pauseCallback = () => resolve(undefined as any);
        })
    );

    (FileSystem.createDownloadResumable as jest.Mock).mockReturnValueOnce({
      downloadAsync: mockDownload,
      pauseAsync: async () => {
        await mockPause();
        if (pauseCallback) (pauseCallback as any)();
      },
      resumeAsync: jest.fn(),
      cancelAsync: jest.fn(),
    });

    const jobId = await startDownload(sampleMedia);
    const queue = getQueue();
    expect(queue.find((j) => j.id === jobId)?.state).toBe('DOWNLOADING');

    const paused = await pauseDownload(jobId);
    expect(paused).toBe(true);

    const updatedJob = getQueue().find((j) => j.id === jobId);
    expect(updatedJob?.state).toBe('PAUSED');
    expect(mockPause).toHaveBeenCalledTimes(1);
  });

  test('UT-DL-03: resumeDownload resumes paused download session to COMPLETED', async () => {
    let pauseCallback: (() => void) | null = null;
    const mockResume = jest.fn(async () => ({
      status: 200,
      uri: 'file:///mock/resumed.mp4',
      totalBytesWritten: 4500000,
    }));

    (FileSystem.createDownloadResumable as jest.Mock).mockReturnValueOnce({
      downloadAsync: jest.fn(
        () =>
          new Promise((resolve) => {
            pauseCallback = () => resolve(undefined as any);
          })
      ),
      pauseAsync: jest.fn(async () => {
        if (pauseCallback) (pauseCallback as any)();
      }),
      resumeAsync: mockResume,
      cancelAsync: jest.fn(),
    });

    const jobId = await startDownload(sampleMedia);
    await pauseDownload(jobId);

    const resumed = await resumeDownload(jobId);
    expect(resumed).toBe(true);

    await new Promise((r) => setTimeout(r, 50));

    const finalJob = getQueue().find((j) => j.id === jobId);
    expect(finalJob?.state).toBe('COMPLETED');
    expect(mockResume).toHaveBeenCalledTimes(1);
  });

  test('UT-DL-04: cancelDownload terminates session and cleans temp file', async () => {
    const mockCancel = jest.fn(async () => {});
    (FileSystem.createDownloadResumable as jest.Mock).mockReturnValueOnce({
      downloadAsync: () => new Promise(() => {}), // Keep pending
      pauseAsync: jest.fn(),
      resumeAsync: jest.fn(),
      cancelAsync: mockCancel,
    });

    const jobId = await startDownload(sampleMedia);
    await cancelDownload(jobId);

    const cancelledJob = getQueue().find((j) => j.id === jobId);
    expect(cancelledJob?.state).toBe('CANCELLED');
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(FileSystem.deleteAsync).toHaveBeenCalled();
  });

  test('UT-DL-05: retryDownload increments retry count and restarts stream', async () => {
    const jobId = await startDownload(sampleMedia);
    await new Promise((r) => setTimeout(r, 50));

    // Simulate retrying
    await retryDownload(jobId);
    await new Promise((r) => setTimeout(r, 50));

    const retriedJob = getQueue().find((j) => j.id === jobId);
    expect(retriedJob?.retryCount).toBe(1);
    expect(retriedJob?.state).toBe('COMPLETED');
  });

  test('UT-DL-06: server HTTP error sets state to FAILED with retryable flag', async () => {
    (FileSystem.createDownloadResumable as jest.Mock).mockReturnValueOnce({
      downloadAsync: jest.fn(async () => ({ status: 503, uri: '' })),
      pauseAsync: jest.fn(),
      resumeAsync: jest.fn(),
      cancelAsync: jest.fn(),
    });

    const jobId = await startDownload(sampleMedia);
    await new Promise((r) => setTimeout(r, 50));

    const failedJob = getQueue().find((j) => j.id === jobId);
    expect(failedJob?.state).toBe('FAILED');
    expect(failedJob?.isRetryable).toBe(true);
    expect(failedJob?.errorMessage).toContain('503');
  });

  test('UT-DL-07: storage save failure marks job FAILED without retry', async () => {
    jest.spyOn(mediaManager, 'saveCompletedMedia').mockResolvedValueOnce({
      success: false,
      finalUri: '',
      savedToGallery: false,
      message: 'Disk quota exceeded',
    });

    const jobId = await startDownload(sampleMedia);
    await new Promise((r) => setTimeout(r, 50));

    const failedJob = getQueue().find((j) => j.id === jobId);
    expect(failedJob?.state).toBe('FAILED');
    expect(failedJob?.isRetryable).toBe(false);
    expect(failedJob?.errorMessage).toContain('Disk quota exceeded');
  });

  test('UT-DL-08: removeDownloadJob removes job completely from queue and cleans active session', async () => {
    const jobId = await startDownload(sampleMedia);
    expect(getQueue().some((j) => j.id === jobId)).toBe(true);

    await removeDownloadJob(jobId);
    expect(getQueue().some((j) => j.id === jobId)).toBe(false);
  });
});
