import { File, FileMode } from 'expo-file-system';

/**
 * Downloads a YouTube stream in small pieces using the `range` query parameter,
 * the same technique yt-dlp uses. A single plain request for a large file is
 * throttled or refused by YouTube's servers, while ranged pieces are accepted.
 */

/** Size of each ranged request. Smaller pieces also give smoother progress updates. */
export const CHUNK_BYTES = 4 * 1024 * 1024;
const MAX_ATTEMPTS_PER_CHUNK = 3;

export class DownloadStoppedError extends Error {
  constructor() {
    super('Download stopped');
    this.name = 'DownloadStoppedError';
  }
}

export interface ChunkedDownloadOptions {
  url: string;
  headers: Record<string, string>;
  /** file:// URI of the temporary file to write. */
  destUri: string;
  /** Total size if known; otherwise read from the URL's `clen` parameter. */
  totalBytes?: number | undefined;
  onProgress: (writtenBytes: number, totalBytes: number | undefined) => void;
  shouldStop: () => boolean;
  fetchImpl?: typeof fetch;
}

export function stripRangeParam(url: string): string {
  return url.replace(/([?&])range=[^&]*&?/, (_m, sep: string) => sep).replace(/[?&]$/, '');
}

export function parseContentLengthParam(url: string): number | undefined {
  const match = url.match(/[?&]clen=(\d+)/);
  return match && match[1] ? Number(match[1]) : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchChunk(
  fetchImpl: typeof fetch,
  baseUrl: string,
  start: number,
  end: number,
  headers: Record<string, string>
): Promise<Uint8Array> {
  const sep = baseUrl.includes('?') ? '&' : '?';
  const response = await fetchImpl(`${baseUrl}${sep}range=${start}-${end}`, { headers });
  if (!response.ok && response.status !== 206) {
    const err = new Error(`YouTube refused the download (HTTP ${response.status}).`);
    (err as Error & { status?: number }).status = response.status;
    throw err;
  }
  return new Uint8Array(await response.arrayBuffer());
}

/** Resolves with the number of bytes written. Throws DownloadStoppedError if shouldStop() turns true. */
export async function downloadYouTubeChunked(opts: ChunkedDownloadOptions): Promise<number> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const baseUrl = stripRangeParam(opts.url);
  const total =
    opts.totalBytes && opts.totalBytes > 0 ? opts.totalBytes : parseContentLengthParam(opts.url);

  const file = new File(opts.destUri);
  if (file.exists) file.delete();
  file.create({ overwrite: true });
  const handle = file.open(FileMode.Truncate);

  let written = 0;
  try {
    while (total === undefined || written < total) {
      if (opts.shouldStop()) throw new DownloadStoppedError();

      const start = written;
      const end = total !== undefined ? Math.min(start + CHUNK_BYTES, total) - 1 : start + CHUNK_BYTES - 1;
      const expected = end - start + 1;

      let bytes: Uint8Array | undefined;
      let lastError: unknown;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_CHUNK; attempt++) {
        try {
          bytes = await fetchChunk(fetchImpl, baseUrl, start, end, opts.headers);
          break;
        } catch (err) {
          lastError = err;
          // A refusal (403/404/410) will not improve by retrying the same URL.
          const status = (err as { status?: number }).status;
          if (status === 403 || status === 404 || status === 410) break;
          if (opts.shouldStop()) throw new DownloadStoppedError();
          await sleep(500 * attempt);
        }
      }
      if (!bytes) throw lastError instanceof Error ? lastError : new Error('Download failed.');
      if (bytes.byteLength === 0) {
        if (total === undefined) break; // reached the end of an unknown-length file
        throw new Error('YouTube returned an empty response.');
      }

      await handle.writeBytes(bytes);
      written += bytes.byteLength;
      opts.onProgress(written, total);

      if (total === undefined && bytes.byteLength < expected) break;
    }
  } finally {
    try {
      handle.close();
    } catch {
      // ignore close errors
    }
  }
  return written;
}
