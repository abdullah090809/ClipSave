const mockWrites: Uint8Array[] = [];
let mockClosed = false;

jest.mock(
  'expo-file-system',
  () => ({
    FileMode: { Truncate: 'wt' },
    File: class {
      exists = false;
      delete() {}
      create() {}
      open() {
        return {
          writeBytes: async (b: Uint8Array) => {
            mockWrites.push(b);
          },
          close: () => {
            mockClosed = true;
          },
        };
      }
    },
  }),
  { virtual: true }
);

import {
  CHUNK_BYTES,
  DownloadStoppedError,
  downloadYouTubeChunked,
  parseContentLengthParam,
  stripRangeParam,
} from './youtubeChunkedDownload';

function makeFetch(source: Uint8Array, calls: string[], failStatus?: number): typeof fetch {
  return (async (url: string) => {
    calls.push(String(url));
    if (failStatus) return { ok: false, status: failStatus } as any;
    const m = String(url).match(/range=(\d+)-(\d+)/);
    const start = Number(m![1]);
    const end = Math.min(Number(m![2]), source.length - 1);
    const slice = source.slice(start, end + 1);
    return { ok: true, status: 200, arrayBuffer: async () => slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength) } as any;
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  mockWrites.length = 0;
  mockClosed = false;
});

describe('url helpers', () => {
  test('stripRangeParam removes an existing range', () => {
    expect(stripRangeParam('https://x/videoplayback?a=1&range=0-99&b=2')).toBe('https://x/videoplayback?a=1&b=2');
    expect(stripRangeParam('https://x/videoplayback?a=1&range=0-99')).toBe('https://x/videoplayback?a=1');
  });
  test('parseContentLengthParam reads clen', () => {
    expect(parseContentLengthParam('https://x/v?clen=3608495&a=1')).toBe(3608495);
    expect(parseContentLengthParam('https://x/v?a=1')).toBeUndefined();
  });
});

