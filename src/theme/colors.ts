import { ColorPalette, AccentColor } from '../types';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceBorder: string;
  // Material 3 Surface Hierarchy
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  // Outline tokens
  outline: string;
  outlineVariant: string;
  // Primary container tokens
  primaryContainer: string;
  onPrimaryContainer: string;
  // Text tokens
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  // Accent & Action
  primary: string;
  onPrimary: string;
  primaryBorder: string;
  primaryHover: string;
  primaryLight: string;
  accent: string;
  accentContainer: string;
  accentBorder: string;
  // Extra hues for variety (feature tiles, highlights)
  violet: string;
  violetContainer: string;
  pink: string;
  pinkContainer: string;
  // Status tokens
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  danger: string;
  onDanger: string;
  dangerLight: string;
  dangerBorder: string;
  // Form & TabBar
  inputBackground: string;
  inputBorder: string;
  tabBarBackground: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
  // Ripple & Feedback tokens
  ripple: string;
  ripplePrimary: string;
}

export const ACCENT_PRESETS: Record<
  AccentColor,
  {
    name: string;
    hex: string;
    hover: string;
    light: string;
    container: string;
    border: string;
    onAccent: string;
  }
> = {
  coral: {
    name: 'Coral',
    hex: '#FE2C55',
    hover: '#E02047',
    light: 'rgba(254, 44, 85, 0.12)',
    container: 'rgba(254, 44, 85, 0.16)',
    border: 'rgba(254, 44, 85, 0.35)',
    onAccent: '#FFFFFF',
  },
  blue: {
    name: 'Blue',
    hex: '#2563EB',
    hover: '#1D4ED8',
    light: 'rgba(37, 99, 235, 0.12)',
    container: 'rgba(37, 99, 235, 0.16)',
    border: 'rgba(37, 99, 235, 0.35)',
    onAccent: '#FFFFFF',
  },
  violet: {
    name: 'Violet',
    hex: '#8B5CF6',
    hover: '#7C3AED',
    light: 'rgba(139, 92, 246, 0.12)',
    container: 'rgba(139, 92, 246, 0.16)',
    border: 'rgba(139, 92, 246, 0.35)',
    onAccent: '#FFFFFF',
  },
  green: {
    name: 'Green',
    hex: '#10B981',
    hover: '#059669',
    light: 'rgba(16, 185, 129, 0.12)',
    container: 'rgba(16, 185, 129, 0.16)',
    border: 'rgba(16, 185, 129, 0.35)',
    onAccent: '#FFFFFF',
  },
  amber: {
    name: 'Amber',
    hex: '#F59E0B',
    hover: '#D97706',
    light: 'rgba(245, 158, 11, 0.12)',
    container: 'rgba(245, 158, 11, 0.16)',
    border: 'rgba(245, 158, 11, 0.35)',
    onAccent: '#FFFFFF',
  },
};

export const PALETTE_PRESETS: Record<
  ColorPalette,
  {
    name: string;
    description: string;
  }
> = {
  warm_light: {
    name: 'Warm Light',
    description: 'Warm off-white background with charcoal text and soft neutral borders.',
  },
  midnight: {
    name: 'Midnight',
    description: 'Deep obsidian charcoal with crisp near-white typography.',
  },
  sage: {
    name: 'Sage',
    description: 'Calm organic sage with soothing natural tones.',
  },
};

