import { buildFormatOptions, extractYouTubeVideoId, parsePlayerResponse } from './youtubeLocal';

const video = (itag: number, height: number, fps: number, bitrate: number, size: number, codec = 'avc1.640028') => ({
  itag,
  url: `https://rr1.googlevideo.com/videoplayback?itag=${itag}&clen=${size}`,
  mimeType: `video/mp4; codecs="${codec}"`,
  height,
  fps,
  bitrate,
  contentLength: String(size),
});

const audio = (itag: number, bitrate: number, size: number, extra: Record<string, unknown> = {}) => ({
  itag,
  url: `https://rr1.googlevideo.com/videoplayback?itag=${itag}&clen=${size}`,
  mimeType: 'audio/mp4; codecs="mp4a.40.2"',
  bitrate,
  contentLength: String(size),
  audioQuality: 'AUDIO_QUALITY_MEDIUM',
  ...extra,
});

const muxed360 = {
  itag: 18,
  url: 'https://rr1.googlevideo.com/videoplayback?itag=18&clen=3608495',
  mimeType: 'video/mp4; codecs="avc1.42001E, mp4a.40.2"',
  height: 360,
  contentLength: '3608495',
  audioQuality: 'AUDIO_QUALITY_LOW',
};

function response(adaptiveFormats: any[], formats: any[] = [muxed360]) {
  return {
    playabilityStatus: { status: 'OK' },
    videoDetails: { title: 'Test video', author: 'Tester', lengthSeconds: '120' },
    streamingData: { expiresInSeconds: '21540', formats, adaptiveFormats },
  };
}

describe('extractYouTubeVideoId', () => {
  test('reads common URL forms', () => {
    expect(extractYouTubeVideoId('https://youtu.be/O51JbL6nA48?si=abc')).toBe('O51JbL6nA48');
    expect(extractYouTubeVideoId('https://youtube.com/shorts/CKprBAODpX4')).toBe('CKprBAODpX4');
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=O51JbL6nA48')).toBe('O51JbL6nA48');
    expect(extractYouTubeVideoId('https://example.com/x')).toBeNull();
  });
});

describe('buildFormatOptions', () => {
  const adaptive = [
    video(299, 1080, 60, 9000000, 1000),
    video(137, 1080, 30, 4000000, 400),
    video(298, 720, 60, 5000000, 600),
    video(136, 720, 30, 2000000, 250),
    video(134, 360, 30, 500000, 60),
    video(401, 2160, 30, 9000000, 5000, 'av01.0.12M.08'), // AV1: cannot be joined, must be ignored
    video(247, 720, 30, 1500000, 200, 'vp9'), // VP9: ignored
    audio(139, 48000, 10),
    audio(140, 130000, 100),
  ];

  test('offers H.264 video+audio pairs, smaller 30fps first at each height', () => {
    const options = buildFormatOptions(response(adaptive));
    expect(options.map((o) => o.id)).toEqual(['1080p', '1080p60', '720p', '720p60', '360p', 'audio']);
  });

  test('each video option carries the audio stream and the combined size', () => {
    const options = buildFormatOptions(response(adaptive));
    const hd = options.find((o) => o.id === '1080p')!;
    expect(hd.mediaUrl).toContain('itag=137');
    expect(hd.audioUrl).toContain('itag=140');
    expect(hd.estimatedSizeBytes).toBe(500);
    expect(hd.extension).toBe('mp4');
    expect(hd.label).toBe('1080p Full HD');
    expect(options.find((o) => o.id === '1080p60')!.label).toBe('1080p Full HD 60fps');
  });

  test('adds an audio-only m4a option using the best audio stream', () => {
    const options = buildFormatOptions(response(adaptive));
    const a = options[options.length - 1]!;
    expect(a.id).toBe('audio');
    expect(a.extension).toBe('m4a');
    expect(a.isVideo).toBe(false);
    expect(a.mediaUrl).toContain('itag=140');
    expect(a.audioUrl).toBeUndefined();
    expect(a.estimatedSizeBytes).toBe(100);
  });

  test('prefers the original-language audio over dubbed tracks', () => {
    const dubbed = audio(141, 256000, 300, { audioTrack: { audioIsDefault: false } });
    const options = buildFormatOptions(response([...adaptive, dubbed]));
    expect(options.find((o) => o.id === '720p')!.audioUrl).toContain('itag=140');
  });

  test('falls back to the combined 360p stream only when no separate streams exist', () => {
    const options = buildFormatOptions(response([]));
    expect(options).toHaveLength(1);
    expect(options[0]!.id).toBe('360p');
    expect(options[0]!.audioUrl).toBeUndefined();
  });

  test('falls back to combined stream when only AV1/VP9 video is offered', () => {
    const options = buildFormatOptions(response([video(401, 2160, 30, 9000000, 5000, 'av01.0.12M.08'), audio(140, 130000, 100)]));
    expect(options.map((o) => o.id)).toEqual(['360p', 'audio']);
  });

  test('leaves the size unknown when contentLength is missing', () => {
    const noSize = { ...video(137, 1080, 30, 4000000, 400), contentLength: undefined };
    const options = buildFormatOptions(response([noSize, audio(140, 130000, 100)]));
    expect(options[0]!.estimatedSizeBytes).toBeUndefined();
  });
});

describe('parsePlayerResponse', () => {
  const adaptive = [video(137, 1080, 30, 4000000, 400), video(136, 720, 30, 2000000, 250), audio(140, 130000, 100)];

  test('uses the best video format as the default download', () => {
    const media = parsePlayerResponse('O51JbL6nA48', 'https://youtu.be/O51JbL6nA48', response(adaptive));
    expect(media.quality).toBe('1080p');
    expect(media.format).toBe('mp4');
    expect(media.mediaUrl).toContain('itag=137');
    expect(media.audioUrl).toContain('itag=140');
    expect(media.estimatedSizeBytes).toBe(500);
    expect(media.availableFormats).toHaveLength(3);
    expect(media.title).toBe('Test video');
    expect(media.durationSeconds).toBe(120);
  });

  test('a combined-only video has no audioUrl', () => {
    const media = parsePlayerResponse('O51JbL6nA48', 'u', response([]));
    expect(media.audioUrl).toBeUndefined();
    expect(media.quality).toBe('360p');
  });

  test('throws when nothing is downloadable', () => {
    expect(() => parsePlayerResponse('O51JbL6nA48', 'u', response([], []))).toThrow();
  });

  test('maps a bot check to a retryable error', () => {
    const pr = { playabilityStatus: { status: 'LOGIN_REQUIRED', reason: 'Sign in to confirm you are not a bot' } };
    try {
      parsePlayerResponse('O51JbL6nA48', 'u', pr);
      throw new Error('should have thrown');
    } catch (e: any) {
      expect(e.code).toBe('YOUTUBE_BOT_CHECK');
      expect(e.isRetryable).toBe(true);
    }
  });
});
