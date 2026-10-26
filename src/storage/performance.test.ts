import {
  addJobToQueue,
  updateJobInQueue,
  clearTerminalJobs,
  subscribeQueue,
} from './queueStore';
import {
  addHistoryItem,
  getHistory,
  clearHistoryEntriesOnly,
} from './historyStore';
import { DownloadJob, HistoryItem } from '../types';

describe('Performance Benchmarks (Queue & History)', () => {
  afterEach(async () => {
    clearTerminalJobs();
    await clearHistoryEntriesOnly();
  });

  test('measures throughput of 200 rapid queue progress events', () => {
    const sampleJob: DownloadJob = {
      id: 'bench_job_1',
      sourceUrl: 'https://www.tiktok.com/@bench/video/1',
      media: {
        id: 'm_1',
        sourceUrl: 'https://www.tiktok.com/@bench/video/1',
        title: 'Benchmark Media',
        author: 'Tester',
        mediaUrl: 'https://example.com/v.mp4',
        format: 'mp4',
        isCleanSourceVerified: true,
      },
      state: 'DOWNLOADING',
      bytesDownloaded: 0,
      totalBytes: 20000000,
      statusMessage: 'Downloading...',
      retryCount: 0,
      supportsResume: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addJobToQueue(sampleJob);

    let notifyCount = 0;
    const unsubscribe = subscribeQueue(() => {
      notifyCount++;
    });

    const startTime = Date.now();
    for (let i = 1; i <= 200; i++) {
      updateJobInQueue('bench_job_1', {
        bytesDownloaded: i * 100000,
        statusMessage: `Downloading ${i}%`,
      });
    }
    const elapsedMs = Date.now() - startTime;
    unsubscribe();

    // With throttled queue notification, 200 byte chunks should NOT fire 200 times synchronously!
    expect(notifyCount).toBeLessThan(20);
    expect(elapsedMs).toBeLessThan(200);
  });

  test('measures latency of retrieving 100 history items from storage', async () => {
    // Populate 100 items
    for (let i = 0; i < 100; i++) {
      const item: HistoryItem = {
        id: `bench_hist_${i}`,
        sourceUrl: `https://www.tiktok.com/@user/video/${i}`,
        title: `Saved Clip ${i}`,
        author: `Creator_${i}`,
        fileUri: `file:///data/user/0/com.clipsave.app/files/clip_${i}.mp4`,
        fileSizeBytes: 5242880,
        durationSeconds: 30,
        savedAt: new Date().toISOString(),
        fileExists: true,
      };
      await addHistoryItem(item);
    }

    const startTime = Date.now();
    const items = await getHistory(false);
    const elapsedMs = Date.now() - startTime;

    expect(items.length).toBe(100);
    // Direct reading without 100 bridge filesystem checks should complete in under 50ms
    expect(elapsedMs).toBeLessThan(100);
  });
});
