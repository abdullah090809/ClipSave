import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useColorScheme as useNativeColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeColors, getThemeColors, darkColors } from './colors';
import { ThemeMode, ColorPalette, AccentColor } from '../types';
import { getSettings, saveSettings } from '../storage/settingsStore';

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  palette: ColorPalette;
  setPalette: (palette: ColorPalette) => void;
  accentColor: AccentColor;
  setAccentColor: (accent: AccentColor) => void;
  isThemeReady: boolean;
}

const THEME_LEGACY_KEY = '@clipsave_theme_mode';

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkColors,
  isDark: true,
  themeMode: 'system',
  setThemeMode: () => {},
  palette: 'warm_light',
  setPalette: () => {},
  accentColor: 'coral',
  setAccentColor: () => {},
  isThemeReady: false,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useNativeColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [palette, setPaletteState] = useState<ColorPalette>('warm_light');
  const [accentColor, setAccentColorState] = useState<AccentColor>('coral');
  const [isThemeReady, setIsThemeReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const settings = await getSettings();
        if (isMounted) {
          if (settings.themeMode) setThemeModeState(settings.themeMode);
          if (settings.palette) setPaletteState(settings.palette);
          if (settings.accentColor) setAccentColorState(settings.accentColor);
        }
      } catch {
        // Fallback to legacy key if needed
        try {
          const savedLegacy = await AsyncStorage.getItem(THEME_LEGACY_KEY);
          if (isMounted && (savedLegacy === 'light' || savedLegacy === 'dark' || savedLegacy === 'system')) {
            setThemeModeState(savedLegacy);
          }
        } catch {}
      } finally {
        if (isMounted) {
          setIsThemeReady(true);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    saveSettings({ themeMode: mode }).catch(() => {});
    AsyncStorage.setItem(THEME_LEGACY_KEY, mode).catch(() => {});
  }, []);

  const setPalette = useCallback((p: ColorPalette) => {
    setPaletteState(p);
    saveSettings({ palette: p }).catch(() => {});
  }, []);

  const setAccentColor = useCallback((a: AccentColor) => {
    setAccentColorState(a);
    saveSettings({ accentColor: a }).catch(() => {});
  }, []);

  const isDark =
    themeMode === 'system'
      ? systemColorScheme === 'dark'
      : themeMode === 'dark';

  const colors = useMemo(() => {
    return getThemeColors(isDark, palette, accentColor);
  }, [isDark, palette, accentColor]);

  const value = useMemo(
    () => ({
      colors,
      isDark,
      themeMode,
      setThemeMode,
      palette,
      setPalette,
      accentColor,
      setAccentColor,
      isThemeReady,
    }),
    [colors, isDark, themeMode, setThemeMode, palette, setPalette, accentColor, setAccentColor, isThemeReady]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
