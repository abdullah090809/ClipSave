export interface UrlValidationResult {
  isValid: boolean;
  normalizedUrl?: string;
  errorMessage?: string;
  extractedUrlsCount?: number;
}

// Strict allowlist of legitimate TikTok hostnames
const ALLOWED_TIKTOK_HOSTS = new Set([
  'tiktok.com',
  'www.tiktok.com',
  'm.tiktok.com',
  'vm.tiktok.com',
  'vt.tiktok.com',
  'v.douyin.com',
]);

const MAX_URL_LENGTH = 2048;

export function extractAndValidateTikTokUrl(rawInput: string): UrlValidationResult {
  if (!rawInput || typeof rawInput !== 'string') {
    return { isValid: false, errorMessage: 'Please enter or paste a valid TikTok link.' };
  }

  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { isValid: false, errorMessage: 'Please enter or paste a valid TikTok link.' };
  }

  if (trimmed.length > MAX_URL_LENGTH) {
    return { isValid: false, errorMessage: 'Input is too long. Please provide a standard URL.' };
  }

  // Check for control characters
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

    // Reject non-http(s) schemes immediately (e.g. file:, javascript:, intent:)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { isValid: false, errorMessage: 'Only HTTPS and HTTP links are supported.' };
    }

    // Reject URLs with embedded credentials (user:pass@host)
    if (parsed.username || parsed.password) {
      return { isValid: false, errorMessage: 'URLs with embedded credentials are not permitted.' };
    }

    // Hostname check: exact match against allowlist
    const hostname = parsed.hostname.toLowerCase();

    // Reject lookalikes like tiktok.com.evil.com or evil-tiktok.com
    let isAllowed = false;
    for (const allowedHost of ALLOWED_TIKTOK_HOSTS) {
      if (hostname === allowedHost) {
        isAllowed = true;
        break;
      }
    }

    if (!isAllowed) {
      return {
        isValid: false,
        errorMessage: 'Not a supported TikTok domain. Only official TikTok video links (e.g. tiktok.com, vm.tiktok.com) are accepted.',
      };
    }

    // Path check: make sure there is a path component
    if (!parsed.pathname || parsed.pathname === '/') {
      return { isValid: false, errorMessage: 'URL must point to a specific video or share link.' };
    }

    // Strip aggressive tracking query parameters, but preserve essential video IDs or tokens
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'];
    trackingParams.forEach((p) => parsed.searchParams.delete(p));

    return {
      isValid: true,
      normalizedUrl: parsed.toString(),
      extractedUrlsCount: 1,
    };
  } catch {
    return { isValid: false, errorMessage: 'The link is malformed or invalid.' };
  }
}
