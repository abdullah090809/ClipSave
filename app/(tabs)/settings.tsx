import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
  TextInput,
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
  SNAPDEPLOY_BACKEND_URL,
} from '../../src/storage/settingsStore';
import { cleanOrphanedTempFiles } from '../../src/services/mediaManager';
import { clearHistoryAndFiles, getHistory } from '../../src/storage/historyStore';
import { formatBytes } from '../../src/utils/formatters';
import { AppSettings, ThemeMode, ColorPalette, AccentColor, StartupAnimationMode } from '../../src/types';
import { ACCENT_PRESETS, PALETTE_PRESETS } from '../../src/theme/colors';
import { TabHeader } from '../../src/components/TabHeader';
import { AccordionRow } from '../../src/components/AccordionRow';
import { BottomSheetMenu, SheetAction } from '../../src/components/BottomSheetMenu';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';

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
  const [testingConnection, setTestingConnection] = useState(false);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [showClearCacheDialog, setShowClearCacheDialog] = useState(false);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [infoDialog, setInfoDialog] = useState<{
    title: string;
    message: string;
    icon?: keyof typeof Ionicons.glyphMap;
    iconColor?: string;
  } | null>(null);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const url = settings.backendBaseUrl.replace(/\/$/, '') + '/healthz';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.status === 200) {
        setInfoDialog({
          title: 'Connection Successful',
          message: `Backend at ${settings.backendBaseUrl} is online and operational.`,
          icon: 'checkmark-circle-outline',
          iconColor: colors.success,
        });
      } else if (res.status === 503) {
        setInfoDialog({
          title: 'Server Sleeping',
          message: `The server at ${settings.backendBaseUrl} is dormant (503). ClipSave will send an automatic wake signal when resolving.`,
          icon: 'time-outline',
          iconColor: colors.warning,
        });
      } else {
        setInfoDialog({
          title: 'Server Error',
          message: `Status: ${res.status} (${res.statusText})`,
          icon: 'alert-circle-outline',
          iconColor: colors.danger,
        });
      }
    } catch (err: any) {
      setInfoDialog({
        title: 'Connection Result',
        message: `Could not connect to ${settings.backendBaseUrl}.\n\nError: ${err?.message || 'Connection timeout'}`,
        icon: 'close-circle-outline',
        iconColor: colors.danger,
      });
    } finally {
      setTestingConnection(false);
    }
  };

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
    setShowClearCacheDialog(true);
  }, []);

  const handleClearAllHistory = useCallback(() => {
    setShowClearAllDialog(true);
  }, []);

  const handleResetSettings = useCallback(() => {
    setShowResetDialog(true);
  }, []);

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

            {/* Launch Animation Selector */}
            <Text
              style={[
                typography.labelMedium,
                { color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
              ]}
            >
              Launch Animation
            </Text>
            <View style={styles.themeModeRow}>
              {(['standard', 'subtle', 'off'] as StartupAnimationMode[]).map((mode) => {
                const isSelected = (settings.startupAnimation || 'standard') === mode;
                const label = mode === 'standard' ? 'Standard' : mode === 'subtle' ? 'Subtle' : 'Off';
                return (
                  <Pressable
                    key={mode}
                    onPress={() => updateSetting({ startupAnimation: mode })}
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
                    accessibilityLabel={`Launch animation: ${label}`}
                  >
                    <Text
                      style={[
                        typography.labelMedium,
                        {
                          color: isSelected ? colors.onPrimary : colors.textPrimary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </AccordionRow>

        {/* Section 2: Downloads */}
        <AccordionRow
          title="Downloads"
          subtitle="Quality, connection & storage"
          icon="download-outline"
        >
          <View style={styles.sectionBody}>
            {/* Preferred Quality Selector */}
            <View style={styles.settingTextCol}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                Preferred Download Quality
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Default format selected when resolving video links
              </Text>
            </View>
            <View style={styles.qualityPillRow}>
              {[
                { id: '1080p', label: '1080p HD' },
                { id: '720p', label: '720p HD' },
                { id: '360p', label: '360p SD' },
                { id: 'audio', label: 'Audio (MP3)' },
              ].map((q) => {
                const isSelected = (settings.defaultQuality || '1080p') === q.id;
                return (
                  <Pressable
                    key={q.id}
                    onPress={() => updateSetting({ defaultQuality: q.id })}
                    style={[
                      styles.qualityPill,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surfaceContainerHigh,
                        borderColor: isSelected ? colors.primary : colors.outlineVariant,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Preferred quality: ${q.label}`}
                  >
                    <Text
                      style={[
                        typography.labelMedium,
                        {
                          color: isSelected ? colors.onPrimary : colors.textPrimary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {q.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.rowDivider, { backgroundColor: colors.outlineVariant }]} />

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
                  hitSlop={8}
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
                  hitSlop={8}
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

        {/* Section 4: Network & Resolver */}
        <AccordionRow
          title="Network & Resolver"
          subtitle={settings.useMockResolver ? 'Offline Mock Resolver active' : 'Connected to ClipSave Backend'}
          icon="globe-outline"
        >
          <View style={styles.sectionBody}>
            {/* Mock Mode Switch */}
            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                  Offline Mock Resolver
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Resolve sample videos offline for local testing without calling the backend
                </Text>
              </View>
              <Switch
                value={settings.useMockResolver}
                onValueChange={(val) => updateSetting({ useMockResolver: val })}
                trackColor={{ false: colors.surfaceContainerHigh, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.rowDivider, { backgroundColor: colors.outlineVariant }]} />

            {/* Backend URL Display & Edit */}
            <View style={{ paddingVertical: spacing.xs }}>
              <Text style={[typography.labelMedium, { color: colors.textSecondary, marginBottom: 4 }]}>
                Backend Resolver URL
              </Text>
              <Text
                style={[
                  typography.caption,
                  { color: colors.textPrimary, fontFamily: 'monospace', paddingVertical: 4 },
                ]}
                numberOfLines={1}
                selectable
              >
                {settings.backendBaseUrl}
              </Text>

              {isEditingUrl ? (
                <View style={{ marginTop: spacing.xs }}>
                  <TextInput
                    style={[
                      typography.bodySmall,
                      {
                        backgroundColor: colors.inputBackground,
                        borderColor: colors.outlineVariant,
                        borderWidth: 1,
                        borderRadius: borderRadius.md,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs + 2,
                        color: colors.textPrimary,
                        marginBottom: spacing.xs,
                      },
                    ]}
                    placeholder="https://your-backend-host.com"
                    placeholderTextColor={colors.textMuted}
                    value={customUrlInput}
                    onChangeText={setCustomUrlInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Pressable
                      onPress={() => {
                        const trimmed = customUrlInput.trim().replace(/\/$/, '');
                        if (trimmed && (trimmed.startsWith('https://') || trimmed.startsWith('http://'))) {
                          updateSetting({ backendBaseUrl: trimmed });
                          setIsEditingUrl(false);
                        } else {
                          setInfoDialog({
                            title: 'Invalid URL',
                            message: 'Please enter a valid HTTP or HTTPS endpoint URL.',
                            icon: 'alert-circle-outline',
                            iconColor: colors.danger,
                          });
                        }
                      }}
                      style={[
                        styles.modePill,
                        { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                    >
                      <Text style={[typography.labelMedium, { color: colors.onPrimary }]}>Save URL</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setIsEditingUrl(false)}
                      style={[
                        styles.modePill,
                        { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant },
                      ]}
                    >
                      <Text style={[typography.labelMedium, { color: colors.textPrimary }]}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                  <Pressable
                    onPress={() => {
                      setCustomUrlInput(settings.backendBaseUrl);
                      setIsEditingUrl(true);
                    }}
                    style={[
                      styles.modePill,
                      { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant },
                    ]}
                  >
                    <Ionicons name="pencil-outline" size={14} color={colors.textPrimary} style={{ marginRight: 4 }} />
                    <Text style={[typography.labelMedium, { color: colors.textPrimary }]}>Edit URL</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      updateSetting({ backendBaseUrl: SNAPDEPLOY_BACKEND_URL });
                      setInfoDialog({
                        title: 'Reset Complete',
                        message: `Backend URL reset to official deployment:\n${SNAPDEPLOY_BACKEND_URL}`,
                        icon: 'checkmark-circle-outline',
                        iconColor: colors.success,
                      });
                    }}
                    style={[
                      styles.modePill,
                      { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant },
                    ]}
                  >
                    <Ionicons name="refresh-outline" size={14} color={colors.textPrimary} style={{ marginRight: 4 }} />
                    <Text style={[typography.labelMedium, { color: colors.textPrimary }]}>Reset</Text>
                  </Pressable>
                </View>
              )}
            </View>

            <View style={[styles.rowDivider, { backgroundColor: colors.outlineVariant }]} />

            {/* Test Connection Button */}
            <Pressable
              onPress={handleTestConnection}
              disabled={testingConnection}
              android_ripple={{ color: colors.ripple }}
              style={[
                styles.storageActionButton,
                {
                  backgroundColor: colors.surfaceContainerHigh,
                  borderColor: colors.outlineVariant,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Test connection to backend resolver"
            >
              <Ionicons name="wifi-outline" size={18} color={colors.primary} />
              <Text style={[typography.labelMedium, { color: colors.textPrimary, flex: 1, marginLeft: 8 }]}>
                {testingConnection ? 'Testing Connection...' : 'Test Backend Connection'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        </AccordionRow>

        {/* Section 5: About */}
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
                setInfoDialog({
                  title: 'Privacy & Terms',
                  message: 'ClipSave does not track your downloads, collect personal data, or inject advertisements.\n\nPlease respect intellectual property and content creators when downloading videos.',
                  icon: 'shield-checkmark-outline',
                });
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
                setInfoDialog({
                  title: 'Open Source Licenses',
                  message: 'ClipSave is built with:\n\n• React Native (MIT)\n• Expo (MIT)\n• React (MIT)\n• Ionicons (MIT)\n• SnapDeploy Client',
                  icon: 'code-slash-outline',
                });
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

      {/* Theme-Aware Clear Cache Dialog */}
      <ConfirmDialog
        visible={showClearCacheDialog}
        title="Clear Temporary Files?"
        message="Deletes partial downloads and temporary cache files. Saved videos and history will not be affected."
        icon="trash-bin-outline"
        confirmText="Clear Cache"
        cancelText="Cancel"
        onCancel={() => setShowClearCacheDialog(false)}
        onConfirm={async () => {
          setShowClearCacheDialog(false);
          setClearing(true);
          try {
            const count = await cleanOrphanedTempFiles();
            setInfoDialog({
              title: 'Cache Cleared',
              message: `Successfully purged ${count} temporary files.`,
              icon: 'checkmark-circle-outline',
              iconColor: colors.success,
            });
          } finally {
            setClearing(false);
          }
        }}
      />

      {/* Theme-Aware Clear All History Dialog */}
      <ConfirmDialog
        visible={showClearAllDialog}
        title="Clear All History & Videos?"
        message="Permanently delete all downloaded videos from device storage and clear your history? This action cannot be undone."
        icon="warning-outline"
        confirmDestructive
        confirmText="Delete All"
        cancelText="Cancel"
        onCancel={() => setShowClearAllDialog(false)}
        onConfirm={async () => {
          setShowClearAllDialog(false);
          setClearing(true);
          try {
            await clearHistoryAndFiles();
            setStorageUsedBytes(0);
            setInfoDialog({
              title: 'Library Cleared',
              message: 'All saved videos and history records have been deleted.',
              icon: 'checkmark-circle-outline',
              iconColor: colors.success,
            });
          } finally {
            setClearing(false);
          }
        }}
      />

      {/* Theme-Aware Reset Settings Dialog */}
      <ConfirmDialog
        visible={showResetDialog}
        title="Reset Settings to Default?"
        message="Reset all app preferences (theme, downloads, concurrency) to defaults?"
        icon="refresh-outline"
        confirmDestructive
        confirmText="Reset"
        cancelText="Cancel"
        onCancel={() => setShowResetDialog(false)}
        onConfirm={async () => {
          setShowResetDialog(false);
          await saveSettings(defaultSettings);
          setSettings(defaultSettings);
          setThemeMode(defaultSettings.themeMode);
          setPalette(defaultSettings.palette);
          setAccentColor(defaultSettings.accentColor);
          setInfoDialog({
            title: 'Settings Reset',
            message: 'App preferences have been restored to defaults.',
            icon: 'checkmark-circle-outline',
            iconColor: colors.success,
          });
        }}
      />

      {/* Theme-Aware Info Dialog (replaces all white native Alert.alert popups) */}
      <ConfirmDialog
        visible={!!infoDialog}
        title={infoDialog?.title || ''}
        message={infoDialog?.message || ''}
        icon={infoDialog?.icon}
        iconColor={infoDialog?.iconColor}
        cancelText={null}
        confirmText="Got it"
        onConfirm={() => setInfoDialog(null)}
      />

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
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: 36,
  },
  paletteRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  paletteCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: 36,
  },
  swatchesRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  swatchCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2.5,
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
    width: 38,
    height: 38,
    borderRadius: 19,
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
  qualityPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  qualityPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
});
