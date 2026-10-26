export type DownloadState =
  | 'QUEUED'
  | 'RESOLVING'
  | 'READY'
  | 'DOWNLOADING'
  | 'PAUSED'
  | 'FINALIZING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface ResolvedMedia {
  id: string;
  sourceUrl: string;
  title: string;
  author: string;
  authorUsername?: string | undefined;
  durationSeconds?: number | undefined;
  thumbnailUrl?: string | undefined;
  mediaUrl: string;
  estimatedSizeBytes?: number | undefined;
  format: string;
  expiresAt?: string | undefined; // ISO date string
  isCleanSourceVerified: boolean;
}

export interface DownloadJob {
  id: string;
  sourceUrl: string;
  media: ResolvedMedia;
  state: DownloadState;
  bytesDownloaded: number;
  totalBytes?: number | undefined;
  statusMessage: string;
  errorMessage?: string | undefined;
  isRetryable?: boolean | undefined;
  retryCount: number;
  supportsResume: boolean;
  tempFilePath?: string | undefined;
  finalFileUri?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryItem {
  id: string;
  sourceUrl: string;
  title: string;
  author: string;
  thumbnailUrl?: string | undefined;
  fileUri: string;
  fileSizeBytes?: number | undefined;
  durationSeconds?: number | undefined;
  savedAt: string;
  fileExists: boolean;
}

export type ThemeMode = 'system' | 'light' | 'dark';

export interface AppSettings {
  themeMode: ThemeMode;
  autoDownloadOnResolve: boolean;
  saveToGallery: boolean;
  wifiOnly: boolean;
  maxConcurrentDownloads: number;
  useMockResolver: boolean;
  backendBaseUrl: string;
}

export interface ResolveError {
  code: string;
  message: string;
  isRetryable: boolean;
  status?: number | undefined;
}
