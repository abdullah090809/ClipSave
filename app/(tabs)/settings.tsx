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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { Card } from '../../src/components/Card';
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
        {/* Appearance Group */}
        <Text style={[typography.micro, styles.sectionHeader, { color: colors.textMuted }]}>
          APPEARANCE
        </Text>
        <Card variant="outlined" style={styles.card}>
          <Text style={[typography.titleMedium, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
            Theme Mode
          </Text>
          <SegmentedControl
            options={themeOptions}
            selectedValue={themeMode}
            onSelect={setThemeMode}
            accessibilityLabel="Select appearance theme mode"
          />
        </Card>

        {/* Download Behavior */}
        <Text style={[typography.micro, styles.sectionHeader, { color: colors.textMuted }]}>
          DOWNLOAD BEHAVIOR
        </Text>
        <Card variant="outlined" style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>Auto-start Download</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                Automatically start downloading immediately after resolving metadata
              </Text>
            </View>
            <Switch
              value={settings.autoDownloadOnResolve}
              onValueChange={(val) => updateSetting({ autoDownloadOnResolve: val })}
              trackColor={{ false: colors.outlineVariant || colors.surfaceBorder, true: colors.primary }}
              thumbColor={Platform.OS === 'android' ? (settings.autoDownloadOnResolve ? '#FFFFFF' : '#F4F3F4') : undefined}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.outlineVariant || colors.surfaceBorder }]} />

          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>Save to Android Gallery</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                Insert completed videos into public gallery (ClipSave album)
              </Text>
            </View>
            <Switch
              value={settings.saveToGallery}
              onValueChange={(val) => updateSetting({ saveToGallery: val })}
              trackColor={{ false: colors.outlineVariant || colors.surfaceBorder, true: colors.primary }}
              thumbColor={Platform.OS === 'android' ? (settings.saveToGallery ? '#FFFFFF' : '#F4F3F4') : undefined}
            />
          </View>
        </Card>

        {/* Resolver Configuration */}
        <Text style={[typography.micro, styles.sectionHeader, { color: colors.textMuted }]}>
          RESOLVER CONFIGURATION
        </Text>
        <Card variant="outlined" style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>Mock Resolver Mode</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                Use deterministic local test fixtures without network or extractor requests
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
              <View style={[styles.divider, { backgroundColor: colors.outlineVariant || colors.surfaceBorder }]} />
              <Text style={[typography.titleMedium, { color: colors.textPrimary, marginTop: spacing.xs }]}>
                Backend Base URL
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                FastAPI resolver host (LAN IP or domain)
              </Text>

              <View style={styles.urlInputRow}>
                <TextInput
                  style={[
                    styles.urlInput,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.outlineVariant || colors.inputBorder,
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
        <Card variant="outlined" style={styles.card}>
          <Button
            title="Clear Temporary Cache"
            icon={<Ionicons name="trash-bin-outline" size={18} color={colors.textPrimary} />}
            onPress={handleClearCache}
            variant="secondary"
            style={styles.storageBtn}
            accessibilityHint="Deletes unreferenced temporary files while keeping saved videos"
          />

          <Button
            title="Clear Download History..."
            icon={<Ionicons name="trash-outline" size={18} color={colors.danger} />}
            onPress={handleClearHistory}
            variant="ghost"
            textStyle={{ color: colors.danger }}
            style={styles.storageBtnSpacing}
            accessibilityHint="Open dialog to clear history records or saved video files"
          />
        </Card>

        {/* About & Legal Card */}
        <Card
          variant="elevated"
          onPress={() => router.push('/about')}
          style={styles.aboutCard}
          accessibilityLabel="Open About ClipSave and privacy notices"
        >
          <View style={styles.aboutRow}>
            <View style={[styles.aboutIconWrapper, { backgroundColor: colors.primaryContainer || colors.primaryLight }]}>
              <Ionicons name="information-circle" size={22} color={colors.primary} />
            </View>
            <View style={styles.aboutText}>
              <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>About ClipSave</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                Version 1.0.0 • Privacy & Legal Notices • Architecture
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </View>
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
    marginBottom: spacing.lg,
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
    minHeight: spacing.touchTargetMin,
  },
  saveUrlBtn: {
    minHeight: spacing.touchTargetMin,
    paddingHorizontal: spacing.lg,
  },
  storageBtn: {
    width: '100%',
    minHeight: spacing.touchTargetMin,
  },
  storageBtnSpacing: {
    width: '100%',
    marginTop: spacing.sm,
    minHeight: spacing.touchTargetMin,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aboutIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  aboutText: {
    flex: 1,
  },
});
