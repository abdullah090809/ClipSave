import AsyncStorage from '@react-native-async-storage/async-storage';
import { DownloadJob, DownloadState } from '../types';

const QUEUE_KEY = '@clipsave_queue_v1';

type QueueListener = (jobs: DownloadJob[]) => void;
const listeners = new Set<QueueListener>();

let memoryJobs: DownloadJob[] = [];
let isLoaded = false;

export const subscribeQueue = (listener: QueueListener): (() => void) => {
  listeners.add(listener);
  if (isLoaded) {
    listener([...memoryJobs]);
  }
  return () => {
    listeners.delete(listener);
  };
};

const notifyListeners = () => {
  const snapshot = [...memoryJobs];
  listeners.forEach((l) => l(snapshot));
  AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(memoryJobs)).catch(() => {});
};

export const loadQueueFromStorage = async (): Promise<DownloadJob[]> => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (raw) {
      const parsed: DownloadJob[] = JSON.parse(raw);
      // Process death reconciliation: any job left in DOWNLOADING or FINALIZING becomes INTERRUPTED/FAILED
      memoryJobs = parsed.map((job) => {
        if (job.state === 'DOWNLOADING' || job.state === 'FINALIZING') {
          return {
            ...job,
            state: 'FAILED' as DownloadState,
            statusMessage: 'Interrupted by app termination',
            errorMessage: 'Process closed during download. You can tap Retry to resume.',
            isRetryable: true,
          };
        }
        return job;
      });
    }
  } catch {
    memoryJobs = [];
  }
  isLoaded = true;
  notifyListeners();
  return [...memoryJobs];
};

export const getQueue = (): DownloadJob[] => [...memoryJobs];

export const addJobToQueue = (job: DownloadJob): void => {
  const existingIdx = memoryJobs.findIndex((j) => j.id === job.id);
  if (existingIdx >= 0) {
    memoryJobs[existingIdx] = job;
  } else {
    memoryJobs.unshift(job);
  }
  notifyListeners();
};

export const updateJobInQueue = (id: string, updates: Partial<DownloadJob>): void => {
  const idx = memoryJobs.findIndex((j) => j.id === id);
  if (idx >= 0) {
    const current = memoryJobs[idx];
    if (!current) return;
    memoryJobs[idx] = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    notifyListeners();
  }
};

export const removeJobFromQueue = (id: string): void => {
  memoryJobs = memoryJobs.filter((j) => j.id !== id);
  notifyListeners();
};

export const clearTerminalJobs = (): void => {
  memoryJobs = memoryJobs.filter(
    (j) => j.state !== 'COMPLETED' && j.state !== 'CANCELLED' && j.state !== 'FAILED'
  );
  notifyListeners();
};
