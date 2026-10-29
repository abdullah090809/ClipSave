import {
  extractAndValidateTikTokUrl,
  validateMediaUrl,
  detectPlatform,
} from './urlValidator';

describe('extractAndValidateTikTokUrl', () => {
  test('valid standard tiktok video url', () => {
    const input = 'https://www.tiktok.com/@creativeuser/video/734891238910';
    const result = extractAndValidateTikTokUrl(input);
    expect(result.isValid).toBe(true);
    expect(result.normalizedUrl).toContain('tiktok.com/@creativeuser/video/734891238910');
  });

  test('valid shortened vm.tiktok.com link', () => {
    const input = 'https://vm.tiktok.com/ZM8rDq1s9/';
    const result = extractAndValidateTikTokUrl(input);
    expect(result.isValid).toBe(true);
    expect(result.normalizedUrl).toContain('vm.tiktok.com/ZM8rDq1s9');
  });

  test('valid url without protocol prepends https', () => {
    const input = 'vt.tiktok.com/ZM8rDq1s9/';
    const result = extractAndValidateTikTokUrl(input);
    expect(result.isValid).toBe(true);
    expect(result.normalizedUrl).toMatch(/^https:\/\/vt\.tiktok\.com/);
  });

  test('strips tracking query parameters (utm_source, fbclid)', () => {
    const input = 'https://www.tiktok.com/@user/video/12345?utm_source=copy&utm_medium=android&fbclid=abc123xyz';
    const result = extractAndValidateTikTokUrl(input);
    expect(result.isValid).toBe(true);
    expect(result.normalizedUrl).not.toContain('utm_source');
    expect(result.normalizedUrl).not.toContain('fbclid');
  });

  test('rejects lookalike phishing domains (e.g. tiktok.com.attacker.com)', () => {
    const input = 'https://tiktok.com.attacker.example/video/123';
    const result = extractAndValidateTikTokUrl(input);
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('Not a supported TikTok domain');
  });

  test('rejects evil prefixes (e.g. evil-tiktok.com)', () => {
    const input = 'https://evil-tiktok.com/@user/video/123';
    const result = extractAndValidateTikTokUrl(input);
    expect(result.isValid).toBe(false);
  });

  test('rejects embedded credentials in URL', () => {
    const input = 'https://admin:secret@www.tiktok.com/@user/video/123';
    const result = extractAndValidateTikTokUrl(input);
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('embedded credentials');
  });

  test('rejects dangerous protocols (file:, javascript:, intent:)', () => {
    expect(extractAndValidateTikTokUrl('javascript:alert(1)').isValid).toBe(false);
    expect(extractAndValidateTikTokUrl('file:///etc/passwd').isValid).toBe(false);
  });

  test('rejects multiple candidate URLs', () => {
    const input = 'Check this https://vm.tiktok.com/abc and also https://vm.tiktok.com/xyz';
    const result = extractAndValidateTikTokUrl(input);
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('Multiple links found');
  });

  test('extracts single URL embedded in casual prose', () => {
    const input = 'Hey look at this awesome clip https://vm.tiktok.com/ZM8rDq1s9/ it is great!';
    const result = extractAndValidateTikTokUrl(input);
    expect(result.isValid).toBe(true);
    expect(result.normalizedUrl).toContain('vm.tiktok.com/ZM8rDq1s9');
  });

  test('rejects empty or whitespace-only input', () => {
    expect(extractAndValidateTikTokUrl('').isValid).toBe(false);
    expect(extractAndValidateTikTokUrl('   ').isValid).toBe(false);
  });

  test('rejects control characters in input', () => {
    const input = 'https://www.tiktok.com/@user/video/123\x00\x08';
    const result = extractAndValidateTikTokUrl(input);
    expect(result.isValid).toBe(false);
  });
});

