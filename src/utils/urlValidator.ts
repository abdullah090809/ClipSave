import { SupportedPlatform } from '../types';

export interface UrlValidationResult {
  isValid: boolean;
  normalizedUrl?: string;
  errorMessage?: string;
  extractedUrlsCount?: number;
  platform?: SupportedPlatform;
  isShort?: boolean;
}

// Strict allowlist of legitimate TikTok hostnames
export const ALLOWED_TIKTOK_HOSTS = new Set([
  'tiktok.com',
  'www.tiktok.com',
  'm.tiktok.com',
  'vm.tiktok.com',
  'vt.tiktok.com',
  'v.douyin.com',
]);

// Strict allowlist of legitimate YouTube hostnames
export const ALLOWED_YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'music.youtube.com',
]);

// Future platforms
export const ALLOWED_INSTAGRAM_HOSTS = new Set([
  'instagram.com',
  'www.instagram.com',
]);

export const ALLOWED_FACEBOOK_HOSTS = new Set([
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'fb.watch',
  'web.facebook.com',
]);

const MAX_URL_LENGTH = 2048;

/**
 * Fast client-side platform detection from a raw text or URL.
 * Used for instant UI feedback (showing platform badge/icon while typing).
 */
export function detectPlatform(rawInput: string): { platform: SupportedPlatform; isShort?: boolean } {
  if (!rawInput || typeof rawInput !== 'string') {
    return { platform: 'generic' };
  }

  const trimmed = rawInput.trim();
  const lower = trimmed.toLowerCase();

  // YouTube detection
  if (
    lower.includes('youtube.com') ||
    lower.includes('youtu.be') ||
    lower.includes('music.youtube.com')
  ) {
    const isShort = lower.includes('/shorts/');
    return { platform: 'youtube', isShort };
  }

  // TikTok detection
  if (
    lower.includes('tiktok.com') ||
    lower.includes('douyin.com')
  ) {
    return { platform: 'tiktok' };
  }

  // Instagram detection (coming soon)
  if (lower.includes('instagram.com')) {
    return { platform: 'instagram' };
  }

  // Facebook detection (coming soon)
  if (lower.includes('facebook.com') || lower.includes('fb.watch')) {
    return { platform: 'facebook' };
  }

  return { platform: 'generic' };
}

/**
 * Validates any supported media URL (YouTube Shorts, YouTube Videos, TikTok).
 * Cleanly extensible for upcoming Instagram and Facebook support.
 */
export function validateMediaUrl(rawInput: string): UrlValidationResult {
  if (!rawInput || typeof rawInput !== 'string') {
    return { isValid: false, errorMessage: 'Please enter or paste a valid video link.' };
  }

  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { isValid: false, errorMessage: 'Please enter or paste a valid video link.' };
  }

  if (trimmed.length > MAX_URL_LENGTH) {
    return { isValid: false, errorMessage: 'Input is too long. Please provide a standard URL.' };
  }

  // Check for ASCII control characters
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return { isValid: false, errorMessage: 'Input contains invalid control characters.' };
  }

  // Regex to detect candidate URLs in text
  const urlRegex = /https?:\/\/[^\s]+/gi;
  const matches = trimmed.match(urlRegex);

  if (matches && matches.length > 1) {
    return {
      isValid: false,
      extractedUrlsCount: matches.length,
      errorMessage: `Multiple links found (${matches.length}). Please paste only one link at a time.`,
    };
  }

  let candidate = trimmed;
  if (matches && matches.length === 1) {
    candidate = matches[0]!;
  } else if (!candidate.startsWith('http://') && !candidate.startsWith('https://')) {
    // If user entered without protocol, test if adding https:// makes a valid URL
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);

    // Reject non-http(s) schemes immediately
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { isValid: false, errorMessage: 'Only HTTPS and HTTP links are supported.' };
    }

    // Reject URLs with embedded credentials (user:pass@host)
    if (parsed.username || parsed.password) {
      return { isValid: false, errorMessage: 'URLs with embedded credentials are not permitted.' };
    }

    // Reject non-standard ports
    if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
      return { isValid: false, errorMessage: 'Non-standard network ports are not permitted.' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check Instagram
    if (ALLOWED_INSTAGRAM_HOSTS.has(hostname)) {
      return {
        isValid: false,
        platform: 'instagram',
        errorMessage: 'Instagram support is coming in the next update! Currently YouTube and TikTok are supported.',
      };
    }

    // Check Facebook
    if (ALLOWED_FACEBOOK_HOSTS.has(hostname)) {
      return {
        isValid: false,
        platform: 'facebook',
        errorMessage: 'Facebook support is coming in an upcoming update! Currently YouTube and TikTok are supported.',
      };
    }

    // Check YouTube
    const isYouTube = ALLOWED_YOUTUBE_HOSTS.has(hostname);
    if (isYouTube) {
      const pathname = parsed.pathname;
      const isShort = pathname.startsWith('/shorts/');
      const isWatch = pathname === '/watch' && parsed.searchParams.has('v');
      const isYouTuBe = hostname === 'youtu.be' && pathname.length > 1;
      const isEmbed = pathname.startsWith('/embed/');

      if (!isShort && !isWatch && !isYouTuBe && !isEmbed) {
        return {
          isValid: false,
          platform: 'youtube',
          errorMessage: 'Please provide a link to a specific YouTube video or Short (e.g. youtube.com/watch?v=... or youtube.com/shorts/...).',
        };
      }

      // Clean tracking parameters while preserving 'v' and 't'
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'si', 'feature', 'fbclid', 'gclid'];
      trackingParams.forEach((p) => parsed.searchParams.delete(p));

      return {
        isValid: true,
        normalizedUrl: parsed.toString(),
        extractedUrlsCount: 1,
        platform: 'youtube',
        isShort,
      };
    }

    // Check TikTok
    const isTikTok = ALLOWED_TIKTOK_HOSTS.has(hostname);
    if (isTikTok) {
      // Path check: must point to a video or share link
      if (!parsed.pathname || parsed.pathname === '/') {
        return { isValid: false, errorMessage: 'URL must point to a specific video or share link.' };
      }

      // Strip aggressive tracking query parameters
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'];
      trackingParams.forEach((p) => parsed.searchParams.delete(p));

      return {
        isValid: true,
        normalizedUrl: parsed.toString(),
        extractedUrlsCount: 1,
        platform: 'tiktok',
      };
    }

    return {
      isValid: false,
      errorMessage: 'Unsupported domain. Please provide a valid YouTube (Shorts/Videos) or TikTok link.',
    };
  } catch {
    return { isValid: false, errorMessage: 'The link is malformed or invalid.' };
  }
}

/**
 * Backward-compatible helper for existing TikTok URL verification.
 */
export function extractAndValidateTikTokUrl(rawInput: string): UrlValidationResult {
  const result = validateMediaUrl(rawInput);
  if (!result.isValid) {
    // If it was rejected because it's not a TikTok domain, preserve exact legacy message
    if (result.errorMessage && result.errorMessage.includes('Unsupported domain')) {
      return {
        isValid: false,
        errorMessage: 'Not a supported TikTok domain. Only official TikTok video links (e.g. tiktok.com, vm.tiktok.com) are accepted.',
      };
    }
    return result;
  }

  // If valid media URL but from another platform, reject for TikTok-only callers
  if (result.platform && result.platform !== 'tiktok') {
    return {
      isValid: false,
      errorMessage: 'Not a supported TikTok domain. Only official TikTok video links (e.g. tiktok.com, vm.tiktok.com) are accepted.',
    };
  }

  return result;
}
