import { MediaFormatOption, ResolvedMedia, ResolveError } from '../types';

/**
 * On-device YouTube resolver.
 *
 * The request is made from the phone, so YouTube sees the user's own home or mobile
 * IP instead of a datacenter IP. It mimics the ANDROID_VR client, using the same
 * settings as yt-dlp 2026.10.x (client 28, version 1.65.10).
 *
 * LIMITS (as of yt-dlp 2026.10.26):
 *  - android_vr requires a "GVS PO token" for most formats. The only exemption yt-dlp
 *    makes is itag 18 (360p MP4 with audio), so that is what this resolver can offer.
 *  - Client versions go stale. If YouTube starts rejecting this one, update
 *    YOUTUBE_CLIENT from yt-dlp's INNERTUBE_CLIENTS['android_vr'].
 */

export const YOUTUBE_CLIENT = {
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
} as const;

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

export function buildPlayerBody(videoId: string, visitorData?: string): Record<string, unknown> {
  const client: Record<string, unknown> = { ...YOUTUBE_CLIENT.context };
  if (visitorData) client.visitorData = visitorData;
  return {
    videoId,
    context: { client },
    playbackContext: { contentPlaybackContext: { html5Preference: 'HTML5_PREF_WANTS' } },
    contentCheckOk: true,
    racyCheckOk: true,
  };
}

export function buildPlayerHeaders(visitorData?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': YOUTUBE_CLIENT.userAgent,
    'X-YouTube-Client-Name': String(YOUTUBE_CLIENT.nameId),
    'X-YouTube-Client-Version': YOUTUBE_CLIENT.version,
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

/** Turns a raw InnerTube player response into the app's ResolvedMedia, or throws a ResolveError. */
export function parsePlayerResponse(videoId: string, sourceUrl: string, pr: any): ResolvedMedia {
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

  const muxed: any[] = (pr?.streamingData?.formats || []).filter(
    (f: any) => f && f.url && /video\/mp4/.test(String(f.mimeType || '')) && f.audioQuality
  );
  if (muxed.length === 0) {
    throw fail(
      'YOUTUBE_NO_FORMATS',
      'YouTube did not offer a downloadable stream for this video on this connection.',
      true
    );
  }
  muxed.sort((a, b) => (b.height || 0) - (a.height || 0));

  const availableFormats: MediaFormatOption[] = muxed.map((f) => {
    const height = Number(f.height) || 360;
    const size = f.contentLength ? Number(f.contentLength) : undefined;
    const option: MediaFormatOption = {
      id: `${height}p`,
      label: qualityLabel(height),
      quality: `${height}p`,
      extension: 'mp4',
      isVideo: true,
      mediaUrl: withChunkRange(String(f.url), size),
    };
    if (size) option.estimatedSizeBytes = size;
    return option;
  });

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
    httpHeaders: { 'User-Agent': YOUTUBE_CLIENT.userAgent },
    format: 'mp4',
    quality: best.quality,
    availableFormats,
    isCleanSourceVerified: true,
  };
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

export async function resolveYouTubeOnDevice(url: string, fetchImpl: typeof fetch = fetch): Promise<ResolvedMedia> {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    throw fail('INVALID_URL', 'That does not look like a valid YouTube video link.', false, 400);
  }

  const visitorData = await fetchVisitorData(videoId, fetchImpl);

  let response: Response;
  try {
    response = await fetchWithTimeout(
      fetchImpl,
      PLAYER_ENDPOINT,
      {
        method: 'POST',
        headers: buildPlayerHeaders(visitorData),
        body: JSON.stringify(buildPlayerBody(videoId, visitorData)),
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
  return parsePlayerResponse(videoId, url, data);
}
