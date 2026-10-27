import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useColorScheme as useNativeColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeColors, darkColors, lightColors } from './colors';
import { ThemeMode } from '../types';

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isThemeReady: boolean;
}

const THEME_STORAGE_KEY = '@clipsave_theme_mode';

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkColors,
  isDark: true,
  themeMode: 'system',
  setThemeMode: () => {},
  isThemeReady: false,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useNativeColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isThemeReady, setIsThemeReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setThemeModeState(saved);
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsThemeReady(true);
      });
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {});
  }, []);

  const isDark =
    themeMode === 'system'
      ? systemColorScheme === 'dark'
      : themeMode === 'dark';

  const colors = isDark ? darkColors : lightColors;

  const value = useMemo(
    () => ({ colors, isDark, themeMode, setThemeMode, isThemeReady }),
    [colors, isDark, themeMode, setThemeMode, isThemeReady]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
