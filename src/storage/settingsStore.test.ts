import { getSettings, saveSettings, defaultSettings, getDefaultBackendUrl, PRODUCTION_BACKEND_URL } from './settingsStore';
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
    expect(url.startsWith('https://')).toBe(true);
  });

  test('UT-SET-03B: migrates stored local URL to production deployed URL', async () => {
    // Seed storage with an old local backend IP from earlier development
    await AsyncStorage.setItem(
      '@clipsave_settings_v1',
      JSON.stringify({ ...defaultSettings, backendBaseUrl: 'http://192.168.1.21:8080' })
    );

    const settings = await getSettings();
    expect(settings.backendBaseUrl).toBe(PRODUCTION_BACKEND_URL);
  });

  test('UT-SET-03C: migrates stored ephemeral ngrok URL to production deployed URL', async () => {
    await AsyncStorage.setItem(
      '@clipsave_settings_v1',
      JSON.stringify({ ...defaultSettings, backendBaseUrl: 'https://expired-tunnel-123.ngrok-free.app' })
    );

    const settings = await getSettings();
    expect(settings.backendBaseUrl).toBe(PRODUCTION_BACKEND_URL);
  });

  test('UT-SET-04: enableLaunchAnimation defaults to true and persists updates', async () => {
    const initial = await getSettings();
    expect(initial.enableLaunchAnimation).toBe(true);

    const disabled = await saveSettings({ enableLaunchAnimation: false });
    expect(disabled.enableLaunchAnimation).toBe(false);

    const fresh = await getSettings();
    expect(fresh.enableLaunchAnimation).toBe(false);

    const reenabled = await saveSettings({ enableLaunchAnimation: true });
    expect(reenabled.enableLaunchAnimation).toBe(true);

    const retrievedReenabled = await getSettings();
    expect(retrievedReenabled.enableLaunchAnimation).toBe(true);
  });

  test('UT-SET-05: startupAnimation defaults to standard and persists off/subtle/standard', async () => {
    const initial = await getSettings();
    expect(initial.startupAnimation).toBe('standard');

    const subtle = await saveSettings({ startupAnimation: 'subtle' });
    expect(subtle.startupAnimation).toBe('subtle');

    const off = await saveSettings({ startupAnimation: 'off' });
    expect(off.startupAnimation).toBe('off');

    const retrieved = await getSettings();
    expect(retrieved.startupAnimation).toBe('off');
  });

  test('UT-SET-06: palette and accentColor default and persist correctly', async () => {
    const initial = await getSettings();
    expect(initial.palette).toBe('warm_light');
    expect(initial.accentColor).toBe('coral');

    const updated = await saveSettings({ palette: 'midnight', accentColor: 'blue' });
    expect(updated.palette).toBe('midnight');
    expect(updated.accentColor).toBe('blue');

    const fresh = await getSettings();
    expect(fresh.palette).toBe('midnight');
    expect(fresh.accentColor).toBe('blue');
  });
});
