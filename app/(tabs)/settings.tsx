import { useState, useEffect, useCallback, ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TextInput, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { SegmentedControl, SegmentOption } from '../../src/components/SegmentedControl';
import { TextButton } from '../../src/components/TextButton';
import { getSettings, saveSettings, getDefaultBackendUrl } from '../../src/storage/settingsStore';
import { cleanOrphanedTempFiles } from '../../src/services/mediaManager';
import { clearHistoryEntriesOnly, clearHistoryAndFiles } from '../../src/storage/historyStore';
import { AppSettings, ThemeMode } from '../../src/types';

const THEME_OPTIONS: SegmentOption<ThemeMode>[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function Group({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[typography.titleSmall, styles.groupTitle, { color: colors.primary }]}>{title}</Text>
      {children}
    </View>
  );
}

interface RowProps {
  label: string;
  description?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  tone?: 'default' | 'danger';
  last?: boolean;
}

function Row({ label, description, trailing, onPress, tone = 'default', last }: RowProps) {
  const { colors } = useTheme();
  const content = (
    <>
      <View style={styles.rowText}>
        <Text
          style={[typography.bodyMedium, { color: tone === 'danger' ? colors.danger : colors.textPrimary }]}
        >
          {label}
        </Text>
        {description ? (
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
      {trailing}
    </>
  );
  const border = last ? null : { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.outlineVariant };
  return onPress ? (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.ripple }}
      style={[styles.row, border]}
      accessibilityRole="button"
      accessibilityLabel={description ? `${label}. ${description}` : label}
    >
      {content}
    </Pressable>
  ) : (
    <View style={[styles.row, border]}>{content}</View>
  );
}

export default function SettingsScreen() {
  const { colors, themeMode, setThemeMode } = useTheme();
  const router = useRouter();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [editingUrl, setEditingUrl] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setUrlInput(s.backendBaseUrl);
    });
  }, []);

  const updateSetting = useCallback(async (patch: Partial<AppSettings>) => {
    setSettings(await saveSettings(patch));
  }, []);

  const handleClearCache = useCallback(() => {
    Alert.alert(
      'Clear temporary files?',
      'Removes leftover partial downloads that no active, paused or retryable download needs. Saved videos and history are not touched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: async () => {
            const count = await cleanOrphanedTempFiles();
            Alert.alert('Done', `Removed ${count} temporary ${count === 1 ? 'file' : 'files'}.`);
          },
        },
      ]
    );
  }, []);

  const handleClearHistory = useCallback(() => {
    Alert.alert('Clear history', 'What should be cleared?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Records only (keep files)',
        onPress: async () => {
          await clearHistoryEntriesOnly();
          Alert.alert('Done', 'History records cleared. Saved video files were kept.');
        },
      },
      {
        text: 'Records and video files…',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            'Delete all saved videos?',
            'Every saved video file and its history record will be permanently deleted from this device. This can’t be undone.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete everything',
                style: 'destructive',
                onPress: async () => {
                  await clearHistoryAndFiles();
                  Alert.alert('Done', 'All saved videos and history records were deleted.');
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
  }, [urlInput, updateSetting]);

  if (!settings) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[typography.titleLarge, { color: colors.textPrimary }]}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Group title="Appearance">
          <View style={styles.themeRow}>
            <SegmentedControl
              options={THEME_OPTIONS}
              selectedValue={themeMode}
              onSelect={setThemeMode}
              accessibilityLabel="Theme"
            />
          </View>
        </Group>

        <Group title="Connection">
          <Row
            label="Resolver URL"
            description={settings.backendBaseUrl}
            last={!editingUrl}
            trailing={
              <TextButton
                title={editingUrl ? 'Cancel' : 'Edit'}
                onPress={() => {
                  setUrlInput(settings.backendBaseUrl);
                  setEditingUrl(!editingUrl);
                }}
                accessibilityLabel={editingUrl ? 'Cancel editing resolver URL' : 'Edit resolver URL'}
              />
            }
          />
          {editingUrl ? (
            <View style={styles.editBox}>
              <TextInput
                style={[
                  styles.urlInput,
                  { color: colors.textPrimary, backgroundColor: colors.surfaceContainer },
                ]}
                value={urlInput}
                onChangeText={setUrlInput}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="http://192.168.1.x:8080"
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="Resolver URL"
              />
              <View style={styles.editActions}>
                <TextButton
                  title="Reset to default"
                  tone="neutral"
                  onPress={() => setUrlInput(getDefaultBackendUrl())}
                />
                <TextButton title="Save" onPress={handleSaveUrl} />
              </View>
            </View>
          ) : null}
        </Group>

        <Group title="Development">
          <Row
            label="Mock resolver"
            description="Use built-in sample data instead of the backend. For testing only."
            last
            trailing={
              <Switch
                value={settings.useMockResolver}
                onValueChange={(v) => updateSetting({ useMockResolver: v })}
                trackColor={{ false: colors.outline, true: colors.primary }}
                thumbColor="#FFFFFF"
                accessibilityLabel="Mock resolver mode"
              />
            }
          />
        </Group>

        <Group title="Storage">
          <Row
            label="Clear temporary files"
            description="Remove leftover partial downloads"
            onPress={handleClearCache}
          />
          <Row
            label="Clear history…"
            description="Remove records, optionally with the saved video files"
            tone="danger"
            last
            onPress={handleClearHistory}
          />
        </Group>

        <Group title="About">
          <Row
            label="About, privacy and licenses"
            description="Version 1.0.0"
            last
            onPress={() => router.push('/about')}
            trailing={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
          />
        </Group>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 56, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  content: { paddingBottom: spacing.huge },
  group: { marginTop: spacing.lg },
  groupTitle: { paddingHorizontal: spacing.lg, marginBottom: spacing.xs },
  row: {
    minHeight: 56,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 0,
  },
  rowText: { flex: 1, paddingRight: spacing.sm },
  themeRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  editBox: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  urlInput: { height: 48, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, fontSize: 15 },
  editActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
});
