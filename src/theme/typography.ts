import { TextStyle } from 'react-native';

export const typography: Record<string, TextStyle> = {
  display: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  h1: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  h3: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
  },
  bodyMedium: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  captionMedium: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  micro: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
};
