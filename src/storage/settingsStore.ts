import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { AppSettings } from '../types';

const SETTINGS_KEY = '@clipsave_settings_v1';

export function getDefaultBackendUrl(): string {
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }
  // When running in Expo Go or Dev Client on a physical phone,
  // Constants.expoConfig?.hostUri contains the dev machine's LAN IP (e.g. 192.168.1.50:8081).
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:8080`;
    }
  }
  return 'http://127.0.0.1:8080';
}

export const defaultSettings: AppSettings = {
  themeMode: 'system',
  autoDownloadOnResolve: false,
  saveToGallery: true,
  wifiOnly: false,
  maxConcurrentDownloads: 2,
  useMockResolver: false,
  backendBaseUrl: getDefaultBackendUrl(),
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
