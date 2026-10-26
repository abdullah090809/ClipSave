import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { getSettings, saveSettings } from '../../src/storage/settingsStore';
import { cleanOrphanedTempFiles } from '../../src/services/mediaManager';
import { clearHistoryEntriesOnly, clearHistoryAndFiles } from '../../src/storage/historyStore';
import { AppSettings, ThemeMode } from '../../src/types';

export default function SettingsScreen() {
  const { colors, themeMode, setThemeMode } = useTheme();
  const router = useRouter();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [backendUrlInput, setBackendUrlInput] = useState('');

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
      'Clear History',
      'Choose an action to clear your history:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Records Only',
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
    Alert.alert('Saved', 'Resolver backend URL updated.');
  };

  if (!settings) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[typography.h1, { color: colors.textPrimary }]}>Settings</Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
            Preferences, storage, and backend configuration
          </Text>
        </View>

        {/* Theme Section */}
        <Text style={[typography.micro, styles.sectionHeader, { color: colors.textMuted }]}>
          APPEARANCE
        </Text>
        <Card style={styles.card}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>Theme Mode</Text>
          <View style={styles.themeRow}>
            {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => {
              const active = themeMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  onPress={() => setThemeMode(mode)}
                  style={[
                    styles.themeBtn,
                    {
                      backgroundColor: active ? colors.primaryLight : colors.surfaceElevated,
                      borderColor: active ? colors.primary : colors.surfaceBorder,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Switch to ${mode} theme`}
                >
                  <Ionicons
                    name={mode === 'system' ? 'hardware-chip-outline' : mode === 'light' ? 'sunny-outline' : 'moon-outline'}
                    size={18}
                    color={active ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      typography.captionMedium,
                      { color: active ? colors.primary : colors.textPrimary, textTransform: 'capitalize' },
                    ]}
                  >
                    {mode}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Download Behavior */}
        <Text style={[typography.micro, styles.sectionHeader, { color: colors.textMuted }]}>
          DOWNLOAD BEHAVIOR
        </Text>
        <Card style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>Auto-start Download</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Automatically start downloading immediately after resolving metadata
              </Text>
            </View>
            <Switch
              value={settings.autoDownloadOnResolve}
              onValueChange={(val) => updateSetting({ autoDownloadOnResolve: val })}
              trackColor={{ false: colors.surfaceBorder, true: colors.primary }}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.surfaceBorder }]} />

          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>Save to Android Gallery</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Insert completed videos into public gallery (ClipSave album)
              </Text>
            </View>
            <Switch
              value={settings.saveToGallery}
              onValueChange={(val) => updateSetting({ saveToGallery: val })}
              trackColor={{ false: colors.surfaceBorder, true: colors.primary }}
            />
          </View>
        </Card>

        {/* Backend & Developer Mode */}
        <Text style={[typography.micro, styles.sectionHeader, { color: colors.textMuted }]}>
          RESOLVER CONFIGURATION
        </Text>
        <Card style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>Mock Resolver Mode</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Use deterministic local test fixtures without network or extractor requests
              </Text>
            </View>
            <Switch
              value={settings.useMockResolver}
              onValueChange={(val) => updateSetting({ useMockResolver: val })}
              trackColor={{ false: colors.surfaceBorder, true: colors.primary }}
            />
          </View>

          {!settings.useMockResolver && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.surfaceBorder }]} />
              <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.sm }]}>
                Backend Base URL
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                FastAPI resolver host (default: http://127.0.0.1:8080)
              </Text>

              <View style={styles.urlInputRow}>
                <TextInput
                  style={[
                    styles.urlInput,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.inputBorder,
                      color: colors.textPrimary,
                    },
                  ]}
                  value={backendUrlInput}
                  onChangeText={setBackendUrlInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="http://127.0.0.1:8080"
                  placeholderTextColor={colors.textMuted}
                />
                <Button
                  title="Save"
                  onPress={handleSaveBackendUrl}
                  variant="primary"
                  style={styles.saveUrlBtn}
                />
              </View>
            </>
          )}
        </Card>

        {/* Data & Storage */}
        <Text style={[typography.micro, styles.sectionHeader, { color: colors.textMuted }]}>
          STORAGE & DATA
        </Text>
        <Card style={styles.card}>
          <Button
            title="Clear Temporary Cache"
            icon={<Ionicons name="trash-bin-outline" size={18} color={colors.textPrimary} />}
            onPress={handleClearCache}
            variant="secondary"
            style={styles.storageBtn}
          />

          <Button
            title="Clear Download History..."
            icon={<Ionicons name="trash-outline" size={18} color={colors.danger} />}
            onPress={handleClearHistory}
            variant="ghost"
            textStyle={{ color: colors.danger }}
            style={styles.storageBtnSpacing}
          />
        </Card>

        {/* About & Legal Link */}
        <Card elevated style={styles.aboutCard}>
          <TouchableOpacity
            style={styles.aboutRow}
            onPress={() => router.push('/about')}
            accessibilityRole="button"
            accessibilityLabel="View About, Privacy & Open Source Notices"
          >
            <View style={styles.aboutText}>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>About ClipSave</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Version 1.0.0 • Privacy & Legal Disclosures • Licenses
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  card: {
    marginHorizontal: spacing.lg,
  },
  aboutCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  themeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  themeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    minHeight: 44,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  switchText: {
    flex: 1,
  },
  divider: {
    height: 1,
    marginVertical: spacing.md,
  },
  urlInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  urlInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    minHeight: 44,
  },
  saveUrlBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  storageBtn: {
    width: '100%',
  },
  storageBtnSpacing: {
    width: '100%',
    marginTop: spacing.sm,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aboutText: {
    flex: 1,
  },
});
