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

  test('a 403 fails immediately with a readable message and no retries', async () => {
    const calls: string[] = [];
    await expect(
      downloadYouTubeChunked({
        url: 'https://rr1.googlevideo.com/videoplayback?clen=5000',
        headers: {},
        destUri: 'file:///tmp/c.tmp',
        onProgress: () => {},
        shouldStop: () => false,
        fetchImpl: makeFetch(new Uint8Array(5000), calls, 403),
      })
    ).rejects.toThrow('HTTP 403');
    expect(calls).toHaveLength(1);
    expect(mockClosed).toBe(true);
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
