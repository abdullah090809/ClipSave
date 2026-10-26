import { extractAndValidateTikTokUrl } from './urlValidator';

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
