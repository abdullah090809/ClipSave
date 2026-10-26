import {
  addJobToQueue,
  updateJobInQueue,
  getQueue,
  removeJobFromQueue,
  clearTerminalJobs,
  subscribeQueue,
} from './queueStore';
import { DownloadJob } from '../types';

describe('queueStore', () => {
  const sampleJob: DownloadJob = {
    id: 'test_job_1',
    sourceUrl: 'https://www.tiktok.com/@user/video/1',
    media: {
      id: 'media_1',
      sourceUrl: 'https://www.tiktok.com/@user/video/1',
      title: 'Test Video 1',
      author: 'Tester',
      mediaUrl: 'https://example.com/video.mp4',
      format: 'mp4',
      isCleanSourceVerified: false,
    },
    state: 'QUEUED',
    bytesDownloaded: 0,
    totalBytes: 5000000,
    statusMessage: 'Queued',
    retryCount: 0,
    supportsResume: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  test('adds job and notifies subscribers', () => {
    let notifiedJobs: DownloadJob[] = [];
    const unsubscribe = subscribeQueue((jobs) => {
      notifiedJobs = jobs;
    });

    addJobToQueue(sampleJob);
    expect(getQueue().some((j) => j.id === 'test_job_1')).toBe(true);
    expect(notifiedJobs.some((j) => j.id === 'test_job_1')).toBe(true);

    unsubscribe();
  });

  test('updates job state and progress', () => {
    updateJobInQueue('test_job_1', {
      state: 'DOWNLOADING',
      bytesDownloaded: 2500000,
      statusMessage: 'Downloading...',
    });

    const updated = getQueue().find((j) => j.id === 'test_job_1');
    expect(updated?.state).toBe('DOWNLOADING');
    expect(updated?.bytesDownloaded).toBe(2500000);
  });

  test('clearTerminalJobs removes completed, failed, and cancelled jobs', () => {
    updateJobInQueue('test_job_1', { state: 'COMPLETED' });
    clearTerminalJobs();
    expect(getQueue().some((j) => j.id === 'test_job_1')).toBe(false);
  });

  test('removeJobFromQueue removes specific job', () => {
    addJobToQueue({ ...sampleJob, id: 'test_job_2' });
    expect(getQueue().some((j) => j.id === 'test_job_2')).toBe(true);

    removeJobFromQueue('test_job_2');
    expect(getQueue().some((j) => j.id === 'test_job_2')).toBe(false);
  });
});
