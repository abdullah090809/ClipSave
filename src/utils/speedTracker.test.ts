import { createSpeedTracker } from './speedTracker';
import { formatSpeed, formatEta } from './formatters';

describe('speedTracker', () => {
  test('returns 0 on the first sample', () => {
    expect(createSpeedTracker().update(0, 1000)).toBe(0);
  });

  test('measures bytes per second between samples', () => {
    const t = createSpeedTracker();
    t.update(0, 0);
    expect(t.update(1_000_000, 1000)).toBe(1_000_000);
  });

  test('smooths changes in speed', () => {
    const t = createSpeedTracker(0.5);
    t.update(0, 0);
    t.update(1000, 1000); // 1000 B/s
    expect(t.update(3000, 2000)).toBe(1500); // instant 2000, halfway
  });

  test('ignores samples that arrive too quickly', () => {
    const t = createSpeedTracker();
    t.update(0, 0);
    t.update(1000, 1000);
    expect(t.update(5000, 1100)).toBe(1000);
  });

  test('restarts when bytes go backwards', () => {
    const t = createSpeedTracker();
    t.update(0, 0);
    t.update(5000, 1000);
    expect(t.update(100, 2000)).toBe(0);
  });
});

describe('speed and ETA formatting', () => {
  test('formatSpeed', () => {
    expect(formatSpeed(3355443)).toBe('3.2 MB/s');
    expect(formatSpeed(0)).toBe('0 KB/s');
  });
  test('formatEta', () => {
    expect(formatEta(4)).toBe('0:04');
    expect(formatEta(65)).toBe('1:05');
    expect(formatEta(3909)).toBe('1:05:09');
    expect(formatEta(undefined)).toBe('');
  });
});
