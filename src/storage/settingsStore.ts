import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings } from '../types';

const SETTINGS_KEY = '@clipsave_settings_v1';

export const defaultSettings: AppSettings = {
  themeMode: 'system',
  autoDownloadOnResolve: false,
  saveToGallery: true,
  wifiOnly: false,
  maxConcurrentDownloads: 2,
  useMockResolver: false,
  backendBaseUrl: 'http://127.0.0.1:8080',
};

export const getSettings = async (): Promise<AppSettings> => {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw);
    return { ...defaultSettings, ...parsed };
  } catch {
    return defaultSettings;
  }
};

export const saveSettings = async (settings: Partial<AppSettings>): Promise<AppSettings> => {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  return updated;
};
