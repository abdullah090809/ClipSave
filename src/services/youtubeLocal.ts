import { MediaFormatOption, ResolvedMedia, ResolveError } from '../types';

/**
 * On-device YouTube resolver.
 *
 * The request is made from the phone, so YouTube sees the user's own home or mobile
 * IP instead of a datacenter IP.
 *
 * CLIENT: since 2026-08-17 YouTube refuses most downloads for the old ANDROID_VR client
 * (1.65.10) after a few MB (yt-dlp removed it from its defaults, issue #17456). The app now asks
 * as the VISIONOS client, which yt-dlp uses by default and which needs no PO token. Checked on a
 * PC with scripts/test-youtube-visionos.js: audio and 720p/1080p H.264 streams downloaded 300 MB
 * with no refusal. ANDROID_VR stays as a fallback if VISIONOS is refused for a video.
 *
 * FORMATS: VISIONOS offers no combined video+sound stream, only separate H.264 video-only and
 * AAC audio-only streams. The app downloads both and joins them on the phone.
 * LIMITS:
 *  - Client versions go stale. If YouTube starts rejecting VISIONOS, update it from yt-dlp's
 *    INNERTUBE_CLIENTS['visionos'] (yt_dlp/extractor/youtube/_base.py).
 *  - "Made for kids" videos are not available with the VISIONOS client.
 */

export interface YouTubeClientConfig {
  nameId: number;
  version: string;
  userAgent: string;
  context: Record<string, string | number>;
  /** The old ANDROID_VR request included this playback context; VISIONOS works without it. */
  html5Preference: boolean;
}

export const VISIONOS_CLIENT: YouTubeClientConfig = {
  nameId: 101,
  version: '1.02',
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  context: {
    clientName: 'VISIONOS',
    clientVersion: '1.02',
    deviceMake: 'Apple',
    deviceModel: 'RealityDevice17,1',
    osName: 'visionOS',
    osVersion: '26.5.23O471',
    hl: 'en',
  },
  html5Preference: false,
};

export const ANDROID_VR_CLIENT: YouTubeClientConfig = {
  nameId: 28,
  version: '1.65.10',
  userAgent:
    'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
  context: {
    clientName: 'ANDROID_VR',
    clientVersion: '1.65.10',
    deviceMake: 'Oculus',
    deviceModel: 'Quest 3',
    osName: 'Android',
    osVersion: '12L',
    androidSdkVersion: 32,
    hl: 'en',
  },
  html5Preference: true,
};

/** Tried in this order; the first one YouTube accepts for the video is used. */
export const YOUTUBE_CLIENTS: YouTubeClientConfig[] = [VISIONOS_CLIENT, ANDROID_VR_CLIENT];
export const YOUTUBE_CLIENT = VISIONOS_CLIENT;

/** If true, a failed on-device resolve falls through to the (usually blocked) backend. */
export const YOUTUBE_BACKEND_FALLBACK = false;

/** yt-dlp downloads YouTube files in 10 MB chunks using a `range` query parameter. */
const CHUNK_SIZE = 10 * 1024 * 1024;
const PLAYER_ENDPOINT = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
const WEB_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function fail(code: string, message: string, isRetryable = false, status?: number): ResolveError {
  const err: ResolveError = { code, message, isRetryable };
  if (status !== undefined) err.status = status;
  return err;
}

/** Returns the 11-character video ID from any common YouTube URL form, or null. */
export function extractYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (VIDEO_ID_RE.test(trimmed)) return trimmed;

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const parts = parsed.pathname.split('/').filter(Boolean);

  let candidate: string | undefined;
  if (host === 'youtu.be') {
    candidate = parts[0];
  } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (parts[0] === 'watch') candidate = parsed.searchParams.get('v') || undefined;
    else if (['shorts', 'embed', 'live', 'v'].includes(parts[0] || '')) candidate = parts[1];
  }
  return candidate && VIDEO_ID_RE.test(candidate) ? candidate : null;
}

