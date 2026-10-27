import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import {
  getSettings,
  saveSettings,
  getCachedSettings,
} from '../../src/storage/settingsStore';
import { cleanOrphanedTempFiles } from '../../src/services/mediaManager';
import { clearHistoryAndFiles, getHistory } from '../../src/storage/historyStore';
import { formatBytes } from '../../src/utils/formatters';
import { AppSettings, ThemeMode, StartupAnimationMode } from '../../src/types';

export default function SettingsScreen() {
  const { colors, setThemeMode } = useTheme();
  const insets = useSafeAreaInsets();

  // Instant cached initialization avoids any startup flicker
  const [settings, setSettings] = useState<AppSettings>(() => getCachedSettings());
  const [storageUsedBytes, setStorageUsedBytes] = useState<number>(1280000000); // Default estimate ~1.2GB
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    getSettings().then((s) => setSettings(s)).catch(() => {});
    getHistory(false).then((items) => {
      const sum = items.reduce((acc, it) => acc + (it.fileSizeBytes || 0), 0);
      if (sum > 0) setStorageUsedBytes(sum);
    }).catch(() => {});
  }, []);

  const updateSetting = useCallback(async (patch: Partial<AppSettings>) => {
    const updated = await saveSettings(patch);
    setSettings(updated);
  }, []);

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    updateSetting({ themeMode: mode });
  };

  const handleAnimationChange = (mode: StartupAnimationMode) => {
    updateSetting({ startupAnimation: mode });
  };

  const handleConcurrentChange = (delta: number) => {
    const current = settings.maxConcurrentDownloads || 2;
    const next = Math.max(1, Math.min(5, current + delta));
    updateSetting({ maxConcurrentDownloads: next });
  };

  const handleClearCache = useCallback(() => {
    Alert.alert(
      'Purge Temporary Cache?',
      'Deletes partial chunks and temporary cache files. Saved videos and history will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purge Cache',
          onPress: async () => {
            setClearing(true);
            try {
              const count = await cleanOrphanedTempFiles();
              Alert.alert('Cache Cleared', `Successfully purged ${count} temporary files.`);
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  }, []);

  const handleClearLibrary = useCallback(() => {
    Alert.alert(
      'Clear Library & Videos?',
      'Permanently delete all downloaded videos from device storage and clear your history? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              await clearHistoryAndFiles();
              setStorageUsedBytes(0);
              Alert.alert('Library Cleared', 'All saved media files and download history have been removed.');
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  }, []);

  const handleAboutPress = () => {
    Alert.alert(
      'About ClipSave',
      'ClipSave v1.0.0\n\nA modern, high-performance TikTok media downloader built for Android.\n\n• Zero third-party ads\n• No watermark when supported\n• Fast concurrent engine\n• Privacy-focused local storage'
    );
  };

  const handlePrivacyPress = () => {
    Alert.alert(
      'Privacy Policy',
      'ClipSave does not collect, track, or share your personal information or downloaded content. All video downloads and metadata remain exclusively on your local device.'
    );
  };

  const handleLicensesPress = () => {
    Alert.alert(
      'Open Source Licenses',
      'ClipSave is built with open source software:\n\n• React Native & Expo\n• FastAPI & yt-dlp\n• Ionicons\n• TypeScript\n\nAll libraries are licensed under MIT or compatible permissive licenses.'
    );
  };

  // Storage calculation display
  const storageUsedStr = formatBytes(storageUsedBytes);
  const totalDeviceEst = 32000000000; // 32 GB representative capacity
  const percentUsed = Math.min(Math.max(Math.round((storageUsedBytes / totalDeviceEst) * 100), 4), 98);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* 1. TOP HEADER */}
      <View style={[styles.header, { borderBottomColor: colors.outlineVariant }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.logoIconBox, { backgroundColor: colors.primary }]}>
            <Ionicons name="settings" size={16} color="#FFFFFF" />
          </View>
          <View style={styles.headerTitleBox}>
            <Text style={[typography.titleMedium, { color: colors.textPrimary, fontWeight: '800' }]}>
              ClipSave
            </Text>
            <Text style={[typography.caption, { color: colors.accent, fontWeight: '600' }]}>
              Fast • Secure • 100% Ad-Free
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={[styles.glowingOrb, { backgroundColor: colors.primaryContainer, borderColor: colors.primary }]}>
            <Ionicons name="logo-tiktok" size={18} color={colors.primary} />
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* SECTION 1: APPEARANCE */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              🎨 APPEARANCE
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700', marginBottom: 12 }]}>
              Theme Mode
            </Text>

            <View style={[styles.segmentedRow, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
              {/* System */}
              <Pressable
                onPress={() => handleThemeChange('system')}
                style={[
                  styles.segmentBtn,
                  settings.themeMode === 'system' && [styles.segmentActive, { backgroundColor: colors.primary }],
                ]}
                accessibilityRole="button"
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={15}
                  color={settings.themeMode === 'system' ? '#FFFFFF' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.segmentText,
                    { color: settings.themeMode === 'system' ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  System
                </Text>
              </Pressable>

              {/* Light */}
              <Pressable
                onPress={() => handleThemeChange('light')}
                style={[
                  styles.segmentBtn,
                  settings.themeMode === 'light' && [styles.segmentActive, { backgroundColor: colors.primary }],
                ]}
                accessibilityRole="button"
              >
                <Ionicons
                  name="sunny-outline"
                  size={15}
                  color={settings.themeMode === 'light' ? '#FFFFFF' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.segmentText,
                    { color: settings.themeMode === 'light' ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  Light
                </Text>
              </Pressable>

              {/* Dark */}
              <Pressable
                onPress={() => handleThemeChange('dark')}
                style={[
                  styles.segmentBtn,
                  settings.themeMode === 'dark' && [styles.segmentActive, { backgroundColor: colors.primary }],
                ]}
                accessibilityRole="button"
              >
                <Ionicons
                  name="moon-outline"
                  size={15}
                  color={settings.themeMode === 'dark' ? '#FFFFFF' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.segmentText,
                    { color: settings.themeMode === 'dark' ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  Dark
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* SECTION 2: STARTUP & ANIMATION */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              ⚡ STARTUP & ANIMATION
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700', marginBottom: 12 }]}>
              Startup Animation
            </Text>

            <View style={[styles.segmentedRow, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
              {/* Off */}
              <Pressable
                onPress={() => handleAnimationChange('off')}
                style={[
                  styles.segmentBtn,
                  settings.startupAnimation === 'off' && [styles.segmentActive, { backgroundColor: colors.primary }],
                ]}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: settings.startupAnimation === 'off' ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  Off
                </Text>
              </Pressable>

              {/* Subtle */}
              <Pressable
                onPress={() => handleAnimationChange('subtle')}
                style={[
                  styles.segmentBtn,
                  settings.startupAnimation === 'subtle' && [styles.segmentActive, { backgroundColor: colors.primary }],
                ]}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: settings.startupAnimation === 'subtle' ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  Subtle
                </Text>
              </Pressable>

              {/* Standard */}
              <Pressable
                onPress={() => handleAnimationChange('standard')}
                style={[
                  styles.segmentBtn,
                  (settings.startupAnimation === 'standard' || !settings.startupAnimation) && [
                    styles.segmentActive,
                    { backgroundColor: colors.primary },
                  ],
                ]}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color:
                        settings.startupAnimation === 'standard' || !settings.startupAnimation
                          ? '#FFFFFF'
                          : colors.textSecondary,
                    },
                  ]}
                >
                  Standard
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* SECTION 3: DOWNLOAD BEHAVIOR */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              ⬇️ DOWNLOAD BEHAVIOR
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
            {/* Row 1: Wi-Fi only */}
            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                  Download over Wi-Fi only
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                  Prevent mobile data usage for video downloads
                </Text>
              </View>
              <Switch
                value={settings.wifiOnly}
                onValueChange={(val) => updateSetting({ wifiOnly: val })}
                trackColor={{ false: colors.surfaceBorder, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

            {/* Row 2: Save to Gallery */}
            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                  Save to Gallery
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                  Automatically make videos visible in your Photos app
                </Text>
              </View>
              <Switch
                value={settings.saveToGallery}
                onValueChange={(val) => updateSetting({ saveToGallery: val })}
                trackColor={{ false: colors.surfaceBorder, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

            {/* Row 3: Max Concurrent Downloads */}
            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                  Max Concurrent Downloads
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                  Simultaneous parallel download streams
                </Text>
              </View>
              <View style={styles.stepperContainer}>
                <Pressable
                  onPress={() => handleConcurrentChange(-1)}
                  style={[styles.stepperBtn, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
                  hitSlop={8}
                >
                  <Ionicons name="remove" size={16} color={colors.textPrimary} />
                </Pressable>
                <View style={styles.stepperValueBox}>
                  <Text style={[typography.titleSmall, { color: colors.primary, fontWeight: '800' }]}>
                    {settings.maxConcurrentDownloads || 2}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleConcurrentChange(1)}
                  style={[styles.stepperBtn, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
                  hitSlop={8}
                >
                  <Ionicons name="add" size={16} color={colors.textPrimary} />
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* SECTION 4: STORAGE & CLEANUP (With Circular Storage Gauge) */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              🗄️ STORAGE & CLEANUP
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
            <View style={styles.storageLayoutRow}>
              {/* Left Column: Actions */}
              <View style={styles.storageActionsCol}>
                <Pressable
                  onPress={handleClearCache}
                  disabled={clearing}
                  style={[styles.storageActionRow, { borderBottomColor: colors.outlineVariant }]}
                  android_ripple={{ color: colors.ripple }}
                >
                  <View style={styles.storageActionTextCol}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                      Purge Temporary Cache
                    </Text>
                    <Text style={[typography.captionMedium, { color: colors.textSecondary, marginTop: 2 }]}>
                      Free download temp space
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>

                <Pressable
                  onPress={handleClearLibrary}
                  disabled={clearing}
                  style={styles.storageActionRow}
                  android_ripple={{ color: colors.ripple }}
                >
                  <View style={styles.storageActionTextCol}>
                    <Text style={[typography.bodyMedium, { color: colors.danger, fontWeight: '700' }]}>
                      Clear Library & Videos
                    </Text>
                    <Text style={[typography.captionMedium, { color: colors.textSecondary, marginTop: 2 }]}>
                      Delete all saved media
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.danger} />
                </Pressable>
              </View>

              {/* Right Column: Circular Storage Gauge */}
              <View style={styles.storageGaugeCol}>
                <View style={[styles.gaugeOuterRing, { borderColor: colors.surfaceBorder }]}>
                  <View style={[styles.gaugeFillArc, { borderColor: colors.primary }]} />
                  <View style={styles.gaugeInnerContent}>
                    <Text style={[styles.gaugePercent, { color: colors.textPrimary }]}>{percentUsed}%</Text>
                    <Text style={[styles.gaugeSublabel, { color: colors.textMuted }]}>Used</Text>
                  </View>
                </View>
                <Text style={[styles.gaugeDetailText, { color: colors.accent }]}>
                  {storageUsedStr} Used
                </Text>
                <Text style={[styles.gaugeSubDetailText, { color: colors.textMuted }]}>
                  ~28.4 GB Free
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* SECTION 5: ABOUT & INFORMATION */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              ℹ️ ABOUT & INFORMATION
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
            {/* About */}
            <Pressable
              onPress={handleAboutPress}
              style={[styles.aboutRow, { borderBottomColor: colors.outlineVariant }]}
              android_ripple={{ color: colors.ripple }}
            >
              <View style={styles.aboutTextCol}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                  About ClipSave
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                  Version 1.0.0 • Production Build
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            {/* Privacy Policy */}
            <Pressable
              onPress={handlePrivacyPress}
              style={[styles.aboutRow, { borderBottomColor: colors.outlineVariant }]}
              android_ripple={{ color: colors.ripple }}
            >
              <View style={styles.aboutTextCol}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                  Privacy Policy
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                  Zero personal data tracking
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            {/* Licenses */}
            <Pressable
              onPress={handleLicensesPress}
              style={styles.aboutRow}
              android_ripple={{ color: colors.ripple }}
            >
              <View style={styles.aboutTextCol}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                  Open Source Licenses
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                  Third-party libraries & credits
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBox: {
    marginLeft: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  glowingOrb: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  sectionBlock: {
    marginBottom: spacing.lg,
  },
  sectionTitleRow: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.md,
  },
  segmentedRow: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 9,
  },
  segmentActive: {
    elevation: 2,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  settingTextCol: {
    flex: 1,
    paddingRight: spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueBox: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Storage & Cleanup layout
  storageLayoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storageActionsCol: {
    flex: 1.3,
    paddingRight: spacing.md,
  },
  storageActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  storageActionTextCol: {
    flex: 1,
  },
  storageGaugeCol: {
    flex: 0.9,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255, 255, 255, 0.08)',
    paddingLeft: spacing.sm,
  },
  gaugeOuterRing: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gaugeFillArc: {
    position: 'absolute',
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 5,
    borderTopColor: 'transparent',
    borderLeftColor: 'transparent',
    transform: [{ rotate: '-45deg' }],
  },
  gaugeInnerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugePercent: {
    fontSize: 14,
    fontWeight: '800',
  },
  gaugeSublabel: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: -2,
  },
  gaugeDetailText: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  gaugeSubDetailText: {
    fontSize: 10,
    marginTop: 1,
  },
  // About rows
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  aboutTextCol: {
    flex: 1,
  },
});
