import { useState, useEffect, useCallback } from 'react';
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

  const updateSetting = useCallback(async (patch: Partial<AppSettings>) => {
    const updated = await saveSettings(patch);
    setSettings(updated);
  }, []);

  const handleClearCache = useCallback(async () => {
    const count = await cleanOrphanedTempFiles();
    Alert.alert(
      'Cache Cleared',
      `Safely removed ${count} temporary stream ${count === 1 ? 'file' : 'files'}. Your saved media and history were preserved.`
    );
  }, []);

  const handleClearHistory = useCallback(() => {
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
  }, []);

  const handleSaveBackendUrl = useCallback(() => {
    const trimmed = backendUrlInput.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      Alert.alert('Invalid URL', 'Backend URL must begin with http:// or https://');
      return;
    }
    updateSetting({ backendBaseUrl: trimmed });
    setIsEditingUrl(false);
    Alert.alert('Saved', 'Resolver backend URL successfully updated.');
  }, [backendUrlInput, updateSetting]);

  if (!settings) return null;

  const themeOptions: SegmentOption<ThemeMode>[] = [
    { value: 'system', label: 'System', icon: 'hardware-chip-outline' },
    { value: 'light', label: 'Light', icon: 'sunny-outline' },
    { value: 'dark', label: 'Dark', icon: 'moon-outline' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Settings Top Bar */}
      <View style={styles.topBar}>
        <Text style={[typography.headlineMedium, { color: colors.textPrimary, letterSpacing: -0.3 }]}>
          Settings
        </Text>
        <Text style={[typography.micro, { color: colors.textMuted }]}>
          Preferences, network & storage
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* SECTION: APPEARANCE */}
        <View style={styles.preferenceGroup}>
          <Text style={[typography.micro, styles.groupHeader, { color: colors.primary }]}>
            APPEARANCE
          </Text>

          <View style={[styles.groupContainer, { backgroundColor: colors.surfaceContainerLowest || colors.surface }]}>
            <View style={styles.preferenceRow}>
              <View style={[styles.tonalIconBox, { backgroundColor: colors.primaryContainer || colors.primaryLight }]}>
                <Ionicons name="color-palette-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.preferenceTextCol}>
                <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>Theme Mode</Text>
                <Text style={[typography.micro, { color: colors.textSecondary }]}>
                  Adaptive system or manual override
                </Text>
              </View>
            </View>
            <View style={styles.controlRow}>
              <SegmentedControl
                options={themeOptions}
                selectedValue={themeMode}
                onSelect={(val) => setThemeMode(val)}
              />
            </View>
          </View>
        </View>

        {/* SECTION: NETWORK & RESOLVER */}
        <View style={styles.preferenceGroup}>
          <Text style={[typography.micro, styles.groupHeader, { color: colors.primary }]}>
            NETWORK & RESOLVER
          </Text>

          <View style={[styles.groupContainer, { backgroundColor: colors.surfaceContainerLowest || colors.surface }]}>
            {/* Backend Base URL */}
            <View style={styles.preferenceRow}>
              <View style={[styles.tonalIconBox, { backgroundColor: colors.primaryContainer || colors.primaryLight }]}>
                <Ionicons name="server-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.preferenceTextCol}>
                <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>Resolver URL</Text>
                <Text style={[typography.micro, { color: colors.textSecondary }]} numberOfLines={1}>
                  {settings.backendBaseUrl}
                </Text>
              </View>
              <Pressable
                onPress={() => setIsEditingUrl(!isEditingUrl)}
                android_ripple={{ color: colors.ripple, borderless: true, radius: 20 }}
                style={styles.textActionBtn}
                accessibilityRole="button"
                accessibilityLabel="Edit resolver URL"
              >
                <Text style={[typography.labelMedium, { color: colors.primary }]}>
                  {isEditingUrl ? 'Cancel' : 'Edit'}
                </Text>
              </Pressable>
            </View>

            {isEditingUrl && (
              <View style={styles.editUrlBox}>
                <TextInput
                  style={[
                    styles.urlInput,
                    {
                      color: colors.textPrimary,
                      backgroundColor: colors.surfaceContainerLow || colors.inputBackground,
                      borderColor: colors.outlineVariant || colors.inputBorder,
                    },
                  ]}
                  value={backendUrlInput}
                  onChangeText={setBackendUrlInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="http://192.168.1.x:8080"
                  placeholderTextColor={colors.textMuted}
                />
                <View style={styles.editUrlActionRow}>
                  <Pressable
                    onPress={() => {
                      setBackendUrlInput('http://192.168.1.243:8080');
                    }}
                    style={styles.resetBtn}
                  >
                    <Text style={[typography.micro, { color: colors.textMuted }]}>Reset to Default</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSaveBackendUrl}
                    style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                  >
                    <Text style={[typography.labelMedium, { color: '#FFFFFF' }]}>Save URL</Text>
                  </Pressable>
                </View>
              </View>
            )}

            <View style={[styles.rowDivider, { backgroundColor: colors.outlineVariant || colors.surfaceBorder }]} />

            {/* Mock Mode Switch */}
            <View style={styles.preferenceRow}>
              <View style={[styles.tonalIconBox, { backgroundColor: colors.warningLight }]}>
                <Ionicons name="construct-outline" size={18} color={colors.warning} />
              </View>
              <View style={styles.preferenceTextCol}>
                <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>Mock Resolver Mode</Text>
                <Text style={[typography.micro, { color: colors.textSecondary }]}>
                  Test with offline mock fixtures
                </Text>
              </View>
              <Switch
                value={settings.useMockResolver}
                onValueChange={(val) => updateSetting({ useMockResolver: val })}
                trackColor={{ false: colors.outlineVariant || '#444444', true: colors.primary }}
                thumbColor={Platform.OS === 'android' ? (settings.useMockResolver ? '#FFFFFF' : '#888888') : undefined}
                accessibilityLabel="Toggle mock resolver mode"
              />
            </View>
          </View>
        </View>

        {/* SECTION: STORAGE & DATA */}
        <View style={styles.preferenceGroup}>
          <Text style={[typography.micro, styles.groupHeader, { color: colors.primary }]}>
            STORAGE & DATA
          </Text>

          <View style={[styles.groupContainer, { backgroundColor: colors.surfaceContainerLowest || colors.surface }]}>
            {/* Clear Temp Cache */}
            <View style={styles.preferenceRow}>
              <View style={[styles.tonalIconBox, { backgroundColor: colors.surfaceContainerLow || colors.surfaceElevated }]}>
                <Ionicons name="flash-outline" size={18} color={colors.textSecondary} />
              </View>
              <View style={styles.preferenceTextCol}>
                <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>Clear Stream Cache</Text>
                <Text style={[typography.micro, { color: colors.textSecondary }]}>
                  Delete orphaned temporary files
                </Text>
              </View>
              <Pressable
                onPress={handleClearCache}
                android_ripple={{ color: colors.ripple, borderless: false }}
                style={[styles.actionBtn, { backgroundColor: colors.surfaceContainerHigh || colors.surfaceElevated }]}
                accessibilityRole="button"
                accessibilityLabel="Clear temporary cache"
              >
                <Text style={[typography.labelMedium, { color: colors.textPrimary }]}>Clean</Text>
              </Pressable>
            </View>

            <View style={[styles.rowDivider, { backgroundColor: colors.outlineVariant || colors.surfaceBorder }]} />

            {/* Clear History & Records */}
            <View style={styles.preferenceRow}>
              <View style={[styles.tonalIconBox, { backgroundColor: colors.dangerLight }]}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </View>
              <View style={styles.preferenceTextCol}>
                <Text style={[typography.titleSmall, { color: colors.danger }]}>Clear Saved Library</Text>
                <Text style={[typography.micro, { color: colors.textSecondary }]}>
                  Wipe records or delete video files
                </Text>
              </View>
              <Pressable
                onPress={handleClearHistory}
                android_ripple={{ color: colors.ripple, borderless: false }}
                style={[styles.actionBtn, { backgroundColor: colors.dangerLight }]}
                accessibilityRole="button"
                accessibilityLabel="Clear history or delete files"
              >
                <Text style={[typography.labelMedium, { color: colors.danger }]}>Clear</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* SECTION: ABOUT & DIAGNOSTICS */}
        <View style={styles.preferenceGroup}>
          <Text style={[typography.micro, styles.groupHeader, { color: colors.primary }]}>
            APPLICATION
          </Text>

          <View style={[styles.groupContainer, { backgroundColor: colors.surfaceContainerLowest || colors.surface }]}>
            <Pressable
              onPress={() => router.push('/about')}
              android_ripple={{ color: colors.ripple }}
              style={styles.preferenceRow}
              accessibilityRole="button"
              accessibilityLabel="About ClipSave and licenses"
            >
              <View style={[styles.tonalIconBox, { backgroundColor: colors.primaryContainer || colors.primaryLight }]}>
                <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.preferenceTextCol}>
                <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>About ClipSave</Text>
                <Text style={[typography.micro, { color: colors.textSecondary }]}>
                  Version 1.0.0 • Architecture & Privacy
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
  topBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
  },
  preferenceGroup: {
    marginBottom: spacing.lg,
  },
  groupHeader: {
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacing.xs + 2,
    paddingLeft: spacing.xs,
  },
  groupContainer: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  tonalIconBox: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm + 2,
  },
  preferenceTextCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  controlRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 56,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
  },
  textActionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  editUrlBox: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  urlInput: {
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    fontSize: 14,
  },
  editUrlActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  resetBtn: {
    padding: 4,
  },
  saveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: borderRadius.md,
  },
});