export function buildPlayerBody(
  videoId: string,
  visitorData?: string,
  client: YouTubeClientConfig = YOUTUBE_CLIENT
): Record<string, unknown> {
  const clientContext: Record<string, unknown> = { ...client.context };
  if (visitorData) clientContext.visitorData = visitorData;
  const body: Record<string, unknown> = {
    videoId,
    context: { client: clientContext },
    contentCheckOk: true,
    racyCheckOk: true,
  };
  if (client.html5Preference) {
    body.playbackContext = { contentPlaybackContext: { html5Preference: 'HTML5_PREF_WANTS' } };
  }
  return body;
}

export function buildPlayerHeaders(
  visitorData?: string,
  client: YouTubeClientConfig = YOUTUBE_CLIENT
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': client.userAgent,
    'X-YouTube-Client-Name': String(client.nameId),
    'X-YouTube-Client-Version': client.version,
    Origin: 'https://www.youtube.com',
  };
  if (visitorData) headers['X-Goog-Visitor-Id'] = visitorData;
  return headers;
}

function qualityLabel(height: number): string {
  if (height >= 1080) return `${height}p Full HD`;
  if (height >= 720) return `${height}p HD`;
  return `${height}p SD`;
}

function withChunkRange(url: string, sizeBytes?: number): string {
  if (!sizeBytes || sizeBytes <= 0 || sizeBytes > CHUNK_SIZE || /[?&]range=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}range=0-${sizeBytes - 1}`;
}

function sizeOf(f: any): number | undefined {
  const n = f?.contentLength ? Number(f.contentLength) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function mimeOf(f: any): string {
  return String(f?.mimeType || '');
}

/** Picks the best AAC (m4a) audio-only stream, preferring the video's original-language track. */
function pickAudioStream(adaptive: any[]): any | undefined {
  const audio = adaptive.filter((f) => f && f.url && /^audio\/mp4/.test(mimeOf(f)) && /mp4a/.test(mimeOf(f)));
  audio.sort((a, b) => {
    const aDub = a.audioTrack?.audioIsDefault === false ? 1 : 0;
    const bDub = b.audioTrack?.audioIsDefault === false ? 1 : 0;
    if (aDub !== bDub) return aDub - bDub;
    return (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0);
  });
  return audio[0];
}

/** H.264 video-only streams (the only kind Android can join with AAC without re-encoding), one per height/fps. */
function pickVideoStreams(adaptive: any[]): any[] {
  const byKey = new Map<string, any>();
  for (const f of adaptive) {
    if (!f || !f.url || f.audioQuality) continue;
    const mime = mimeOf(f);
    if (!/^video\/mp4/.test(mime) || !/avc1/.test(mime)) continue;
    const height = Number(f.height);
    if (!height) continue;
    const fps = Number(f.fps) > 30 ? Number(f.fps) : 30;
    const key = `${height}_${fps}`;
    const existing = byKey.get(key);
    if (!existing || (Number(f.bitrate) || 0) > (Number(existing.bitrate) || 0)) byKey.set(key, f);
  }
  // Highest resolution first; at the same height the smaller 30fps file comes before 60fps.
  return [...byKey.entries()]
    .map(([key, f]) => ({ f, height: Number(key.split('_')[0]), fps: Number(key.split('_')[1]) }))
    .sort((a, b) => b.height - a.height || a.fps - b.fps)
    .map((x) => x.f);
}

/**
 * Builds the quality list. YouTube's 720p/1080p streams come as separate video-only and
 * audio-only files, so each option carries `audioUrl` and the app joins them after download.
 * The old combined 360p stream is only used when no separate streams are available, because
 * YouTube cuts it off after a few MB.
 */
export function buildFormatOptions(pr: any): MediaFormatOption[] {
  const adaptive: any[] = pr?.streamingData?.adaptiveFormats || [];
  const audio = pickAudioStream(adaptive);
  const videos = audio ? pickVideoStreams(adaptive).slice(0, 8) : [];
  const options: MediaFormatOption[] = [];

  if (audio && videos.length > 0) {
    const audioSize = sizeOf(audio);
    for (const f of videos) {
      const height = Number(f.height);
      const fps = Number(f.fps) > 30 ? Number(f.fps) : 30;
      const suffix = fps > 30 ? String(fps) : '';
      const videoSize = sizeOf(f);
      const option: MediaFormatOption = {
        id: `${height}p${suffix}`,
        label: `${qualityLabel(height)}${fps > 30 ? ` ${fps}fps` : ''}`,
        quality: `${height}p${suffix}`,
        extension: 'mp4',
        isVideo: true,
        mediaUrl: String(f.url),
        audioUrl: String(audio.url),
        note: 'Video and sound download separately and are joined on your phone.',
      };
      if (videoSize !== undefined && audioSize !== undefined) option.estimatedSizeBytes = videoSize + audioSize;
      options.push(option);
    }
  } else {
    const muxed: any[] = (pr?.streamingData?.formats || []).filter(
      (f: any) => f && f.url && /video\/mp4/.test(mimeOf(f)) && f.audioQuality
    );
    muxed.sort((a, b) => (b.height || 0) - (a.height || 0));
    for (const f of muxed) {
      const height = Number(f.height) || 360;
      const size = sizeOf(f);
      const option: MediaFormatOption = {
        id: `${height}p`,
        label: qualityLabel(height),
        quality: `${height}p`,
        extension: 'mp4',
        isVideo: true,
        mediaUrl: withChunkRange(String(f.url), size),
      };
      if (size !== undefined) option.estimatedSizeBytes = size;
      options.push(option);
    }
  }

  if (audio) {
    const audioSize = sizeOf(audio);
    const option: MediaFormatOption = {
      id: 'audio',
      label: 'Audio only (M4A)',
      quality: 'audio',
      extension: 'm4a',
      isVideo: false,
      mediaUrl: String(audio.url),
    };
    if (audioSize !== undefined) option.estimatedSizeBytes = audioSize;
    options.push(option);
  }
  return options;
}

/** Turns a raw InnerTube player response into the app's ResolvedMedia, or throws a ResolveError. */
export function parsePlayerResponse(
  videoId: string,
  sourceUrl: string,
  pr: any,
  client: YouTubeClientConfig = YOUTUBE_CLIENT
): ResolvedMedia {
  const status: string | undefined = pr?.playabilityStatus?.status;
  const reason: string = String(pr?.playabilityStatus?.reason || '');

  if (status && status !== 'OK') {
    if (status === 'LOGIN_REQUIRED' && /bot/i.test(reason)) {
      throw fail(
        'YOUTUBE_BOT_CHECK',
        'YouTube asked for verification on this connection. Try again later or switch between Wi-Fi and mobile data.',
        true
      );
    }
    if (status === 'LOGIN_REQUIRED') {
      throw fail(
        'YOUTUBE_LOGIN_REQUIRED',
        'This video needs a sign-in (private, age-restricted or members only), so ClipSave cannot download it.',
        false,
        403
      );
    }
    if (status === 'ERROR') {
      throw fail('YOUTUBE_NOT_FOUND', reason || 'The video could not be found or has been removed.', false, 404);
    }
    throw fail('YOUTUBE_UNPLAYABLE', reason || 'YouTube says this video cannot be played here.', false);
  }

  const availableFormats = buildFormatOptions(pr);
  if (availableFormats.length === 0) {
    throw fail(
      'YOUTUBE_NO_FORMATS',
      'YouTube did not offer a downloadable stream for this video on this connection.',
      true
    );
  }

  const best = availableFormats[0]!;
  const details = pr?.videoDetails || {};
  const thumbs: any[] = details.thumbnail?.thumbnails || [];
  const expiresIn = Number(pr?.streamingData?.expiresInSeconds);

  const media: ResolvedMedia = {
    id: videoId,
    sourceUrl,
    platform: 'youtube',
    title: String(details.title || 'Untitled Video'),
    author: String(details.author || 'Unknown Creator'),
    mediaUrl: best.mediaUrl,
    directMediaUrl: best.mediaUrl,
    httpHeaders: { 'User-Agent': client.userAgent },
    format: best.extension,
    quality: best.quality,
    availableFormats,
    isCleanSourceVerified: true,
  };
  if (best.audioUrl) media.audioUrl = best.audioUrl;
  if (details.lengthSeconds) media.durationSeconds = Number(details.lengthSeconds);
  if (thumbs.length) media.thumbnailUrl = String(thumbs[thumbs.length - 1].url);
  if (best.estimatedSizeBytes) media.estimatedSizeBytes = best.estimatedSizeBytes;
  if (Number.isFinite(expiresIn) && expiresIn > 0) {
    media.expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  }
  return media;
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Best-effort fetch of the visitor ID that YouTube's own clients send. Never throws. */
export async function fetchVisitorData(videoId: string, fetchImpl: typeof fetch = fetch): Promise<string | undefined> {
  try {
    const res = await fetchWithTimeout(
      fetchImpl,
      `https://www.youtube.com/watch?v=${videoId}`,
      { headers: { 'User-Agent': WEB_UA, 'Accept-Language': 'en-US,en;q=0.9' } },
      6000
    );
    if (!res.ok) return undefined;
    const html = await res.text();
    const match = html.match(/"VISITOR_DATA":"([^"]+)"/) || html.match(/"visitorData":"([^"]+)"/);
    return match ? match[1] : undefined;
  } catch {
    return undefined;
  }
}

