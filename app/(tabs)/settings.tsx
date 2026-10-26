import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  Alert,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { Button } from '../../src/components/Button';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { SegmentedControl, SegmentOption } from '../../src/components/SegmentedControl';
import { getSettings, saveSettings } from '../../src/storage/settingsStore';
import { cleanOrphanedTempFiles } from '../../src/services/mediaManager';
import { clearHistoryEntriesOnly, clearHistoryAndFiles } from '../../src/storage/historyStore';
import { AppSettings, ThemeMode } from '../../src/types';

export default function SettingsScreen() {
  const { colors, themeMode, setThemeMode } = useTheme();
  const router = useRouter();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [backendUrlInput, setBackendUrlInput] = useState('');
  const [isEditingUrl, setIsEditingUrl] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setBackendUrlInput(s.backendBaseUrl);
    });
  }, []);

  const updateSetting = async (patch: Partial<AppSettings>) => {
    const updated = await saveSettings(patch);
    setSettings(updated);
  };

  const handleClearCache = async () => {
    const count = await cleanOrphanedTempFiles();
    Alert.alert(
      'Cache Cleared',
      `Safely removed ${count} temporary stream ${count === 1 ? 'file' : 'files'}. Your saved media and history were preserved.`
    );
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear Download History',
      'Choose an action to clear your history:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Records Only (Keep Files)',
          onPress: async () => {
            await clearHistoryEntriesOnly();
            Alert.alert('Success', 'History records cleared. Saved video files were not deleted.');
          },
        },
        {
          text: 'Delete All Files & Records',
          style: 'destructive',
          onPress: async () => {
            await clearHistoryAndFiles();
            Alert.alert('Success', 'All history records and saved media files deleted.');
          },
        },
      ]
    );
  };

  const handleSaveBackendUrl = () => {
    const trimmed = backendUrlInput.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      Alert.alert('Invalid URL', 'Backend URL must begin with http:// or https://');
      return;
    }
    updateSetting({ backendBaseUrl: trimmed });
    setIsEditingUrl(false);
    Alert.alert('Saved', 'Resolver backend URL successfully updated.');
  };

  if (!settings) return null;

  const themeOptions: SegmentOption<ThemeMode>[] = [
    { value: 'system', label: 'System', icon: 'hardware-chip-outline' },
    { value: 'light', label: 'Light', icon: 'sunny-outline' },
    { value: 'dark', label: 'Dark', icon: 'moon-outline' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScreenHeader
        title="Settings"
        subtitle="Preferences, storage & resolver configuration"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Section 1: Appearance */}
        <View style={styles.sectionContainer}>
          <Text style={[typography.micro, styles.sectionTitle, { color: colors.textMuted }]}>
            APPEARANCE
          </Text>
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.surfaceContainerLowest || colors.surface,
                borderColor: colors.outlineVariant || colors.surfaceBorder,
              },
            ]}
          >
            <View style={styles.themeRow}>
              <View style={[styles.settingIconWrapper, { backgroundColor: colors.primaryContainer || colors.primaryLight }]}>
                <Ionicons name="color-palette-outline" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>Theme</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  Choose application appearance
                </Text>
              </View>
            </View>

            <View style={{ marginTop: spacing.md }}>
              <SegmentedControl
                options={themeOptions}
                selectedValue={themeMode}
                onSelect={setThemeMode}
                accessibilityLabel="Select appearance theme mode"
              />
            </View>
          </View>
        </View>

        {/* Section 2: Download Preferences */}
        <View style={styles.sectionContainer}>
          <Text style={[typography.micro, styles.sectionTitle, { color: colors.textMuted }]}>
            DOWNLOAD PREFERENCES
          </Text>
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.surfaceContainerLowest || colors.surface,
                borderColor: colors.outlineVariant || colors.surfaceBorder,
              },
            ]}
          >
            <View style={styles.preferenceRow}>
              <View style={[styles.settingIconWrapper, { backgroundColor: colors.primaryContainer || colors.primaryLight }]}>
                <Ionicons name="flash-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.preferenceTextCol}>
                <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>Auto-start Download</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                  Download immediately after resolving link
                </Text>
              </View>
              <Switch
                value={settings.autoDownloadOnResolve}
                onValueChange={(val) => updateSetting({ autoDownloadOnResolve: val })}
                trackColor={{ false: colors.outlineVariant || colors.surfaceBorder, true: colors.primary }}
                thumbColor={Platform.OS === 'android' ? (settings.autoDownloadOnResolve ? '#FFFFFF' : '#F4F3F4') : undefined}
              />
            </View>

            <View style={[styles.rowDivider, { backgroundColor: colors.outlineVariant || colors.surfaceBorder }]} />

            <View style={styles.preferenceRow}>
              <View style={[styles.settingIconWrapper, { backgroundColor: colors.primaryContainer || colors.primaryLight }]}>
                <Ionicons name="images-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.preferenceTextCol}>
                <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>Save to Gallery</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                  Insert downloaded MP4 into public device gallery
                </Text>
              </View>
              <Switch
                value={settings.saveToGallery}
                onValueChange={(val) => updateSetting({ saveToGallery: val })}
                trackColor={{ false: colors.outlineVariant || colors.surfaceBorder, true: colors.primary }}
                thumbColor={Platform.OS === 'android' ? (settings.saveToGallery ? '#FFFFFF' : '#F4F3F4') : undefined}
              />
            </View>
          </View>
        </View>

        {/* Section 3: Resolver Configuration */}
        <View style={styles.sectionContainer}>
          <Text style={[typography.micro, styles.sectionTitle, { color: colors.textMuted }]}>
            RESOLVER CONFIGURATION
          </Text>
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.surfaceContainerLowest || colors.surface,
                borderColor: colors.outlineVariant || colors.surfaceBorder,
              },
            ]}
          >
            <View style={styles.preferenceRow}>
              <View style={[styles.settingIconWrapper, { backgroundColor: colors.warningLight }]}>
                <Ionicons name="construct-outline" size={18} color={colors.warning} />
              </View>
              <View style={styles.preferenceTextCol}>
                <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>Mock Resolver Mode</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                  Use offline mock fixtures for testing without network
                </Text>
              </View>
              <Switch
                value={settings.useMockResolver}
                onValueChange={(val) => updateSetting({ useMockResolver: val })}
                trackColor={{ false: colors.outlineVariant || colors.surfaceBorder, true: colors.primary }}
                thumbColor={Platform.OS === 'android' ? (settings.useMockResolver ? '#FFFFFF' : '#F4F3F4') : undefined}
              />
            </View>

            {!settings.useMockResolver && (
              <>
                <View style={[styles.rowDivider, { backgroundColor: colors.outlineVariant || colors.surfaceBorder }]} />

                <View style={styles.backendRow}>
                  <View style={[styles.settingIconWrapper, { backgroundColor: colors.primaryContainer || colors.primaryLight }]}>
                    <Ionicons name="server-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>Backend Server URL</Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 1 }]} numberOfLines={1}>
                      {settings.backendBaseUrl}
                    </Text>
                  </View>
                  <Button
                    title={isEditingUrl ? 'Cancel' : 'Edit'}
                    onPress={() => setIsEditingUrl(!isEditingUrl)}
                    variant="ghost"
                    size="sm"
                  />
                </View>

                {isEditingUrl && (
                  <View style={styles.editUrlBox}>
                    <TextInput
                      style={[
                        styles.urlInput,
                        {
                          backgroundColor: colors.surfaceContainerLow || colors.inputBackground,
                          borderColor: colors.primary,
                          color: colors.textPrimary,
                        },
                      ]}
                      value={backendUrlInput}
                      onChangeText={setBackendUrlInput}
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="http://192.168.1.21:8080"
                      placeholderTextColor={colors.textMuted}
                    />
                    <Button
                      title="Save"
                      onPress={handleSaveBackendUrl}
                      variant="primary"
                      size="sm"
                      style={{ marginTop: spacing.sm }}
                    />
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* Section 4: Storage & Data */}
        <View style={styles.sectionContainer}>
          <Text style={[typography.micro, styles.sectionTitle, { color: colors.textMuted }]}>
            STORAGE & DATA
          </Text>
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.surfaceContainerLowest || colors.surface,
                borderColor: colors.outlineVariant || colors.surfaceBorder,
              },
            ]}
          >
            <Pressable
              onPress={handleClearCache}
              android_ripple={{ color: colors.ripple, borderless: false }}
              style={styles.clickableRow}
              accessibilityRole="button"
              accessibilityLabel="Clear temporary cache files"
            >
              <View style={[styles.settingIconWrapper, { backgroundColor: colors.surfaceContainerHigh || colors.surfaceElevated }]}>
                <Ionicons name="trash-bin-outline" size={18} color={colors.textPrimary} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>Clear Temporary Cache</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 1 }]}>
                  Safely remove unreferenced stream files
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            <View style={[styles.rowDivider, { backgroundColor: colors.outlineVariant || colors.surfaceBorder }]} />

            <Pressable
              onPress={handleClearHistory}
              android_ripple={{ color: colors.ripple, borderless: false }}
              style={styles.clickableRow}
              accessibilityRole="button"
              accessibilityLabel="Clear download history and files"
            >
              <View style={[styles.settingIconWrapper, { backgroundColor: colors.dangerLight }]}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={[typography.titleSmall, { color: colors.danger }]}>Clear Download History...</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 1 }]}>
                  Manage history records or delete all saved videos
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* Section 5: About Navigation Tile */}
        <View style={[styles.sectionContainer, { marginBottom: spacing.xxxl }]}>
          <Text style={[typography.micro, styles.sectionTitle, { color: colors.textMuted }]}>
            INFORMATION
          </Text>
          <Pressable
            onPress={() => router.push('/about')}
            android_ripple={{ color: colors.ripple, borderless: false }}
            style={[
              styles.sectionCard,
              styles.clickableRow,
              {
                backgroundColor: colors.surfaceContainerLowest || colors.surface,
                borderColor: colors.outlineVariant || colors.surfaceBorder,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="View About, Privacy & Open Source Notices"
          >
            <View style={[styles.settingIconWrapper, { backgroundColor: colors.primaryContainer || colors.primaryLight }]}>
              <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>About ClipSave</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 1 }]}>
                Version 1.0.0 • Privacy notices • Open-source licenses
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
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
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  sectionContainer: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.xs + 2,
  },
  sectionCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    overflow: 'hidden',
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  preferenceTextCol: {
    flex: 1,
    marginHorizontal: spacing.md,
  },
  rowDivider: {
    height: 1,
    marginVertical: spacing.md,
  },
  backendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  editUrlBox: {
    marginTop: spacing.md,
  },
  urlInput: {
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    minHeight: 46,
  },
  clickableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
});
