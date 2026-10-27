import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Switch,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { Button } from '../../src/components/Button';
import {
  getSettings,
  saveSettings,
  getCachedSettings,
  getDefaultBackendUrl,
} from '../../src/storage/settingsStore';
import { cleanOrphanedTempFiles } from '../../src/services/mediaManager';
import { clearHistoryEntriesOnly, clearHistoryAndFiles } from '../../src/storage/historyStore';
import { AppSettings, ThemeMode } from '../../src/types';

export default function SettingsScreen() {
  const { colors, themeMode, setThemeMode } = useTheme();
  const router = useRouter();

  // Synchronously initialize with memory cache — NEVER renders null, eliminating the 1s flash!
  const [settings, setSettings] = useState<AppSettings>(() => getCachedSettings());
  const [urlInput, setUrlInput] = useState(() => getCachedSettings().backendBaseUrl);
  const [editingUrl, setEditingUrl] = useState(false);
  const [pingStatus, setPingStatus] = useState<'idle' | 'checking' | 'online' | 'offline'>('idle');

  useEffect(() => {
    // Background sync from persistent storage
    getSettings().then((s) => {
      setSettings(s);
      if (!editingUrl) {
        setUrlInput(s.backendBaseUrl);
      }
    });
  }, [editingUrl]);

  const updateSetting = useCallback(async (patch: Partial<AppSettings>) => {
    const updated = await saveSettings(patch);
    setSettings(updated);
  }, []);

  const handleTestPing = useCallback(async () => {
    setPingStatus('checking');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const base = (urlInput || settings.backendBaseUrl || getDefaultBackendUrl()).replace(/\/$/, '');
      const response = await fetch(`${base}/healthz`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        setPingStatus('online');
      } else {
        setPingStatus('offline');
      }
    } catch {
      setPingStatus('offline');
    }
  }, [urlInput, settings.backendBaseUrl]);

  const handleClearCache = useCallback(() => {
    Alert.alert(
      'Purge Temporary Files?',
      'Removes leftover download chunks that are no longer needed. Saved videos and history are never touched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purge Now',
          onPress: async () => {
            const count = await cleanOrphanedTempFiles();
            Alert.alert('Cache Purged', `Cleared ${count} temporary ${count === 1 ? 'file' : 'files'}.`);
          },
        },
      ]
    );
  }, []);

  const handleClearHistory = useCallback(() => {
    Alert.alert('Clear Library & History', 'Choose how you want to clear your saved items:', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear Records (Keep Files)',
        onPress: async () => {
          await clearHistoryEntriesOnly();
          Alert.alert('Done', 'History list cleared. Video files remain saved on your device.');
        },
      },
      {
        text: 'Delete Records & Video Files',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            'Delete All Saved Videos?',
            'This will permanently delete all downloaded video files from device storage. This action cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Permanently Delete',
                style: 'destructive',
                onPress: async () => {
                  await clearHistoryAndFiles();
                  Alert.alert('Done', 'All downloaded video files and records have been deleted.');
                },
              },
            ]
          ),
      },
    ]);
  }, []);

  const handleSaveUrl = useCallback(async () => {
    const trimmed = urlInput.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      Alert.alert('Invalid URL', 'The resolver URL must begin with http:// or https://');
      return;
    }
    await updateSetting({ backendBaseUrl: trimmed });
    setEditingUrl(false);
    setPingStatus('idle');
  }, [urlInput, updateSetting]);

  const handleResetUrl = useCallback(async () => {
    const defaultUrl = getDefaultBackendUrl();
    setUrlInput(defaultUrl);
    await updateSetting({ backendBaseUrl: defaultUrl });
    setEditingUrl(false);
    setPingStatus('idle');
  }, [updateSetting]);

  const themeOptions: { mode: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { mode: 'system', label: 'System', icon: 'phone-portrait-outline' },
    { mode: 'light', label: 'Light', icon: 'sunny-outline' },
    { mode: 'dark', label: 'Dark', icon: 'moon-outline' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Top Header Bar */}
      <View style={[styles.topBar, { borderBottomColor: colors.outlineVariant }]}>
        <Text style={[typography.titleLarge, { color: colors.textPrimary }]}>Settings</Text>
        <Pressable
          onPress={() => router.push('/about')}
          style={styles.aboutPill}
          android_ripple={{ color: colors.ripple }}
          accessibilityRole="button"
          accessibilityLabel="About ClipSave"
        >
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
          <Text style={[typography.labelMedium, { color: colors.primary, marginLeft: 4 }]}>About</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* App Hero Status Card */}
        <View style={[styles.card, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
          <View style={styles.heroRow}>
            <View style={[styles.appIconBox, { backgroundColor: colors.primaryContainer || colors.primaryLight }]}>
              <Ionicons name="film" size={26} color={colors.primary} />
            </View>
            <View style={styles.heroMeta}>
              <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>ClipSave Mobile</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                Android Media Suite · v1.0.0
              </Text>
            </View>
          </View>
        </View>

        {/* Section: Appearance */}
        <View style={styles.sectionHeader}>
          <Text style={[typography.titleSmall, { color: colors.textSecondary }]}>APPEARANCE</Text>
        </View>
        <View style={[styles.card, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
          <Text style={[typography.bodySmall, { color: colors.textMuted, marginBottom: spacing.sm }]}>
            Theme Mode
          </Text>
          <View style={styles.themeSelectorRow}>
            {themeOptions.map((opt) => {
              const active = themeMode === opt.mode;
              return (
                <Pressable
                  key={opt.mode}
                  onPress={() => setThemeMode(opt.mode)}
                  style={[
                    styles.themeTile,
                    {
                      backgroundColor: active ? colors.primaryContainer : colors.surface,
                      borderColor: active ? colors.primary : colors.outlineVariant,
                    },
                  ]}
                  android_ripple={{ color: colors.ripple }}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${opt.label} theme`}
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons
                    name={opt.icon}
                    size={20}
                    color={active ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      typography.labelMedium,
                      { color: active ? colors.primary : colors.textPrimary, marginTop: 4 },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

          <View style={styles.switchRow}>
            <View style={styles.switchMeta}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Launch animation</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                Play a brief animation when ClipSave opens.
              </Text>
            </View>
            <Switch
              value={Boolean(settings.enableLaunchAnimation)}
              onValueChange={(val) => updateSetting({ enableLaunchAnimation: val })}
              thumbColor={settings.enableLaunchAnimation ? colors.primary : colors.textMuted}
              trackColor={{ false: colors.outlineVariant, true: colors.primaryLight }}
              accessibilityLabel="Launch animation toggle"
            />
          </View>
        </View>

        {/* Section: Connection & Backend */}
        <View style={styles.sectionHeader}>
          <Text style={[typography.titleSmall, { color: colors.textSecondary }]}>RESOLVER CONNECTION</Text>
        </View>
        <View style={[styles.card, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
          <View style={styles.connectionHeader}>
            <View>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Backend Resolver</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                Endpoint for resolving public TikTok media
              </Text>
            </View>
            <Pressable
              onPress={handleTestPing}
              style={[
                styles.pingButton,
                {
                  backgroundColor:
                    pingStatus === 'online'
                      ? colors.successLight
                      : pingStatus === 'offline'
                      ? colors.dangerLight
                      : colors.surface,
                  borderColor:
                    pingStatus === 'online'
                      ? colors.success
                      : pingStatus === 'offline'
                      ? colors.danger
                      : colors.outlineVariant,
                },
              ]}
              disabled={pingStatus === 'checking'}
              android_ripple={{ color: colors.ripple }}
              accessibilityRole="button"
              accessibilityLabel="Test resolver connection"
            >
              {pingStatus === 'checking' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons
                    name={
                      pingStatus === 'online'
                        ? 'checkmark-circle'
                        : pingStatus === 'offline'
                        ? 'alert-circle'
                        : 'pulse-outline'
                    }
                    size={15}
                    color={
                      pingStatus === 'online'
                        ? colors.success
                        : pingStatus === 'offline'
                        ? colors.danger
                        : colors.primary
                    }
                  />
                  <Text
                    style={[
                      typography.labelMedium,
                      {
                        color:
                          pingStatus === 'online'
                            ? colors.success
                            : pingStatus === 'offline'
                            ? colors.danger
                            : colors.primary,
                        marginLeft: 4,
                      },
                    ]}
                  >
                    {pingStatus === 'online'
                      ? 'Online'
                      : pingStatus === 'offline'
                      ? 'Unreachable'
                      : 'Test Ping'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          {editingUrl ? (
            <View style={styles.editUrlBlock}>
              <TextInput
                value={urlInput}
                onChangeText={setUrlInput}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={[
                  styles.urlInput,
                  {
                    color: colors.textPrimary,
                    backgroundColor: colors.surface,
                    borderColor: colors.primary,
                  },
                ]}
                placeholder="http://192.168.1.x:8080"
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.editUrlButtons}>
                <Button
                  title="Cancel"
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    setUrlInput(settings.backendBaseUrl);
                    setEditingUrl(false);
                  }}
                />
                <Button title="Save" variant="primary" size="sm" onPress={handleSaveUrl} />
              </View>
            </View>
          ) : (
            <View style={styles.urlDisplayRow}>
              <Text
                style={[typography.labelMedium, { color: colors.textPrimary, flex: 1 }]}
                numberOfLines={1}
              >
                {settings.backendBaseUrl}
              </Text>
              <Pressable
                onPress={() => setEditingUrl(true)}
                style={styles.textActionPill}
                accessibilityRole="button"
                accessibilityLabel="Edit resolver URL"
              >
                <Text style={[typography.labelMedium, { color: colors.primary }]}>Edit</Text>
              </Pressable>
              <Pressable
                onPress={handleResetUrl}
                style={styles.textActionPill}
                accessibilityRole="button"
                accessibilityLabel="Reset URL to default"
              >
                <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>Reset</Text>
              </Pressable>
            </View>
          )}

          <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

          <View style={styles.switchRow}>
            <View style={styles.switchMeta}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Mock resolver</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                Returns test media fixtures without contacting a network server.
              </Text>
            </View>
            <Switch
              value={Boolean(settings.useMockResolver)}
              onValueChange={(val) => updateSetting({ useMockResolver: val })}
              thumbColor={settings.useMockResolver ? colors.warning : colors.textMuted}
              trackColor={{ false: colors.outlineVariant, true: colors.warningLight }}
              accessibilityLabel="Mock resolver toggle"
            />
          </View>
        </View>

        {/* Section: Storage & Maintenance */}
        <View style={styles.sectionHeader}>
          <Text style={[typography.titleSmall, { color: colors.textSecondary }]}>STORAGE & CLEANUP</Text>
        </View>
        <View style={[styles.card, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
          <Pressable
            onPress={handleClearCache}
            style={styles.storageActionRow}
            android_ripple={{ color: colors.ripple }}
            accessibilityRole="button"
            accessibilityLabel="Purge temporary files"
          >
            <View style={[styles.storageIconBox, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="trash-bin-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.storageActionMeta}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                Purge Temporary Cache
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                Delete orphaned partial chunks (saved videos are kept safe).
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

          <Pressable
            onPress={handleClearHistory}
            style={styles.storageActionRow}
            android_ripple={{ color: colors.ripple }}
            accessibilityRole="button"
            accessibilityLabel="Clear library and downloaded files"
          >
            <View style={[styles.storageIconBox, { backgroundColor: colors.dangerLight }]}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </View>
            <View style={styles.storageActionMeta}>
              <Text style={[typography.bodyMedium, { color: colors.danger }]}>
                Clear Library & Videos
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                Manage saved download history and local storage media.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  aboutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appIconBox: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  heroMeta: {
    flex: 1,
  },
  sectionHeader: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    paddingHorizontal: 2,
  },
  themeSelectorRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  themeTile: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchMeta: {
    flex: 1,
    marginRight: spacing.md,
  },
  connectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  pingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  urlDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  textActionPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginLeft: spacing.xs,
  },
  editUrlBlock: {
    marginTop: spacing.xs,
  },
  urlInput: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    fontSize: 14,
  },
  editUrlButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  storageActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  storageIconBox: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  storageActionMeta: {
    flex: 1,
  },
});
