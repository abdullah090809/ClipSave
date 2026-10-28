/**
 * Measures real download speed from successive byte counts. Smoothed with an
 * exponential moving average so the number does not flicker on every tick.
 */
export interface SpeedTracker {
  /** Feed the latest byte count; returns smoothed bytes/second (0 until two samples). */
  update(bytes: number, nowMs: number): number;
  reset(): void;
}

export function createSpeedTracker(smoothing = 0.3): SpeedTracker {
  let lastBytes: number | null = null;
  let lastTime = 0;
  let speed = 0;

  return {
    update(bytes, nowMs) {
      if (lastBytes === null || bytes < lastBytes) {
        // First sample, or the file restarted: nothing to compare against.
        lastBytes = bytes;
        lastTime = nowMs;
        speed = 0;
        return 0;
      }
      const dt = (nowMs - lastTime) / 1000;
      if (dt < 0.25) return speed; // too soon for a stable reading
      const instant = (bytes - lastBytes) / dt;
      speed = speed === 0 ? instant : speed + smoothing * (instant - speed);
      lastBytes = bytes;
      lastTime = nowMs;
      return speed;
    },
    reset() {
      lastBytes = null;
      lastTime = 0;
      speed = 0;
    },
  };
}
