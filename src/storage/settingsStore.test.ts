import { getSettings, saveSettings, defaultSettings, getDefaultBackendUrl } from './settingsStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('settingsStore', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  test('UT-SET-01: returns default settings when no preferences stored', async () => {
    const settings = await getSettings();
    expect(settings).toEqual(defaultSettings);
    expect(settings.themeMode).toBe('system');
    expect(settings.saveToGallery).toBe(true);
  });

  test('UT-SET-02: saveSettings merges partial updates and persists to storage', async () => {
    const updated = await saveSettings({ themeMode: 'dark', useMockResolver: true });
    expect(updated.themeMode).toBe('dark');
    expect(updated.useMockResolver).toBe(true);
    expect(updated.saveToGallery).toBe(true); // Untouched default preserved

    // Retrieve fresh from storage
    const retrieved = await getSettings();
    expect(retrieved.themeMode).toBe('dark');
    expect(retrieved.useMockResolver).toBe(true);
  });

  test('UT-SET-03: getDefaultBackendUrl returns valid default address', () => {
    const url = getDefaultBackendUrl();
    expect(url).toBeDefined();
    expect(url.startsWith('http')).toBe(true);
  });

  test('UT-SET-04: enableLaunchAnimation defaults to false and persists updates', async () => {
    const initial = await getSettings();
    expect(initial.enableLaunchAnimation).toBe(false);

    const enabled = await saveSettings({ enableLaunchAnimation: true });
    expect(enabled.enableLaunchAnimation).toBe(true);

    const fresh = await getSettings();
    expect(fresh.enableLaunchAnimation).toBe(true);

    const disabled = await saveSettings({ enableLaunchAnimation: false });
    expect(disabled.enableLaunchAnimation).toBe(false);

    const retrievedDisabled = await getSettings();
    expect(retrievedDisabled.enableLaunchAnimation).toBe(false);
  });
});