describe('downloadYouTubeChunked', () => {
  test('downloads in ranged chunks and writes every byte in order', async () => {
    const total = CHUNK_BYTES * 2 + 12345;
    const source = new Uint8Array(total).map((_, i) => i % 251);
    const calls: string[] = [];
    const progress: number[] = [];

    const written = await downloadYouTubeChunked({
      url: `https://rr1.googlevideo.com/videoplayback?id=1&range=0-99`,
      headers: { 'User-Agent': 'ua' },
      destUri: 'file:///tmp/a.tmp',
      totalBytes: total,
      onProgress: (w) => progress.push(w),
      shouldStop: () => false,
      fetchImpl: makeFetch(source, calls),
    });

    expect(written).toBe(total);
    expect(calls).toHaveLength(3);
    expect(calls[0]).toContain(`range=0-${CHUNK_BYTES - 1}`);
    expect(calls[2]).toContain(`range=${CHUNK_BYTES * 2}-${total - 1}`);
    const joined = new Uint8Array(total);
    let off = 0;
    for (const w of mockWrites) {
      joined.set(w, off);
      off += w.byteLength;
    }
    let identical = joined.length === source.length;
    for (let i = 0; identical && i < source.length; i++) {
      if (joined[i] !== source[i]) identical = false;
    }
    expect(identical).toBe(true);
    expect(progress[progress.length - 1]).toBe(total);
    expect(mockClosed).toBe(true);
  });

  test('uses the clen url parameter when no total is given', async () => {
    const source = new Uint8Array(1000).fill(7);
    const calls: string[] = [];
    const written = await downloadYouTubeChunked({
      url: 'https://rr1.googlevideo.com/videoplayback?clen=1000',
      headers: {},
      destUri: 'file:///tmp/b.tmp',
      onProgress: () => {},
      shouldStop: () => false,
      fetchImpl: makeFetch(source, calls),
    });
    expect(written).toBe(1000);
    expect(calls).toHaveLength(1);
  });

  test('a 403 is treated as a pause: it waits, retries the same piece, then continues', async () => {
    const source = new Uint8Array(5000).fill(9);
    const calls: string[] = [];
    let refusals = 3;
    const inner = makeFetch(source, calls);
    const fetchImpl = (async (url: string, init: any) => {
      if (refusals > 0) {
        refusals--;
        calls.push(String(url));
        return { ok: false, status: 403 } as any;
      }
      return (inner as any)(url, init);
    }) as unknown as typeof fetch;
    const waits: number[] = [];

    const written = await downloadYouTubeChunked({
      url: 'https://rr1.googlevideo.com/videoplayback?clen=5000',
      headers: {},
      destUri: 'file:///tmp/c.tmp',
      onProgress: () => {},
      shouldStop: () => false,
      fetchImpl,
      retryDelayMs: 2000,
      maxWaitMs: 60_000,
      sleepImpl: async () => {},
      onWaiting: ({ waitedMs }) => waits.push(waitedMs),
    });

    expect(written).toBe(5000);
    expect(calls).toHaveLength(4); // 3 refusals + 1 success, all for the same range
    expect(new Set(calls.map((c) => c.match(/range=[\d-]+/)![0])).size).toBe(1);
    expect(waits).toEqual([0, 2000, 4000]);
  });

  test('asks for a fresh URL on every third retry and uses it', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(String(url));
      if (String(url).includes('fresh=1')) {
        const slice = new Uint8Array(1000).fill(1);
        return { ok: true, status: 200, arrayBuffer: async () => slice.buffer } as any;
      }
      return { ok: false, status: 403 } as any;
    }) as unknown as typeof fetch;
    const refreshUrl = jest.fn(async () => 'https://rr2.googlevideo.com/videoplayback?clen=1000&fresh=1&range=0-9');

    const written = await downloadYouTubeChunked({
      url: 'https://rr1.googlevideo.com/videoplayback?clen=1000',
      headers: {},
      destUri: 'file:///tmp/e.tmp',
      onProgress: () => {},
      shouldStop: () => false,
      fetchImpl,
      retryDelayMs: 1000,
      maxWaitMs: 60_000,
      sleepImpl: async () => {},
      refreshUrl,
    });

    expect(written).toBe(1000);
    expect(refreshUrl).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(4); // 3 refused on the old URL, then the fresh one
    expect(calls[3]).toContain('rr2.googlevideo.com');
    expect(calls[3]).not.toContain('range=0-9&');
  });

  test('gives up with a readable message when the refusal never lifts', async () => {
    const calls: string[] = [];
    await expect(
      downloadYouTubeChunked({
        url: 'https://rr1.googlevideo.com/videoplayback?clen=5000',
        headers: {},
        destUri: 'file:///tmp/f.tmp',
        onProgress: () => {},
        shouldStop: () => false,
        fetchImpl: makeFetch(new Uint8Array(5000), calls, 403),
        retryDelayMs: 10_000,
        maxWaitMs: 30_000,
        sleepImpl: async () => {},
      })
    ).rejects.toThrow('kept refusing the download (HTTP 403)');
    expect(calls).toHaveLength(4); // first try + 3 waits of 10 s
    expect(mockClosed).toBe(true);
  });

  test('a 404 or 410 still fails immediately', async () => {
    const calls: string[] = [];
    await expect(
      downloadYouTubeChunked({
        url: 'https://rr1.googlevideo.com/videoplayback?clen=5000',
        headers: {},
        destUri: 'file:///tmp/g.tmp',
        onProgress: () => {},
        shouldStop: () => false,
        fetchImpl: makeFetch(new Uint8Array(5000), calls, 410),
        sleepImpl: async () => {},
      })
    ).rejects.toThrow('HTTP 410');
    expect(calls).toHaveLength(1);
  });

  test('Cancel works while waiting out a refusal', async () => {
    let stop = false;
    const calls: string[] = [];
    await expect(
      downloadYouTubeChunked({
        url: 'https://rr1.googlevideo.com/videoplayback?clen=5000',
        headers: {},
        destUri: 'file:///tmp/h.tmp',
        onProgress: () => {},
        shouldStop: () => stop,
        fetchImpl: makeFetch(new Uint8Array(5000), calls, 403),
        retryDelayMs: 10_000,
        sleepImpl: async () => {
          stop = true;
        },
      })
    ).rejects.toBeInstanceOf(DownloadStoppedError);
    expect(calls).toHaveLength(1);
  });

  test('stops cleanly when asked to', async () => {
    await expect(
      downloadYouTubeChunked({
        url: 'https://rr1.googlevideo.com/videoplayback?clen=5000',
        headers: {},
        destUri: 'file:///tmp/d.tmp',
        onProgress: () => {},
        shouldStop: () => true,
        fetchImpl: makeFetch(new Uint8Array(5000), []),
      })
    ).rejects.toBeInstanceOf(DownloadStoppedError);
  });
});
