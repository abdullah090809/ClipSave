import { requireNativeModule } from 'expo';

/**
 * Links shared to ClipSave from other apps (Android share sheet).
 * The native side lives in modules/clipsave-muxer (ClipSaveShareModule). It only exists in a
 * built APK, so every call here quietly does nothing in Expo Go or in an older build.
 */
interface ClipSaveShareNative {
  getInitialSharedText(): string | null;
  addListener(eventName: 'onSharedText', listener: (event: { text?: string }) => void): { remove(): void };
}

let cached: ClipSaveShareNative | null | undefined;

function getNative(): ClipSaveShareNative | null {
  if (cached === undefined) {
    try {
      cached = requireNativeModule<ClipSaveShareNative>('ClipSaveShare');
    } catch {
      cached = null;
    }
  }
  return cached;
}

/**
 * Shared text is often "Watch this! https://..." and not just the link. Returns the first
 * http(s) link in it (without trailing punctuation), or the trimmed text if it has no link.
 */
export function extractSharedUrl(text: string | null | undefined): string | null {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/https?:\/\/[^\s]+/i);
  if (match) return match[0].replace(/[.,!?;:)>\]]+$/, '');
  return trimmed;
}

/** The link that opened the app from the share sheet, if any. Each share is returned once. */
export function getInitialSharedUrl(): string | null {
  try {
    return extractSharedUrl(getNative()?.getInitialSharedText());
  } catch {
    return null;
  }
}

/** Calls back when a link is shared while the app is already open. Returns an unsubscribe function. */
export function subscribeToSharedUrls(onUrl: (url: string) => void): () => void {
  try {
    const native = getNative();
    if (!native) return () => {};
    const subscription = native.addListener('onSharedText', (event) => {
      const url = extractSharedUrl(event?.text);
      if (url) onUrl(url);
    });
    return () => {
      try {
        subscription.remove();
      } catch {
        // already removed
      }
    };
  } catch {
    return () => {};
  }
}
