import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { AppSettings } from '../types';

const SETTINGS_KEY = '@clipsave_settings_v1';

export function getDefaultBackendUrl(): string {
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }

  // 1. Check Constants.expoConfig?.hostUri
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:8080`;
    }
  }

  // 2. Check Constants.expoGoConfig?.debuggerHost (Expo Go runtime)
  const debuggerHost = (Constants as any).expoGoConfig?.debuggerHost;
  if (debuggerHost) {
    const ip = String(debuggerHost).split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:8080`;
    }
  }

  // 3. Check Constants.linkingUri (e.g. "exp://192.168.1.21:8081" or "http://192.168.1.21:8081")
  const linkingUri = (Constants as any).linkingUri;
  if (linkingUri && typeof linkingUri === 'string') {
    const match = linkingUri.match(/^[a-zA-Z]+:\/\/([^:/]+)/);
    if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
      return `http://${match[1]}:8080`;
    }
  }

  // 4. Check legacy manifest debuggerHost
  const legacyHost =
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
  if (legacyHost) {
    const ip = String(legacyHost).split(':')[0];
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
  enableLaunchAnimation: false,
};

export const getSettings = async (): Promise<AppSettings> => {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    const dynamicDefaultUrl = getDefaultBackendUrl();
    if (!raw) return { ...defaultSettings, backendBaseUrl: dynamicDefaultUrl };
    const parsed = JSON.parse(raw);
    const settings = { ...defaultSettings, ...parsed };

    // Self-healing migration: if the stored URL is loopback (127.0.0.1 or localhost),
    // but the current environment provides a non-loopback LAN IP (e.g. 192.168.1.21),
    // update the stored URL so the phone connects to the host PC!
    if (
      (settings.backendBaseUrl.includes('127.0.0.1') || settings.backendBaseUrl.includes('localhost')) &&
      !dynamicDefaultUrl.includes('127.0.0.1') &&
      !dynamicDefaultUrl.includes('localhost')
    ) {
      settings.backendBaseUrl = dynamicDefaultUrl;
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => {});
    }

    return settings;
  } catch {
    return { ...defaultSettings, backendBaseUrl: getDefaultBackendUrl() };
  }
};

export const saveSettings = async (settings: Partial<AppSettings>): Promise<AppSettings> => {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  return updated;
};
