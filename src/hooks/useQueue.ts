import { useEffect, useRef, useState } from 'react';
import { subscribeQueue } from '../storage/queueStore';
import { DownloadJob } from '../types';
import { jobStructureKey } from '../utils/jobDisplay';

/**
 * Job list that only updates when the list's structure changes (jobs added,
 * removed, or changing state/error/file). Byte-progress ticks do not re-render
 * the consumer; active rows read live data through useJob instead.
 */
export function useQueueStructure(): DownloadJob[] {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const keyRef = useRef<string | null>(null);

  useEffect(() => {
    return subscribeQueue((next) => {
      const key = next.map(jobStructureKey).join('|');
      if (key === keyRef.current) return;
      keyRef.current = key;
      setJobs(next);
    });
  }, []);

  return jobs;
}

/** Live view of one job; re-renders only when that job's object changes. */
export function useJob(id: string, initial: DownloadJob): DownloadJob {
  const [job, setJob] = useState(initial);

  useEffect(() => {
    return subscribeQueue((list) => {
      const found = list.find((j) => j.id === id);
      if (found) setJob((prev) => (prev === found ? prev : found));
    });
  }, [id]);

  return job;
}
