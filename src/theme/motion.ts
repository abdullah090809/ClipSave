import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing } from 'react-native';

/** One set of timings so every animation in the app feels related. */
export const motion = {
  duration: {
    press: 110,
    fast: 160,
    base: 240,
    slow: 360,
    progress: 450,
  },
  easing: {
    /** Decelerate: things arriving on screen. */
    enter: Easing.bezier(0.2, 0, 0, 1),
    /** Symmetric: things moving between two resting places. */
    move: Easing.bezier(0.4, 0, 0.2, 1),
  },
  /** Entrance offset in dp (items rise this far while fading in). */
  rise: 12,
  /** Delay between sibling entrances, and how many siblings are staggered. */
  stagger: 45,
  maxStagger: 6,
  /** Scale while a control is held down. */
  pressScale: 0.97,
} as const;

// Cached system "Reduce motion" setting, readable synchronously.
let reduceMotion = false;
const listeners = new Set<(v: boolean) => void>();

function setReduceMotion(v: boolean) {
  reduceMotion = v;
  listeners.forEach((l) => l(v));
}

try {
  AccessibilityInfo.isReduceMotionEnabled?.()
    .then(setReduceMotion)
    .catch(() => undefined);
  AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
} catch {
  // Accessibility API unavailable (e.g. test env): default to full motion.
}

export function isReduceMotion(): boolean {
  return reduceMotion;
}

/** True when the user asked the OS to reduce animation. */
export function useReducedMotion(): boolean {
  const [value, setValue] = useState(reduceMotion);
  useEffect(() => {
    listeners.add(setValue);
    setValue(reduceMotion);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}