describe('detectPlatform', () => {
  test('detects TikTok links', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123').platform).toBe('tiktok');
    expect(detectPlatform('vm.tiktok.com/abc123/').platform).toBe('tiktok');
  });

  test('detects YouTube regular video links', () => {
    const res = detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(res.platform).toBe('youtube');
    expect(res.isShort).toBe(false);
  });

  test('detects YouTube Shorts links', () => {
    const res = detectPlatform('https://www.youtube.com/shorts/50_4S4kO_qA');
    expect(res.platform).toBe('youtube');
    expect(res.isShort).toBe(true);
  });

  test('detects youtu.be short links', () => {
    const res = detectPlatform('https://youtu.be/dQw4w9WgXcQ');
    expect(res.platform).toBe('youtube');
  });

  test('detects Instagram links (future)', () => {
    expect(detectPlatform('https://www.instagram.com/reel/C1234567/').platform).toBe('instagram');
  });

  test('detects Facebook links (future)', () => {
    expect(detectPlatform('https://www.facebook.com/watch/?v=123456').platform).toBe('facebook');
    expect(detectPlatform('https://fb.watch/abc123/').platform).toBe('facebook');
  });

  test('falls back to generic for unknown text', () => {
    expect(detectPlatform('hello world').platform).toBe('generic');
    expect(detectPlatform('').platform).toBe('generic');
  });
});

describe('validateMediaUrl', () => {
  test('validates YouTube watch URL and strips tracking query parameters', () => {
    const input = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ&feature=share&si=12345';
    const result = validateMediaUrl(input);
    expect(result.isValid).toBe(true);
    expect(result.platform).toBe('youtube');
    expect(result.isShort).toBe(false);
    expect(result.normalizedUrl).toContain('v=aqz-KE-bpKQ');
    expect(result.normalizedUrl).not.toContain('feature=share');
    expect(result.normalizedUrl).not.toContain('si=12345');
  });

  test('validates YouTube Shorts URL', () => {
    const input = 'https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share';
    const result = validateMediaUrl(input);
    expect(result.isValid).toBe(true);
    expect(result.platform).toBe('youtube');
    expect(result.isShort).toBe(true);
    expect(result.normalizedUrl).toContain('/shorts/dQw4w9WgXcQ');
  });

  test('validates youtu.be short URL', () => {
    const input = 'https://youtu.be/dQw4w9WgXcQ';
    const result = validateMediaUrl(input);
    expect(result.isValid).toBe(true);
    expect(result.platform).toBe('youtube');
    expect(result.normalizedUrl).toContain('youtu.be/dQw4w9WgXcQ');
  });

  test('rejects YouTube URL missing specific video reference', () => {
    const input = 'https://www.youtube.com/';
    const result = validateMediaUrl(input);
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('Please provide a link to a specific YouTube video');
  });

  test('validates TikTok URL', () => {
    const input = 'https://www.tiktok.com/@user/video/734891238910';
    const result = validateMediaUrl(input);
    expect(result.isValid).toBe(true);
    expect(result.platform).toBe('tiktok');
  });

  test('validates Instagram Reel and post links', () => {
    const reel = 'https://www.instagram.com/reel/C8q8q0_PzZg/?igsh=c3ZsdjM5';
    const resReel = validateMediaUrl(reel);
    expect(resReel.isValid).toBe(true);
    expect(resReel.platform).toBe('instagram');
    expect(resReel.isShort).toBe(true);
    expect(resReel.normalizedUrl).not.toContain('igsh=');

    const post = 'https://instagram.com/p/C8q8q0_PzZg/';
    const resPost = validateMediaUrl(post);
    expect(resPost.isValid).toBe(true);
    expect(resPost.platform).toBe('instagram');

    const root = 'https://www.instagram.com/';
    const resRoot = validateMediaUrl(root);
    expect(resRoot.isValid).toBe(false);
    expect(resRoot.errorMessage).toContain('Please provide a link to a specific Instagram');
  });

  test('validates Facebook Reel and video links', () => {
    const reel = 'https://www.facebook.com/reel/1022646279145698?mibextid=rS40aB7S9Ucbxw6v';
    const resReel = validateMediaUrl(reel);
    expect(resReel.isValid).toBe(true);
    expect(resReel.platform).toBe('facebook');
    expect(resReel.isShort).toBe(true);
    expect(resReel.normalizedUrl).not.toContain('mibextid=');

    const watch = 'https://www.facebook.com/watch/?v=123456';
    const resWatch = validateMediaUrl(watch);
    expect(resWatch.isValid).toBe(true);
    expect(resWatch.platform).toBe('facebook');

    const fbWatch = 'https://fb.watch/mX7d8E9v/';
    const resFbWatch = validateMediaUrl(fbWatch);
    expect(resFbWatch.isValid).toBe(true);
    expect(resFbWatch.platform).toBe('facebook');

    const root = 'https://www.facebook.com/';
    const resRoot = validateMediaUrl(root);
    expect(resRoot.isValid).toBe(false);
    expect(resRoot.errorMessage).toContain('Please provide a link to a specific Facebook');
  });
});
