import AsyncStorage from '@react-native-async-storage/async-storage';
import { DownloadJob, DownloadState } from '../types';

const QUEUE_KEY = '@clipsave_queue_v1';

type QueueListener = (jobs: DownloadJob[]) => void;
const listeners = new Set<QueueListener>();

let memoryJobs: DownloadJob[] = [];
let isLoaded = false;

// Performance optimization: Throttle storage persistence & notifications during streaming
let persistTimeout: ReturnType<typeof setTimeout> | null = null;
let notifyTimeout: ReturnType<typeof setTimeout> | null = null;
let lastNotifyTime = 0;
const NOTIFY_THROTTLE_MS = 120; // Max ~8 UI updates/sec during high-speed byte streaming
const PERSIST_THROTTLE_MS = 1000; // Persist to AsyncStorage at most once per second for byte progress

export const subscribeQueue = (listener: QueueListener): (() => void) => {
  listeners.add(listener);
  if (isLoaded) {
    listener([...memoryJobs]);
  }
  return () => {
    listeners.delete(listener);
  };
};

const dispatchListeners = () => {
  const snapshot = [...memoryJobs];
  listeners.forEach((l) => l(snapshot));
  lastNotifyTime = Date.now();
};

const schedulePersistence = (immediate = false) => {
  if (persistTimeout) {
    clearTimeout(persistTimeout);
    persistTimeout = null;
  }

  const doPersist = () => {
    AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(memoryJobs)).catch(() => {});
  };

  if (immediate) {
    doPersist();
  } else {
    persistTimeout = setTimeout(doPersist, PERSIST_THROTTLE_MS);
  }
};

const notifyListeners = (immediate = true) => {
  if (immediate) {
    if (notifyTimeout) {
      clearTimeout(notifyTimeout);
      notifyTimeout = null;
    }
    dispatchListeners();
    schedulePersistence(true);
  } else {
    const elapsed = Date.now() - lastNotifyTime;
    if (elapsed >= NOTIFY_THROTTLE_MS) {
      if (notifyTimeout) {
        clearTimeout(notifyTimeout);
        notifyTimeout = null;
      }
      dispatchListeners();
      schedulePersistence(false);
    } else if (!notifyTimeout) {
      notifyTimeout = setTimeout(() => {
        notifyTimeout = null;
        dispatchListeners();
        schedulePersistence(false);
      }, NOTIFY_THROTTLE_MS - elapsed);
    }
  }
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
  notifyListeners(true);
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
  notifyListeners(true);
};

export const updateJobInQueue = (id: string, updates: Partial<DownloadJob>): void => {
  const idx = memoryJobs.findIndex((j) => j.id === id);
  if (idx >= 0) {
    const current = memoryJobs[idx];
    if (!current) return;
    
    // Check if this is only a byte progress update while in DOWNLOADING state
    const isProgressOnly =
      updates.state === undefined &&
      (updates.bytesDownloaded !== undefined || updates.statusMessage !== undefined);

    memoryJobs[idx] = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // If state changes or terminal event occurs, notify and persist immediately.
    // If only bytes/progress changed, use throttled notification.
    notifyListeners(!isProgressOnly);
  }
};

export const removeJobFromQueue = (id: string): void => {
  memoryJobs = memoryJobs.filter((j) => j.id !== id);
  notifyListeners(true);
};

export const clearTerminalJobs = (): void => {
  memoryJobs = memoryJobs.filter(
    (j) => j.state !== 'COMPLETED' && j.state !== 'CANCELLED' && j.state !== 'FAILED'
  );
  notifyListeners(true);
};
