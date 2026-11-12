const mockListeners: Array<(e: { text?: string }) => void> = [];
let mockInitial: string | null = null;
let mockThrow = false;

jest.mock('expo', () => ({
  requireNativeModule: () => {
    if (mockThrow) throw new Error('not available');
    return {
      getInitialSharedText: () => mockInitial,
      addListener: (_name: string, cb: (e: { text?: string }) => void) => {
        mockListeners.push(cb);
        return { remove: () => mockListeners.splice(mockListeners.indexOf(cb), 1) };
      },
    };
  },
}));

import { extractSharedUrl } from './shareIntent';

describe('extractSharedUrl', () => {
  test('pulls the link out of surrounding share text', () => {
    expect(extractSharedUrl('Watch this! https://youtu.be/O51JbL6nA48?si=abc thanks')).toBe(
      'https://youtu.be/O51JbL6nA48?si=abc'
    );
  });
  test('strips trailing punctuation', () => {
    expect(extractSharedUrl('see https://www.facebook.com/share/1Coi6j2N4R/.')).toBe(
      'https://www.facebook.com/share/1Coi6j2N4R/'
    );
  });
  test('keeps a plain link as is, and the text when there is no link', () => {
    expect(extractSharedUrl('https://vt.tiktok.com/ZSabc/')).toBe('https://vt.tiktok.com/ZSabc/');
    expect(extractSharedUrl('  just some words ')).toBe('just some words');
  });
  test('returns null for empty input', () => {
    expect(extractSharedUrl('')).toBeNull();
    expect(extractSharedUrl('   ')).toBeNull();
    expect(extractSharedUrl(null)).toBeNull();
    expect(extractSharedUrl(undefined)).toBeNull();
  });
});

describe('native bridge', () => {
  beforeEach(() => {
    jest.resetModules();
    mockListeners.length = 0;
    mockInitial = null;
    mockThrow = false;
  });

  test('reads the share that opened the app', () => {
    mockInitial = 'Look: https://youtube.com/shorts/CKprBAODpX4';
    const { getInitialSharedUrl } = require('./shareIntent');
    expect(getInitialSharedUrl()).toBe('https://youtube.com/shorts/CKprBAODpX4');
  });

  test('passes on shares that arrive while the app is open, and can unsubscribe', () => {
    const { subscribeToSharedUrls } = require('./shareIntent');
    const seen: string[] = [];
    const stop = subscribeToSharedUrls((u: string) => seen.push(u));
    mockListeners[0]!({ text: 'x https://vt.tiktok.com/ZSabc/' });
    expect(seen).toEqual(['https://vt.tiktok.com/ZSabc/']);
    stop();
    expect(mockListeners).toHaveLength(0);
  });

  test('does nothing when the native module is missing (Expo Go, old build)', () => {
    mockThrow = true;
    const { getInitialSharedUrl, subscribeToSharedUrls } = require('./shareIntent');
    expect(getInitialSharedUrl()).toBeNull();
    expect(typeof subscribeToSharedUrls(() => {})).toBe('function');
  });
});
