import { File, FileMode } from 'expo-file-system';

/**
 * Downloads a YouTube stream in small pieces using the `range` query parameter,
 * the same technique yt-dlp uses. A single plain request for a large file is
 * throttled or refused by YouTube's servers, while ranged pieces are accepted.
 */

/** Size of each ranged request. Smaller pieces also give smoother progress updates. */
export const CHUNK_BYTES = 4 * 1024 * 1024;
const MAX_ATTEMPTS_PER_CHUNK = 3;
const REQUEST_TIMEOUT_MS = 45_000;

/**
 * YouTube answers HTTP 403 (sometimes 429) after a burst of downloading and lifts the block by itself.
 * Measured on a PC: the block started after about 20 MB and cleared after about a minute. So a refusal
 * is treated as a pause: wait, retry the same piece, and ask for a fresh URL every third retry.
 */
export const COOLDOWN_RETRY_MS = 10_000;
export const COOLDOWN_MAX_WAIT_MS = 5 * 60_000;
const COOLDOWN_STATUSES = [403, 429];

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
  /** Called while YouTube is refusing pieces and the download is waiting to try again. */
  onWaiting?: (info: { waitedMs: number; status: number }) => void;
  /** Returns a fresh URL for the same stream (the old one may have gone stale). Called every third retry. */
  refreshUrl?: () => Promise<string | undefined>;
  /** Pause between retries after a refusal. */
  retryDelayMs?: number;
  /** Give up on one piece after waiting this long in total. */
  maxWaitMs?: number;
  /** Give up on one request if it makes no progress for this long (default 45 s). */
  requestTimeoutMs?: number;
  /**
   * Continue a partly downloaded file instead of starting over. The pieces are written in order, so
   * the size of the file on disk is exactly how many bytes are already done. Ignored (starts from 0)
   * when the file is missing, empty, or larger than the stream.
   */
  resume?: boolean;
  /** Test hook. */
  sleepImpl?: (ms: number) => Promise<void>;
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
  headers: Record<string, string>,
  timeoutMs: number
): Promise<Uint8Array> {
  const sep = baseUrl.includes('?') ? '&' : '?';
  // A stalled connection must not freeze the download forever, so every piece has a deadline.
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller?.abort();
  }, timeoutMs);
  try {
    const response = await fetchImpl(`${baseUrl}${sep}range=${start}-${end}`, {
      headers,
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (!response.ok && response.status !== 206) {
      const err = new Error(`YouTube refused the download (HTTP ${response.status}).`);
      (err as Error & { status?: number }).status = response.status;
      throw err;
    }
    return new Uint8Array(await response.arrayBuffer());
  } catch (err) {
    if (timedOut) throw new Error('The connection to YouTube timed out.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Resolves with the number of bytes written. Throws DownloadStoppedError if shouldStop() turns true. */
export async function downloadYouTubeChunked(opts: ChunkedDownloadOptions): Promise<number> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const baseUrl = stripRangeParam(opts.url);
  const total =
    opts.totalBytes && opts.totalBytes > 0 ? opts.totalBytes : parseContentLengthParam(opts.url);

  const file = new File(opts.destUri);
  let alreadyOnDisk = 0;
  if (opts.resume && total !== undefined && file.exists) {
    const size = Number(file.size) || 0;
    if (size > 0 && size <= total) alreadyOnDisk = size;
  }
  if (alreadyOnDisk === 0) {
    if (file.exists) file.delete();
    file.create({ overwrite: true });
  }
  const handle = file.open(alreadyOnDisk > 0 ? FileMode.Append : FileMode.Truncate);

  const retryDelayMs = opts.retryDelayMs ?? COOLDOWN_RETRY_MS;
  const maxWaitMs = opts.maxWaitMs ?? COOLDOWN_MAX_WAIT_MS;
  const sleepFn = opts.sleepImpl ?? sleep;
  let currentBase = baseUrl;

  /** Sleeps in one-second slices so Cancel and Pause react quickly. */
  const waitInterruptibly = async (ms: number) => {
    let left = ms;
    while (left > 0) {
      if (opts.shouldStop()) throw new DownloadStoppedError();
      const slice = Math.min(1000, left);
      await sleepFn(slice);
      left -= slice;
    }
    if (opts.shouldStop()) throw new DownloadStoppedError();
  };

  let written = alreadyOnDisk;
  try {
    if (alreadyOnDisk > 0) opts.onProgress(written, total);
    while (total === undefined || written < total) {
      if (opts.shouldStop()) throw new DownloadStoppedError();

      const start = written;
      const end = total !== undefined ? Math.min(start + CHUNK_BYTES, total) - 1 : start + CHUNK_BYTES - 1;
      const expected = end - start + 1;

      let bytes: Uint8Array | undefined;
      let networkAttempts = 0;
      let waitedMs = 0;
      let cooldownTries = 0;
      while (!bytes) {
        try {
          bytes = await fetchChunk(fetchImpl, currentBase, start, end, opts.headers, opts.requestTimeoutMs ?? REQUEST_TIMEOUT_MS);
        } catch (err) {
          const status = (err as { status?: number }).status;
          if (status === 404 || status === 410) throw err;

          if (status !== undefined && COOLDOWN_STATUSES.includes(status)) {
            if (waitedMs >= maxWaitMs) {
              const mins = Math.max(1, Math.round(waitedMs / 60_000));
              throw new Error(
                `YouTube kept refusing the download (HTTP ${status}) for ${mins} minute${mins === 1 ? '' : 's'}. Try again in a few minutes.`
              );
            }
            opts.onWaiting?.({ waitedMs, status });
            await waitInterruptibly(retryDelayMs);
            waitedMs += retryDelayMs;
            cooldownTries++;
            if (opts.refreshUrl && cooldownTries % 3 === 0) {
              try {
                const fresh = await opts.refreshUrl();
                if (fresh) currentBase = stripRangeParam(fresh);
              } catch {
                // keep the old URL
              }
            }
            continue;
          }

          // Network hiccup: a few quick retries.
          networkAttempts++;
          if (networkAttempts >= MAX_ATTEMPTS_PER_CHUNK) throw err;
          if (opts.shouldStop()) throw new DownloadStoppedError();
          await sleepFn(500 * networkAttempts);
        }
      }
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
