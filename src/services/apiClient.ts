import { ResolvedMedia, ResolveError } from '../types';
import { getSettings } from '../storage/settingsStore';
import { resolveMockTikTokUrl } from './mockResolver';

/**
 * Extracts the SnapDeploy container subdomain if present in URL
 * e.g. "https://clipsave-96518.containers.snapdeploy.app" -> "clipsave-96518"
 */
export function extractSnapDeploySubdomain(baseUrl: string): string | null {
  const match = baseUrl.match(/https?:\/\/([^.]+)\.containers\.snapdeploy\.app/i);
  return match ? match[1] : null;
}

/**
 * Explicitly sends the wake signal to SnapDeploy's wake API endpoint.
 * This instructs SnapDeploy to boot the dormant container instance.
 */
export async function wakeBackendContainer(subdomainOrUrl?: string): Promise<boolean> {
  try {
    let subdomain = subdomainOrUrl;
    if (!subdomain || subdomain.startsWith('http')) {
      const settings = await getSettings();
      subdomain = extractSnapDeploySubdomain(subdomain || settings.backendBaseUrl) || undefined;
    }

    if (!subdomain) {
      return false;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://snapdeploy.dev/api/public/wake/${subdomain}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Proactively checks backend health. If sleeping (503 / X-Wake-Page),
 * immediately triggers container boot so it's warm by the time the user resolves a link.
 */
export async function checkAndWarmBackend(): Promise<{ awake: boolean; wokeUp: boolean }> {
  try {
    const settings = await getSettings();
    if (settings.useMockResolver) return { awake: true, wokeUp: false };

    const baseUrl = settings.backendBaseUrl.replace(/\/$/, '');
    const healthUrl = `${baseUrl}/healthz`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(healthUrl, {
      method: 'GET',
      headers: { Accept: 'application/json', 'ngrok-skip-browser-warning': 'true' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.status === 200) {
      return { awake: true, wokeUp: false };
    }

    // Status 503 or X-Wake-Page indicates SnapDeploy sleeping container
    if (res.status === 503 || res.headers.get('X-Wake-Page') === 'true') {
      const subdomain = extractSnapDeploySubdomain(baseUrl);
      if (subdomain) {
        await wakeBackendContainer(subdomain);
        return { awake: false, wokeUp: true };
      }
      return { awake: false, wokeUp: false };
    }
    return { awake: false, wokeUp: false };
  } catch {
    // If connection refused / network error, send wake signal as precautionary measure
    try {
      const settings = await getSettings();
      const subdomain = extractSnapDeploySubdomain(settings.backendBaseUrl);
      if (subdomain) {
        await wakeBackendContainer(subdomain);
        return { awake: false, wokeUp: true };
      }
    } catch {
      // ignore
    }
    return { awake: false, wokeUp: false };
  }
}

export async function resolveTikTokUrl(
  url: string,
  onStatusUpdate?: (status: string) => void
): Promise<ResolvedMedia> {
  const settings = await getSettings();

  if (settings.useMockResolver) {
    return resolveMockTikTokUrl(url);
  }

  const baseUrl = settings.backendBaseUrl.replace(/\/$/, '');
  const endpoint = `${baseUrl}/v1/resolve`;
  const subdomain = extractSnapDeploySubdomain(baseUrl);

  const executeResolve = async (signal?: AbortSignal): Promise<Response> => {
    const init: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'ClipSave-Mobile/1.0.0 (Android; React-Native)',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({ url }),
    };
    if (signal) {
      init.signal = signal;
    }
    return fetch(endpoint, init);
  };

  try {
    const controller = new AbortController();
    // 12-second initial attempt timeout to detect if backend is awake
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    let response: Response;

    try {
      response = await executeResolve(controller.signal);
      clearTimeout(timeoutId);
    } catch (initialErr: any) {
      clearTimeout(timeoutId);
      // If timed out or failed to connect, server is likely sleeping
      response = new Response(null, { status: 503 });
    }

    // Check if container is sleeping (503 Service Unavailable or wake page header)
    if (response.status === 503 || response.headers.get('X-Wake-Page') === 'true') {
      onStatusUpdate?.('Waking up server...');
      if (subdomain) {
        await wakeBackendContainer(subdomain);
      }

      // Poll until container wakes up (up to 40 seconds)
      const maxAttempts = 18;
      let isAwake = false;

      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 2200));
        const elapsed = (i + 1) * 2;
        if (elapsed >= 16) {
          onStatusUpdate?.('Almost ready...');
        } else {
          onStatusUpdate?.('Waking up server...');
        }

        try {
          const pollController = new AbortController();
          const pollTimeout = setTimeout(() => pollController.abort(), 4000);
          const healthRes = await fetch(`${baseUrl}/healthz`, {
            method: 'GET',
            headers: { Accept: 'application/json', 'ngrok-skip-browser-warning': 'true' },
            signal: pollController.signal,
          });
          clearTimeout(pollTimeout);

          if (healthRes.status === 200) {
            isAwake = true;
            break;
          }
        } catch {
          // Container still initializing
        }
      }

      if (isAwake) {
        onStatusUpdate?.('Server ready! Resolving video...');
        // Retry resolve request now that container is warm
        const retryController = new AbortController();
        const retryTimeout = setTimeout(() => retryController.abort(), 20000);
        response = await executeResolve(retryController.signal);
        clearTimeout(retryTimeout);
      } else {
        throw {
          code: 'COLD_START_TIMEOUT',
          message: 'Server failed to respond in time. Please tap "Get video" to try again.',
          isRetryable: true,
        } as ResolveError;
      }
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = data?.detail;
      const code =
        (typeof detail === 'object' && detail?.code) ||
        data?.code ||
        `HTTP_${response.status}`;
      const message =
        (typeof detail === 'object' && detail?.message) ||
        (typeof detail === 'string' && detail) ||
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

    let mediaUrl: string = data.mediaUrl;
    // Ensure mediaUrl uses HTTPS for public hosts to satisfy Android NetworkSecurityPolicy
    if (mediaUrl && mediaUrl.startsWith('http://') && !mediaUrl.includes('127.0.0.1') && !mediaUrl.includes('localhost')) {
      mediaUrl = mediaUrl.replace(/^http:\/\//i, 'https://');
    }

    return {
      id: String(data.id || Date.now()),
      sourceUrl: url,
      platform: data.platform || (url.includes('youtube') || url.includes('youtu.be') ? 'youtube' : 'tiktok'),
      title: data.title || 'Untitled Video',
      author: data.author || 'Unknown Creator',
      authorUsername: data.authorUsername,
      durationSeconds: data.durationSeconds,
      thumbnailUrl: data.thumbnailUrl,
      mediaUrl,
      directMediaUrl: data.directMediaUrl,
      httpHeaders: data.httpHeaders,
      estimatedSizeBytes: data.estimatedSizeBytes,
      format: data.format || 'mp4',
      quality: data.quality || '1080p',
      availableFormats: data.availableFormats || [],
      expiresAt: data.expiresAt,
      isCleanSourceVerified: !!data.isCleanSourceVerified,
    };
  } catch (error: any) {
    if (error.code && error.message) {
      throw error;
    }
    if (error.name === 'AbortError') {
      throw {
        code: 'TIMEOUT',
        message: 'Resolver request timed out. The server may be waking up from sleep. Please try again in a moment.',
        isRetryable: true,
      } as ResolveError;
    }
    // Network failure (offline, connection refused)
    throw {
      code: 'NETWORK_FAILURE',
      message: 'Could not connect to the ClipSave resolver backend. Please check your internet connection.',
      isRetryable: true,
    } as ResolveError;
  }
}

export const resolveMediaUrl = resolveTikTokUrl;