export function getThemeColors(
  isDark: boolean,
  palette: ColorPalette = 'warm_light',
  accentKey: AccentColor = 'coral'
): ThemeColors {
  const acc = ACCENT_PRESETS[accentKey] || ACCENT_PRESETS.coral;

  if (palette === 'midnight' || (isDark && palette !== 'warm_light' && palette !== 'sage')) {
    // Midnight Dark Palette
    if (isDark) {
      return {
        background: '#0D0F12',
        surface: '#14171D',
        surfaceElevated: '#1C2029',
        surfaceBorder: '#222732',
        surfaceContainerLowest: '#080A0D',
        surfaceContainerLow: '#0F1217',
        surfaceContainer: '#14171D',
        surfaceContainerHigh: '#1C2029',
        surfaceContainerHighest: '#252B37',
        outline: '#5F6775',
        outlineVariant: '#222732',
        primaryContainer: acc.container,
        onPrimaryContainer: '#FFFFFF',
        textPrimary: '#F4F6F8',
        textSecondary: '#8E96A4',
        textMuted: '#5F6775',
        primary: acc.hex,
        onPrimary: acc.onAccent,
        primaryBorder: acc.border,
        primaryHover: acc.hover,
        primaryLight: acc.light,
        accent: acc.hex,
        accentContainer: acc.container,
        accentBorder: acc.border,
        violet: '#A855F7',
        violetContainer: 'rgba(168, 85, 247, 0.14)',
        pink: '#F43F5E',
        pinkContainer: 'rgba(244, 63, 94, 0.14)',
        success: '#10B981',
        successLight: 'rgba(16, 185, 129, 0.15)',
        warning: '#F59E0B',
        warningLight: 'rgba(245, 158, 11, 0.15)',
        danger: '#EF4444',
        onDanger: '#FFFFFF',
        dangerLight: 'rgba(239, 68, 68, 0.15)',
        dangerBorder: 'rgba(239, 68, 68, 0.35)',
        inputBackground: '#14171D',
        inputBorder: '#222732',
        tabBarBackground: '#0D0F12',
        tabBarBorder: '#1E232E',
        tabBarActive: acc.hex,
        tabBarInactive: '#64748B',
        ripple: 'rgba(248, 250, 252, 0.08)',
        ripplePrimary: 'rgba(255, 255, 255, 0.25)',
      };
    } else {
      // Midnight in Light Mode
      return {
        background: '#F0F2F5',
        surface: '#FFFFFF',
        surfaceElevated: '#FFFFFF',
        surfaceBorder: '#D0D5DD',
        surfaceContainerLowest: '#FFFFFF',
        surfaceContainerLow: '#F4F6F8',
        surfaceContainer: '#FFFFFF',
        surfaceContainerHigh: '#E4E7EB',
        surfaceContainerHighest: '#D0D5DD',
        outline: '#667085',
        outlineVariant: '#D0D5DD',
        primaryContainer: acc.container,
        onPrimaryContainer: acc.hover,
        textPrimary: '#0D0F12',
        textSecondary: '#475467',
        textMuted: '#667085',
        primary: acc.hex,
        onPrimary: acc.onAccent,
        primaryBorder: acc.border,
        primaryHover: acc.hover,
        primaryLight: acc.light,
        accent: acc.hex,
        accentContainer: acc.container,
        accentBorder: acc.border,
        violet: '#7C3AED',
        violetContainer: 'rgba(124, 58, 237, 0.10)',
        pink: '#E11D48',
        pinkContainer: 'rgba(225, 29, 72, 0.10)',
        success: '#059669',
        successLight: 'rgba(5, 150, 105, 0.10)',
        warning: '#D97706',
        warningLight: 'rgba(217, 119, 6, 0.10)',
        danger: '#DC2626',
        onDanger: '#FFFFFF',
        dangerLight: 'rgba(220, 38, 38, 0.10)',
        dangerBorder: 'rgba(220, 38, 38, 0.35)',
        inputBackground: '#FFFFFF',
        inputBorder: '#D0D5DD',
        tabBarBackground: '#FFFFFF',
        tabBarBorder: '#E4E7EB',
        tabBarActive: acc.hex,
        tabBarInactive: '#667085',
        ripple: 'rgba(15, 23, 42, 0.06)',
        ripplePrimary: 'rgba(255, 255, 255, 0.25)',
      };
    }
  }

  if (palette === 'sage') {
    if (isDark) {
      // Sage Dark Mode
      return {
        background: '#0D1310',
        surface: '#141C18',
        surfaceElevated: '#1C2621',
        surfaceBorder: '#25332C',
        surfaceContainerLowest: '#080C0A',
        surfaceContainerLow: '#0F1612',
        surfaceContainer: '#141C18',
        surfaceContainerHigh: '#1C2621',
        surfaceContainerHighest: '#2B3B32',
        outline: '#5D7062',
        outlineVariant: '#25332C',
        primaryContainer: acc.container,
        onPrimaryContainer: '#FFFFFF',
        textPrimary: '#EEF3EF',
        textSecondary: '#8EA393',
        textMuted: '#5D7062',
        primary: acc.hex,
        onPrimary: acc.onAccent,
        primaryBorder: acc.border,
        primaryHover: acc.hover,
        primaryLight: acc.light,
        accent: acc.hex,
        accentContainer: acc.container,
        accentBorder: acc.border,
        violet: '#A855F7',
        violetContainer: 'rgba(168, 85, 247, 0.14)',
        pink: '#F43F5E',
        pinkContainer: 'rgba(244, 63, 94, 0.14)',
        success: '#10B981',
        successLight: 'rgba(16, 185, 129, 0.15)',
        warning: '#F59E0B',
        warningLight: 'rgba(245, 158, 11, 0.15)',
        danger: '#EF4444',
        onDanger: '#FFFFFF',
        dangerLight: 'rgba(239, 68, 68, 0.15)',
        dangerBorder: 'rgba(239, 68, 68, 0.35)',
        inputBackground: '#141C18',
        inputBorder: '#25332C',
        tabBarBackground: '#0D1310',
        tabBarBorder: '#1C2621',
        tabBarActive: acc.hex,
        tabBarInactive: '#5D7062',
        ripple: 'rgba(248, 250, 252, 0.08)',
        ripplePrimary: 'rgba(255, 255, 255, 0.25)',
      };
    } else {
      // Sage Light Mode
      return {
        background: '#F3F6F4',
        surface: '#FFFFFF',
        surfaceElevated: '#FFFFFF',
        surfaceBorder: '#DCE4DF',
        surfaceContainerLowest: '#FFFFFF',
        surfaceContainerLow: '#EBF1ED',
        surfaceContainer: '#FFFFFF',
        surfaceContainerHigh: '#E2ECE5',
        surfaceContainerHighest: '#DCE4DF',
        outline: '#758A7A',
        outlineVariant: '#DCE4DF',
        primaryContainer: acc.container,
        onPrimaryContainer: acc.hover,
        textPrimary: '#152018',
        textSecondary: '#495E4F',
        textMuted: '#758A7A',
        primary: acc.hex,
        onPrimary: acc.onAccent,
        primaryBorder: acc.border,
        primaryHover: acc.hover,
        primaryLight: acc.light,
        accent: acc.hex,
        accentContainer: acc.container,
        accentBorder: acc.border,
        violet: '#7C3AED',
        violetContainer: 'rgba(124, 58, 237, 0.10)',
        pink: '#E11D48',
        pinkContainer: 'rgba(225, 29, 72, 0.10)',
        success: '#059669',
        successLight: 'rgba(5, 150, 105, 0.10)',
        warning: '#D97706',
        warningLight: 'rgba(217, 119, 6, 0.10)',
        danger: '#DC2626',
        onDanger: '#FFFFFF',
        dangerLight: 'rgba(220, 38, 38, 0.10)',
        dangerBorder: 'rgba(220, 38, 38, 0.35)',
        inputBackground: '#FFFFFF',
        inputBorder: '#CBD7CF',
        tabBarBackground: '#F3F6F4',
        tabBarBorder: '#DCE4DF',
        tabBarActive: acc.hex,
        tabBarInactive: '#758A7A',
        ripple: 'rgba(15, 23, 42, 0.06)',
        ripplePrimary: 'rgba(255, 255, 255, 0.25)',
      };
    }
  }

  // Default: Warm Light Palette
  if (isDark) {
    return {
      background: '#181716',
      surface: '#222120',
      surfaceElevated: '#2C2B29',
      surfaceBorder: '#3A3835',
      surfaceContainerLowest: '#121110',
      surfaceContainerLow: '#1C1B1A',
      surfaceContainer: '#222120',
      surfaceContainerHigh: '#2E2D2B',
      surfaceContainerHighest: '#3A3835',
      outline: '#8C867F',
      outlineVariant: '#3A3835',
      primaryContainer: acc.container,
      onPrimaryContainer: '#FFFFFF',
      textPrimary: '#F5F2EC',
      textSecondary: '#A8A39C',
      textMuted: '#7A756E',
      primary: acc.hex,
      onPrimary: acc.onAccent,
      primaryBorder: acc.border,
      primaryHover: acc.hover,
      primaryLight: acc.light,
      accent: acc.hex,
      accentContainer: acc.container,
      accentBorder: acc.border,
      violet: '#A855F7',
      violetContainer: 'rgba(168, 85, 247, 0.14)',
      pink: '#F43F5E',
      pinkContainer: 'rgba(244, 63, 94, 0.14)',
      success: '#10B981',
      successLight: 'rgba(16, 185, 129, 0.15)',
      warning: '#F59E0B',
      warningLight: 'rgba(245, 158, 11, 0.15)',
      danger: '#EF4444',
      onDanger: '#FFFFFF',
      dangerLight: 'rgba(239, 68, 68, 0.15)',
      dangerBorder: 'rgba(239, 68, 68, 0.35)',
      inputBackground: '#222120',
      inputBorder: '#3A3835',
      tabBarBackground: '#181716',
      tabBarBorder: '#2C2B29',
      tabBarActive: acc.hex,
      tabBarInactive: '#7A756E',
      ripple: 'rgba(248, 250, 252, 0.08)',
      ripplePrimary: 'rgba(255, 255, 255, 0.25)',
    };
  }

  // Warm Light (Light Mode)
  return {
    background: '#FAF8F5',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceBorder: '#E5E0D8',
    surfaceContainerLowest: '#FFFFFF',
    surfaceContainerLow: '#F5F2EC',
    surfaceContainer: '#FFFFFF',
    surfaceContainerHigh: '#F0ECE4',
    surfaceContainerHighest: '#E5E0D8',
    outline: '#8C867F',
    outlineVariant: '#E5E0D8',
    primaryContainer: acc.container,
    onPrimaryContainer: acc.hover,
    textPrimary: '#1C1B1A',
    textSecondary: '#5C5854',
    textMuted: '#8C867F',
    primary: acc.hex,
    onPrimary: acc.onAccent,
    primaryBorder: acc.border,
    primaryHover: acc.hover,
    primaryLight: acc.light,
    accent: acc.hex,
    accentContainer: acc.container,
    accentBorder: acc.border,
    violet: '#7C3AED',
    violetContainer: 'rgba(124, 58, 237, 0.10)',
    pink: '#E11D48',
    pinkContainer: 'rgba(225, 29, 72, 0.10)',
    success: '#059669',
    successLight: 'rgba(5, 150, 105, 0.10)',
    warning: '#D97706',
    warningLight: 'rgba(217, 119, 6, 0.10)',
    danger: '#DC2626',
    onDanger: '#FFFFFF',
    dangerLight: 'rgba(220, 38, 38, 0.10)',
    dangerBorder: 'rgba(220, 38, 38, 0.35)',
    inputBackground: '#FFFFFF',
    inputBorder: '#DDD6CB',
    tabBarBackground: '#FAF8F5',
    tabBarBorder: '#E5E0D8',
    tabBarActive: acc.hex,
    tabBarInactive: '#8C867F',
    ripple: 'rgba(15, 23, 42, 0.06)',
    ripplePrimary: 'rgba(255, 255, 255, 0.25)',
  };
}

// Backward-compatible default themes
export const darkColors: ThemeColors = getThemeColors(true, 'midnight', 'coral');
export const lightColors: ThemeColors = getThemeColors(false, 'warm_light', 'coral');
