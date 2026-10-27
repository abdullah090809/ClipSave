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
  primaryHover: string;
  primaryLight: string;
  accent: string;
  // Status tokens
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  danger: string;
  dangerLight: string;
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

export const darkColors: ThemeColors = {
  background: '#010101',       // TikTok Pitch Black
  surface: '#121212',          // TikTok Surface Charcoal
  surfaceElevated: '#1E1E1E',  // Elevated Card
  surfaceBorder: '#282828',    // Crisp Outline
  surfaceContainerLowest: '#000000',
  surfaceContainerLow: '#0A0A0A',
  surfaceContainer: '#161616', // Main Card Container
  surfaceContainerHigh: '#202020',
  surfaceContainerHighest: '#2C2C2C',
  outline: '#404040',
  outlineVariant: '#222222',
  primaryContainer: 'rgba(254, 44, 85, 0.16)',
  onPrimaryContainer: '#FE2C55',
  textPrimary: '#FFFFFF',      // Crisp White
  textSecondary: '#A6A7AB',    // TikTok Neutral Slate
  textMuted: '#73747B',        // Muted Caption
  primary: '#FE2C55',          // TikTok Signature Neon Red / Pink
  primaryHover: '#E0264B',
  primaryLight: 'rgba(254, 44, 85, 0.14)',
  accent: '#25F4EE',           // TikTok Vibrant Aqua / Cyan
  success: '#00E676',          // Bright Emerald
  successLight: 'rgba(0, 230, 118, 0.15)',
  warning: '#FFAB00',          // Amber
  warningLight: 'rgba(255, 171, 0, 0.15)',
  danger: '#FE2C55',           // TikTok Red
  dangerLight: 'rgba(254, 44, 85, 0.15)',
  inputBackground: '#121212',
  inputBorder: '#262626',
  tabBarBackground: '#010101',
  tabBarBorder: '#1A1A1A',
  tabBarActive: '#FE2C55',     // TikTok Red Active Indicator
  tabBarInactive: '#8A8B91',
  ripple: 'rgba(255, 255, 255, 0.08)',
  ripplePrimary: 'rgba(254, 44, 85, 0.25)',
};

export const lightColors: ThemeColors = {
  background: '#FFFFFF',       // Clean White
  surface: '#F8F8F8',          // Light Neutral
  surfaceElevated: '#F1F1F2',  // Elevated Surface
  surfaceBorder: '#E3E3E4',    // Light Border
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#FAFAFA',
  surfaceContainer: '#F1F1F2',
  surfaceContainerHigh: '#E8E8E9',
  surfaceContainerHighest: '#DFDFE0',
  outline: '#C5C6C9',
  outlineVariant: '#E8E8E9',
  primaryContainer: 'rgba(254, 44, 85, 0.10)',
  onPrimaryContainer: '#FE2C55',
  textPrimary: '#161823',      // TikTok Dark Primary
  textSecondary: '#5E6068',    // TikTok Mid Slate
  textMuted: '#8A8B91',        // TikTok Muted Text
  primary: '#FE2C55',          // TikTok Signature Red / Pink
  primaryHover: '#E0264B',
  primaryLight: 'rgba(254, 44, 85, 0.08)',
  accent: '#00C8C2',           // TikTok Aqua calibrated for high contrast on light
  success: '#00B074',
  successLight: 'rgba(0, 176, 116, 0.12)',
  warning: '#F59E0B',
  warningLight: 'rgba(245, 158, 11, 0.12)',
  danger: '#FE2C55',
  dangerLight: 'rgba(254, 44, 85, 0.12)',
  inputBackground: '#F8F8F8',
  inputBorder: '#E3E3E4',
  tabBarBackground: '#FFFFFF',
  tabBarBorder: '#EFEFEF',
  tabBarActive: '#FE2C55',
  tabBarInactive: '#8A8B91',
  ripple: 'rgba(0, 0, 0, 0.05)',
  ripplePrimary: 'rgba(254, 44, 85, 0.15)',
};
