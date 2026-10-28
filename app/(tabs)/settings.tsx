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
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, layout, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import {
  getSettings,
  saveSettings,
  getCachedSettings,
  defaultSettings,
} from '../../src/storage/settingsStore';
import { cleanOrphanedTempFiles } from '../../src/services/mediaManager';
import { clearHistoryAndFiles, getHistory } from '../../src/storage/historyStore';
import { formatBytes } from '../../src/utils/formatters';
import { AppSettings, ThemeMode, ColorPalette, AccentColor } from '../../src/types';
import { ACCENT_PRESETS, PALETTE_PRESETS } from '../../src/theme/colors';
import { TabHeader } from '../../src/components/TabHeader';
import { AccordionRow } from '../../src/components/AccordionRow';
import { BottomSheetMenu, SheetAction } from '../../src/components/BottomSheetMenu';

export default function SettingsScreen() {
  const {
    colors,
    themeMode,
    setThemeMode,
    palette,
    setPalette,
    accentColor,
    setAccentColor,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [settings, setSettings] = useState<AppSettings>(() => getCachedSettings());
  const [storageUsedBytes, setStorageUsedBytes] = useState<number>(0);
  const [clearing, setClearing] = useState(false);
  const [showTopMenu, setShowTopMenu] = useState(false);

  useEffect(() => {
    getSettings().then((s) => setSettings(s)).catch(() => {});
    getHistory(false)
      .then((items) => {
        const sum = items.reduce((acc, it) => acc + (it.fileSizeBytes || 0), 0);
        if (sum > 0) setStorageUsedBytes(sum);
      })
      .catch(() => {});
  }, []);

  const updateSetting = useCallback(async (patch: Partial<AppSettings>) => {
    const updated = await saveSettings(patch);
    setSettings(updated);
  }, []);

  const handleThemeModeSelect = (mode: ThemeMode) => {
    setThemeMode(mode);
    updateSetting({ themeMode: mode });
  };

  const handlePaletteSelect = (p: ColorPalette) => {
    setPalette(p);
    updateSetting({ palette: p });
  };

  const handleAccentSelect = (a: AccentColor) => {
    setAccentColor(a);
    updateSetting({ accentColor: a });
  };

  const handleConcurrentChange = (delta: number) => {
    const current = settings.maxConcurrentDownloads || 2;
    const next = Math.max(1, Math.min(5, current + delta));
    updateSetting({ maxConcurrentDownloads: next });
  };

  const handleClearCache = useCallback(() => {
    Alert.alert(
      'Clear Temporary Files?',
      'Deletes partial downloads and temporary cache files. Saved videos and history will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
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

  const handleClearAllHistory = useCallback(() => {
    Alert.alert(
      'Clear All History & Videos?',
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
              Alert.alert('Library Cleared', 'All saved videos and history records have been deleted.');
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  }, []);

  const handleResetSettings = useCallback(() => {
    Alert.alert(
      'Reset Settings to Default?',
      'Reset all app preferences (theme, downloads, concurrency) to defaults?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await saveSettings(defaultSettings);
            setSettings(defaultSettings);
            setThemeMode(defaultSettings.themeMode);
            setPalette(defaultSettings.palette);
            setAccentColor(defaultSettings.accentColor);
            Alert.alert('Settings Reset', 'App preferences have been restored to defaults.');
          },
        },
      ]
    );
  }, [setThemeMode, setPalette, setAccentColor]);

  const topMenuActions: SheetAction[] = [
    {
      key: 'reset',
      label: 'Reset Preferences to Default',
      icon: 'refresh-outline',
      onPress: handleResetSettings,
    },
    {
      key: 'about',
      label: 'About ClipSave',
      icon: 'information-circle-outline',
      onPress: () => router.push('/about'),
    },
  ];

  const storageUsedStr = formatBytes(storageUsedBytes);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* 1. COMPACT TOP HEADER WITH LOGO + "SETTINGS" + 3-DOTS OVERFLOW */}
      <TabHeader
        title="Settings"
        onOverflowPress={() => setShowTopMenu(true)}
        overflowLabel="Settings options"
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + layout.section + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. FOUR EXPANDABLE ACCORDION SECTIONS */}

        {/* Section 1: Appearance */}
        <AccordionRow
          title="Appearance"
          subtitle="Theme mode, color palette & accent"
          icon="color-palette-outline"
          initiallyExpanded={true}
        >
          <View style={styles.sectionBody}>
            {/* Theme Mode Selector */}
            <Text style={[typography.labelMedium, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
              Theme Mode
            </Text>
            <View style={styles.themeModeRow}>
              {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => {
                const isSelected = themeMode === mode;
                const label = mode === 'system' ? 'System' : mode === 'light' ? 'Light' : 'Dark';
                const iconName =
                  mode === 'system'
                    ? 'phone-portrait-outline'
                    : mode === 'light'
                    ? 'sunny-outline'
                    : 'moon-outline';
                return (
                  <Pressable
                    key={mode}
                    onPress={() => handleThemeModeSelect(mode)}
                    android_ripple={{ color: colors.ripple }}
                    style={[
                      styles.modePill,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surfaceContainerHigh,
                        borderColor: isSelected ? colors.primary : colors.outlineVariant,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Appearance mode: ${label}`}
                  >
                    <Ionicons
                      name={iconName}
                      size={16}
                      color={isSelected ? colors.onPrimary : colors.textPrimary}
                    />
                    <Text
                      style={[
                        typography.labelMedium,
                        {
                          color: isSelected ? colors.onPrimary : colors.textPrimary,
                          marginLeft: 6,
                        },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Color Palette Selector */}
            <Text
              style={[
                typography.labelMedium,
                { color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
              ]}
            >
              Color Palette
            </Text>
            <View style={styles.paletteRow}>
              {(['warm_light', 'midnight', 'sage'] as ColorPalette[]).map((pKey) => {
                const isSelected = palette === pKey;
                const pInfo = PALETTE_PRESETS[pKey];
                return (
                  <Pressable
                    key={pKey}
                    onPress={() => handlePaletteSelect(pKey)}
                    android_ripple={{ color: colors.ripple }}
                    style={[
                      styles.paletteCard,
                      {
                        backgroundColor: isSelected ? colors.primaryLight : colors.surfaceContainerHigh,
                        borderColor: isSelected ? colors.primary : colors.outlineVariant,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Color palette: ${pInfo.name}`}
                  >
                    <Text
                      style={[
                        typography.labelMedium,
                        {
                          color: isSelected ? colors.primary : colors.textPrimary,
                          fontWeight: isSelected ? '700' : '600',
                        },
                      ]}
                    >
                      {pInfo.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Accent Color Swatches */}
            <Text
              style={[
                typography.labelMedium,
                { color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
              ]}
            >
              Accent Color
            </Text>
            <View style={styles.swatchesRow}>
              {(Object.keys(ACCENT_PRESETS) as AccentColor[]).map((aKey) => {
                const aPreset = ACCENT_PRESETS[aKey];
                const isSelected = accentColor === aKey;
                return (
                  <Pressable
                    key={aKey}
                    onPress={() => handleAccentSelect(aKey)}
                    style={[
                      styles.swatchCircle,
                      {
                        backgroundColor: aPreset.hex,
                        borderColor: isSelected ? colors.textPrimary : 'transparent',
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Accent color ${aPreset.name}`}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={18} color={aPreset.onAccent} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </AccordionRow>

        {/* Section 2: Downloads */}
        <AccordionRow
          title="Downloads"
          subtitle="Connection, gallery & concurrency"
          icon="download-outline"
        >
          <View style={styles.sectionBody}>
            {/* Wi-Fi Only Switch */}
            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                  Download over Wi-Fi only
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Prevent cellular data consumption during downloads
                </Text>
              </View>
              <Switch
                value={settings.wifiOnly}
                onValueChange={(val) => updateSetting({ wifiOnly: val })}
                trackColor={{ false: colors.surfaceContainerHigh, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.rowDivider, { backgroundColor: colors.outlineVariant }]} />

            {/* Save to Gallery Switch */}
            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                  Save to Gallery
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Export finished videos automatically into Android Media Store
                </Text>
              </View>
              <Switch
                value={settings.saveToGallery}
                onValueChange={(val) => updateSetting({ saveToGallery: val })}
                trackColor={{ false: colors.surfaceContainerHigh, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.rowDivider, { backgroundColor: colors.outlineVariant }]} />

            {/* Simultaneous Downloads Stepper */}
            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                  Simultaneous downloads
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Maximum active concurrent download tasks
                </Text>
              </View>

              <View style={styles.stepperContainer}>
                <Pressable
                  onPress={() => handleConcurrentChange(-1)}
                  disabled={settings.maxConcurrentDownloads <= 1}
                  style={[
                    styles.stepperButton,
                    {
                      backgroundColor: colors.surfaceContainerHigh,
                      borderColor: colors.outlineVariant,
                      opacity: settings.maxConcurrentDownloads <= 1 ? 0.4 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease simultaneous downloads"
                >
                  <Ionicons name="remove" size={16} color={colors.textPrimary} />
                </Pressable>

                <Text
                  style={[
                    typography.numeric,
                    styles.stepperValue,
                    { color: colors.textPrimary },
                  ]}
                >
                  {settings.maxConcurrentDownloads}
                </Text>

                <Pressable
                  onPress={() => handleConcurrentChange(1)}
                  disabled={settings.maxConcurrentDownloads >= 5}
                  style={[
                    styles.stepperButton,
                    {
                      backgroundColor: colors.surfaceContainerHigh,
                      borderColor: colors.outlineVariant,
                      opacity: settings.maxConcurrentDownloads >= 5 ? 0.4 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Increase simultaneous downloads"
                >
                  <Ionicons name="add" size={16} color={colors.textPrimary} />
                </Pressable>
              </View>
            </View>
          </View>
        </AccordionRow>

        {/* Section 3: Storage */}
        <AccordionRow
          title="Storage"
          subtitle={`${storageUsedStr} used`}
          icon="server-outline"
        >
          <View style={styles.sectionBody}>
            {/* Storage Usage Metric */}
            <View style={styles.storageMetricBox}>
              <Ionicons name="pie-chart-outline" size={24} color={colors.primary} />
              <View style={styles.settingTextCol}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                  {storageUsedStr}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Total disk space occupied by downloaded videos
                </Text>
              </View>
            </View>

            {/* Clear Cache Button */}
            <Pressable
              onPress={handleClearCache}
              disabled={clearing}
              android_ripple={{ color: colors.ripple }}
              style={[
                styles.storageActionButton,
                {
                  backgroundColor: colors.surfaceContainerHigh,
                  borderColor: colors.outlineVariant,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Clear temporary files"
            >
              <Ionicons name="trash-bin-outline" size={18} color={colors.textPrimary} />
              <Text style={[typography.labelMedium, { color: colors.textPrimary, flex: 1, marginLeft: 8 }]}>
                Clear temporary files
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        </AccordionRow>

        {/* Section 4: About */}
        <AccordionRow
          title="About"
          subtitle="ClipSave v1.0.0"
          icon="information-circle-outline"
        >
          <View style={styles.sectionBody}>
            <Pressable
              onPress={() => router.push('/about')}
              android_ripple={{ color: colors.ripple }}
              style={styles.aboutRow}
              accessibilityRole="button"
              accessibilityLabel="About ClipSave"
            >
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                App Information & Architecture
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>

            <View style={[styles.rowDivider, { backgroundColor: colors.outlineVariant }]} />

            <Pressable
              onPress={() => {
                Alert.alert(
                  'Privacy & Terms',
                  'ClipSave does not track your downloads, collect personal data, or inject advertisements.\n\nPlease respect intellectual property and content creators when downloading videos.'
                );
              }}
              android_ripple={{ color: colors.ripple }}
              style={styles.aboutRow}
              accessibilityRole="button"
              accessibilityLabel="Privacy policy and terms"
            >
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                Privacy & Terms
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>

            <View style={[styles.rowDivider, { backgroundColor: colors.outlineVariant }]} />

            <Pressable
              onPress={() => {
                Alert.alert(
                  'Open Source Licenses',
                  'ClipSave is built with:\n\n• React Native (MIT)\n• Expo (MIT)\n• React (MIT)\n• Ionicons (MIT)\n• SnapDeploy Client'
                );
              }}
              android_ripple={{ color: colors.ripple }}
              style={styles.aboutRow}
              accessibilityRole="button"
              accessibilityLabel="Open source licenses"
            >
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                Open Source Licenses
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        </AccordionRow>

        {/* 3. DANGER ZONE: CLEAR ALL HISTORY CARD */}
        <View
          style={[
            styles.dangerCard,
            {
              backgroundColor: colors.surfaceContainer,
              borderColor: colors.dangerBorder,
            },
          ]}
        >
          <View style={styles.dangerHeaderRow}>
            <Ionicons name="warning-outline" size={20} color={colors.danger} />
            <Text
              style={[
                typography.titleMedium,
                { color: colors.danger, fontWeight: '700', marginLeft: 8 },
              ]}
            >
              Clear all history
            </Text>
          </View>

          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 4 }]}>
            Permanently deletes all download history records and media files from your local storage.
          </Text>

          <Pressable
            onPress={handleClearAllHistory}
            disabled={clearing}
            android_ripple={{ color: colors.ripplePrimary }}
            style={[styles.dangerButton, { backgroundColor: colors.danger }]}
            accessibilityRole="button"
            accessibilityLabel="Clear all history and delete videos"
          >
            <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
            <Text style={[typography.labelMedium, { color: '#FFFFFF', fontWeight: '700', marginLeft: 6 }]}>
              Clear History
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Top Header Overflow Menu */}
      <BottomSheetMenu
        visible={showTopMenu}
        onClose={() => setShowTopMenu(false)}
        title="Settings Menu"
        actions={topMenuActions}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.sm,
  },
  sectionBody: {
    paddingTop: spacing.xs,
  },
  themeModeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: 40,
  },
  paletteRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  paletteCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: 40,
  },
  swatchesRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  swatchCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  settingTextCol: {
    flex: 1,
    paddingRight: spacing.md,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.xs,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepperButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontSize: 16,
    minWidth: 20,
    textAlign: 'center',
  },
  storageMetricBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  storageActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    minHeight: 44,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    minHeight: 44,
  },
  dangerCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  dangerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    minHeight: 42,
    marginTop: spacing.md,
  },
});
