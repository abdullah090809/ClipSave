import { formatBytes, formatDuration, formatDate } from './formatters';

describe('formatters', () => {
  describe('formatBytes', () => {
    test('formats bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1572864)).toBe('1.5 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
    });

    test('handles undefined and negative values honestly', () => {
      expect(formatBytes(undefined)).toBe('Unknown size');
      expect(formatBytes(-1)).toBe('Unknown size');
    });
  });

  describe('formatDuration', () => {
    test('formats seconds to MM:SS', () => {
      expect(formatDuration(0)).toBe('0:00');
      expect(formatDuration(59)).toBe('0:59');
      expect(formatDuration(65)).toBe('1:05');
      expect(formatDuration(184)).toBe('3:04');
    });

    test('handles undefined duration honestly', () => {
      expect(formatDuration(undefined)).toBe('Unknown duration');
    });
  });

  describe('formatDate', () => {
    test('formats valid ISO date', () => {
      const iso = '2026-05-14T10:30:00Z';
      const formatted = formatDate(iso);
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });
  });
});
