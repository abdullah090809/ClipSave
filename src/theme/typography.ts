import { TextStyle } from 'react-native';

export const typography = {
  // Material 3 / Android Display & Headlines
  display: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
    letterSpacing: -0.9,
  },
  headlineLarge: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.7,
  },
  headlineMedium: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    letterSpacing: -0.6,
  },
  h1: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    letterSpacing: -0.6,
  },
  h2: {
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 25,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  titleLarge: {
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 25,
  },
  titleMedium: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
  },
  titleSmall: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  bodyMedium: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  labelLarge: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: 0,
  },
  labelMedium: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
    letterSpacing: 0.1,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19,
  },
  captionMedium: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  micro: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  // Numbers that change (speed, percent, size) stay put instead of jittering
  numeric: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
} satisfies Record<string, TextStyle>;
