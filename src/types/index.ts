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

export type SupportedPlatform =
  | 'tiktok'
  | 'youtube'
  | 'instagram'
  | 'facebook'
  | 'generic';

export interface MediaFormatOption {
  id: string; // e.g. '1080p', '720p', '480p', '360p', 'audio'
  label: string; // e.g. '1080p Full HD', '720p HD', '360p SD', 'Audio Only (MP3)'
  quality: string; // '1080p' | '720p' | '480p' | '360p' | 'audio'
  extension: string; // 'mp4' | 'mp3' | 'm4a'
  isVideo: boolean;
  mediaUrl: string;
  estimatedSizeBytes?: number | undefined;
  note?: string | undefined;
}

export interface ResolvedMedia {
  id: string;
  sourceUrl: string;
  platform?: SupportedPlatform | string | undefined;
  title: string;
  author: string;
  authorUsername?: string | undefined;
  durationSeconds?: number | undefined;
  thumbnailUrl?: string | undefined;
  mediaUrl: string;
  directMediaUrl?: string | undefined;
  httpHeaders?: Record<string, string> | undefined;
  estimatedSizeBytes?: number | undefined;
  format: string; // 'mp4' | 'mp3' | 'm4a'
  quality?: string | undefined; // '1080p' | '720p' | '360p' | 'audio'
  availableFormats?: MediaFormatOption[] | undefined;
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
  speedBytesPerSecond?: number | undefined;
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
  platform?: SupportedPlatform | string | undefined;
  format?: string | undefined;
  quality?: string | undefined;
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

export type ColorPalette = 'warm_light' | 'midnight' | 'sage';

export type AccentColor = 'coral' | 'blue' | 'violet' | 'green' | 'amber';

export type StartupAnimationMode = 'off' | 'subtle' | 'standard';

export type DefaultQualityPreference = '1080p' | '720p' | '360p' | 'audio';

export interface AppSettings {
  themeMode: ThemeMode;
  palette: ColorPalette;
  accentColor: AccentColor;
  startupAnimation: StartupAnimationMode;
  defaultQuality?: DefaultQualityPreference | string | undefined;
  autoDownloadOnResolve: boolean;
  saveToGallery: boolean;
  wifiOnly: boolean;
  maxConcurrentDownloads: number;
  useMockResolver: boolean;
  backendBaseUrl: string;
  enableLaunchAnimation?: boolean;
}

export interface ResolveError {
  code: string;
  message: string;
  isRetryable: boolean;
  status?: number | undefined;
}
