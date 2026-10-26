import { sanitizeFilename } from './filenameSanitizer';

describe('sanitizeFilename', () => {
  test('sanitizes standard title with mp4 extension', () => {
    const input = 'My Fun Video';
    const output = sanitizeFilename(input);
    expect(output).toBe('My Fun Video.mp4');
  });

  test('removes illegal path traversal characters (/, \\, :, *, ?, ", <, >, |)', () => {
    const input = '..\\../etc/passwd:dangerous*file?name"test<1>2|3';
    const output = sanitizeFilename(input);
    expect(output).not.toContain('/');
    expect(output).not.toContain('\\');
    expect(output).not.toContain(':');
    expect(output).not.toContain('*');
    expect(output).not.toContain('?');
    expect(output).not.toContain('"');
    expect(output).not.toContain('<');
    expect(output).not.toContain('>');
    expect(output).not.toContain('|');
    expect(output.endsWith('.mp4')).toBe(true);
  });

  test('safely handles emojis and non-Latin unicode titles', () => {
    const input = '🔥 Amazing Dance Routine 💃 日本語';
    const output = sanitizeFilename(input);
    expect(output).toContain('🔥');
    expect(output).toContain('日本語');
    expect(output.endsWith('.mp4')).toBe(true);
  });

  test('handles Windows reserved device names (CON, PRN, AUX, NUL, COM1)', () => {
    const output = sanitizeFilename('CON');
    expect(output).toBe('CON_safe.mp4');
  });

  test('falls back to default prefix when title is empty or only whitespace', () => {
    const output = sanitizeFilename('   ');
    expect(output).toMatch(/^ClipSave_video_\d+\.mp4$/);
  });

  test('truncates excessively long titles to safe length', () => {
    const longTitle = 'a'.repeat(300);
    const output = sanitizeFilename(longTitle);
    expect(output.length).toBeLessThanOrEqual(130);
    expect(output.endsWith('.mp4')).toBe(true);
  });

  test('strips hashtags (#) and uri-breaking characters (% ? &) to prevent Android moveAsync rejection', () => {
    const input = '#datealive #animeedit #margakagenou #creatoranimeone #fyp';
    const output = sanitizeFilename(input);
    expect(output).not.toContain('#');
    expect(output).toBe('datealive animeedit margakagenou creatoranimeone fyp.mp4');
  });

  test('strips URI reserved and special characters from filename', () => {
    const input = '100% real video & audio? #trending + viral=yes';
    const output = sanitizeFilename(input);
    expect(output).not.toContain('%');
    expect(output).not.toContain('#');
    expect(output).not.toContain('?');
    expect(output).not.toContain('&');
    expect(output).not.toContain('+');
    expect(output).not.toContain('=');
    expect(output.endsWith('.mp4')).toBe(true);
  });
});
