import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings } from '../types';

const SETTINGS_KEY = '@clipsave_settings_v1';

export const SNAPDEPLOY_BACKEND_URL = 'https://clipsave-96518.containers.snapdeploy.app';

// Active default endpoint for production resolution
export const PRODUCTION_BACKEND_URL = SNAPDEPLOY_BACKEND_URL;

export function getDefaultBackendUrl(): string {
  // 1. Explicit environment variable configuration
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envUrl && envUrl.trim() && !envUrl.includes('ngrok-free.app')) {
    return envUrl.trim().replace(/\/$/, '');
  }

  // 2. Default to active deployed backend
  return PRODUCTION_BACKEND_URL;
}

export const defaultSettings: AppSettings = {
  themeMode: 'system',
  palette: 'warm_light',
  accentColor: 'coral',
  startupAnimation: 'standard',
  defaultQuality: '1080p',
  autoDownloadOnResolve: false,
  saveToGallery: true,
  wifiOnly: false,
  maxConcurrentDownloads: 2,
  useMockResolver: false,
  backendBaseUrl: getDefaultBackendUrl(),
  enableLaunchAnimation: true,
};

let memoryCache: AppSettings = { ...defaultSettings };

export const getCachedSettings = (): AppSettings => {
  return memoryCache;
};

export const getSettings = async (): Promise<AppSettings> => {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    const dynamicDefaultUrl = getDefaultBackendUrl();
    if (!raw) {
      memoryCache = { ...defaultSettings, backendBaseUrl: dynamicDefaultUrl };
      return memoryCache;
    }
    const parsed = JSON.parse(raw);
    const migratedStartupAnimation =
      parsed.startupAnimation ||
      (parsed.enableLaunchAnimation === false ? 'off' : 'standard');

    const settings: AppSettings = {
      ...defaultSettings,
      ...parsed,
      startupAnimation: migratedStartupAnimation,
      palette: parsed.palette || defaultSettings.palette,
      accentColor: parsed.accentColor || defaultSettings.accentColor,
    };

    // Self-healing migration: if the stored URL is a local address or an expired ngrok tunnel,
    // and the active default URL is a production HTTPS endpoint, update stored URL to the deployed backend
    const isStoredEphemeral =
      settings.backendBaseUrl.includes('127.0.0.1') ||
      settings.backendBaseUrl.includes('localhost') ||
      settings.backendBaseUrl.includes('192.168.') ||
      settings.backendBaseUrl.includes('10.') ||
      settings.backendBaseUrl.includes('172.') ||
      settings.backendBaseUrl.includes('ngrok-free.app');

    const isDefaultDeployed = dynamicDefaultUrl.startsWith('https://');

    if (isStoredEphemeral && isDefaultDeployed) {
      settings.backendBaseUrl = dynamicDefaultUrl;
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => {});
    }

    memoryCache = settings;
    return settings;
  } catch {
    memoryCache = { ...defaultSettings, backendBaseUrl: getDefaultBackendUrl() };
    return memoryCache;
  }
};

export const saveSettings = async (settings: Partial<AppSettings>): Promise<AppSettings> => {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  memoryCache = updated;
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  return updated;
};
