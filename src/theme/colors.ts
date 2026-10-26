export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryHover: string;
  primaryLight: string;
  accent: string;
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  danger: string;
  dangerLight: string;
  inputBackground: string;
  inputBorder: string;
  tabBarBackground: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
}

export const darkColors: ThemeColors = {
  background: '#090D16',       // Deepest Slate
  surface: '#0F172A',          // Slate-900
  surfaceElevated: '#1E293B',  // Slate-800
  surfaceBorder: '#334155',    // Slate-700
  textPrimary: '#F8FAFC',      // Slate-50
  textSecondary: '#CBD5E1',    // Slate-300
  textMuted: '#64748B',        // Slate-500
  primary: '#06B6D4',          // Cyan-500
  primaryHover: '#0891B2',     // Cyan-600
  primaryLight: 'rgba(6, 182, 212, 0.15)',
  accent: '#38BDF8',           // Sky-400
  success: '#10B981',          // Emerald-500
  successLight: 'rgba(16, 185, 129, 0.15)',
  warning: '#F59E0B',          // Amber-500
  warningLight: 'rgba(245, 158, 11, 0.15)',
  danger: '#F43F5E',           // Rose-500
  dangerLight: 'rgba(244, 63, 94, 0.15)',
  inputBackground: '#131D31',
  inputBorder: '#29384F',
  tabBarBackground: '#0F172A',
  tabBarBorder: '#1E293B',
  tabBarActive: '#06B6D4',
  tabBarInactive: '#64748B',
};

export const lightColors: ThemeColors = {
  background: '#F8FAFC',       // Slate-50
  surface: '#FFFFFF',          // Pure White
  surfaceElevated: '#F1F5F9',  // Slate-100
  surfaceBorder: '#E2E8F0',    // Slate-200
  textPrimary: '#0F172A',      // Slate-900
  textSecondary: '#334155',    // Slate-700
  textMuted: '#64748B',        // Slate-500
  primary: '#0891B2',          // Cyan-600 (Darker for AA contrast on white)
  primaryHover: '#0E7490',     // Cyan-700
  primaryLight: 'rgba(8, 145, 178, 0.1)',
  accent: '#0284C7',           // Sky-600
  success: '#059669',          // Emerald-600
  successLight: 'rgba(5, 150, 105, 0.1)',
  warning: '#D97706',          // Amber-600
  warningLight: 'rgba(217, 119, 6, 0.1)',
  danger: '#E11D48',           // Rose-600
  dangerLight: 'rgba(225, 29, 72, 0.1)',
  inputBackground: '#FFFFFF',
  inputBorder: '#CBD5E1',
  tabBarBackground: '#FFFFFF',
  tabBarBorder: '#E2E8F0',
  tabBarActive: '#0891B2',
  tabBarInactive: '#94A3B8',
};
