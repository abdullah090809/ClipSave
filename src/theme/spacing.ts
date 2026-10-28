export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  touchTargetMin: 48, // Guaranteed WCAG AA 48dp touch target
} as const;

// Layout rhythm: use these instead of one-off numbers so every screen breathes the same.
export const layout = {
  gutter: 20,       // left/right screen padding
  section: 32,      // gap between major sections on a screen
  card: 20,         // padding inside a primary card
  cardCompact: 16,  // padding inside list rows / small cards
  stack: 12,        // gap between sibling cards or rows
  inline: 8,        // gap between icon+label, chips, buttons in a row
  control: 56,      // input / primary button height
  iconButton: 44,   // minimum round icon button
} as const;

// One icon scale for the whole app (Ionicons).
export const iconSize = {
  xs: 14,   // inline with captions, chips
  sm: 16,   // inline with body text, small controls
  md: 20,   // header buttons, list actions
  lg: 24,   // tab bar, sheet actions, back arrows
  xl: 32,   // feature tiles
  hero: 40, // empty states
} as const;

export const borderRadius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  full: 9999,
} as const;

export const elevation = {
  level0: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  level1: {
    shadowColor: '#02090B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 1,
  },
  level2: {
    shadowColor: '#02090B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 3,
  },
  level3: {
    shadowColor: '#02090B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 6,
  },
} as const;
