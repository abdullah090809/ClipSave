import { ResolvedMedia, ResolveError } from '../types';
import { getSettings } from '../storage/settingsStore';
import { resolveMockTikTokUrl } from './mockResolver';

export async function resolveTikTokUrl(url: string): Promise<ResolvedMedia> {
  const settings = await getSettings();

  if (settings.useMockResolver) {
    return resolveMockTikTokUrl(url);
  }

  const endpoint = `${settings.backendBaseUrl.replace(/\/$/, '')}/v1/resolve`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second client timeout

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const code = data?.code || `HTTP_${response.status}`;
      const message =
        data?.message ||
        (response.status === 429
          ? 'Too many requests. Please wait a moment before trying again.'
          : response.status === 403
          ? 'This video is private or restricted. ClipSave cannot access private content.'
          : response.status === 404
          ? 'The video could not be found or has been removed.'
          : 'Unable to resolve video. Please check the link or backend service status.');

      const err: ResolveError = {
        code,
        message,
        status: response.status,
        isRetryable: response.status >= 500 || response.status === 429,
      };
      throw err;
    }

    if (!data || !data.mediaUrl) {
      throw {
        code: 'MALFORMED_METADATA',
        message: 'Resolver returned incomplete media information.',
        isRetryable: true,
      } as ResolveError;
    }

    return {
      id: String(data.id || Date.now()),
      sourceUrl: url,
      title: data.title || 'Untitled Video',
      author: data.author || 'Unknown Creator',
      authorUsername: data.authorUsername,
      durationSeconds: data.durationSeconds,
      thumbnailUrl: data.thumbnailUrl,
      mediaUrl: data.mediaUrl,
      estimatedSizeBytes: data.estimatedSizeBytes,
      format: data.format || 'mp4',
      expiresAt: data.expiresAt,
      isCleanSourceVerified: !!data.isCleanSourceVerified,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw {
        code: 'TIMEOUT',
        message: 'Resolver request timed out. Please check your network connection.',
        isRetryable: true,
      } as ResolveError;
    }
    if (error.code && error.message) {
      throw error;
    }
    // Network failure (offline, connection refused)
    throw {
      code: 'NETWORK_FAILURE',
      message: 'Could not connect to the ClipSave resolver backend. Check your network or enable Mock Resolver in Settings for offline testing.',
      isRetryable: true,
    } as ResolveError;
  }
}