/** Asks YouTube for the video as one client. Throws a ResolveError when it cannot be used. */
async function resolveWithClient(
  client: YouTubeClientConfig,
  videoId: string,
  url: string,
  visitorData: string | undefined,
  fetchImpl: typeof fetch
): Promise<ResolvedMedia> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      fetchImpl,
      PLAYER_ENDPOINT,
      {
        method: 'POST',
        headers: buildPlayerHeaders(visitorData, client),
        body: JSON.stringify(buildPlayerBody(videoId, visitorData, client)),
      },
      15000
    );
  } catch {
    throw fail('NETWORK_FAILURE', 'Could not reach YouTube. Please check your internet connection.', true);
  }

  if (!response.ok) {
    throw fail(
      `HTTP_${response.status}`,
      response.status === 429
        ? 'YouTube is limiting requests from this connection. Please wait a little and try again.'
        : 'YouTube rejected the request. The app may need an update.',
      response.status >= 500 || response.status === 429,
      response.status
    );
  }

  const data = await response.json().catch(() => null);
  if (!data) {
    throw fail('MALFORMED_METADATA', 'YouTube returned an unreadable response.', true);
  }
  return parsePlayerResponse(videoId, url, data, client);
}

export async function resolveYouTubeOnDevice(
  url: string,
  fetchImpl: typeof fetch = fetch,
  clients: YouTubeClientConfig[] = YOUTUBE_CLIENTS
): Promise<ResolvedMedia> {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    throw fail('INVALID_URL', 'That does not look like a valid YouTube video link.', false, 400);
  }

  const visitorData = await fetchVisitorData(videoId, fetchImpl);

  let firstError: unknown;
  for (const client of clients) {
    try {
      return await resolveWithClient(client, videoId, url, visitorData, fetchImpl);
    } catch (err) {
      // No connection: another client will not help.
      if ((err as ResolveError)?.code === 'NETWORK_FAILURE') throw err;
      if (firstError === undefined) firstError = err;
    }
  }
  // Report what the preferred client said.
  throw firstError;
}
