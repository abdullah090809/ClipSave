import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { cleanOrphanedTempFiles } from '../../src/services/mediaManager';
import { clearHistoryEntriesOnly, clearHistoryAndFiles } from '../../src/storage/historyStore';
import { ThemeMode } from '../../src/types';

export default function SettingsScreen() {
  const { colors, themeMode, setThemeMode } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [clearing, setClearing] = useState(false);

  const handleClearCache = useCallback(() => {
    Alert.alert(
      'Purge Temporary Files?',
      'Removes leftover download chunks that are no longer needed. Saved videos and history are never touched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purge Now',
          onPress: async () => {
            setClearing(true);
            try {
              const count = await cleanOrphanedTempFiles();
              Alert.alert('Cache Purged', `Cleared ${count} temporary ${count === 1 ? 'file' : 'files'}.`);
            } finally {
              setClearing(false);
            }
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
          style={[styles.aboutPill, { backgroundColor: colors.surfaceContainer }]}
          android_ripple={{ color: colors.ripple }}
          accessibilityRole="button"
          accessibilityLabel="About ClipSave"
        >
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
          <Text style={[typography.labelMedium, { color: colors.primary, marginLeft: 4 }]}>About</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* App Hero Card */}
        <View style={[styles.card, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
          <View style={styles.heroRow}>
            <View style={[styles.appIconBox, { backgroundColor: colors.primaryContainer || colors.primaryLight }]}>
              <Ionicons name="film" size={26} color={colors.primary} />
            </View>
            <View style={styles.heroMeta}>
              <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>ClipSave</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                TikTok Video Downloader · 100% Ad-Free
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
        </View>

        {/* Section: Storage & Maintenance */}
        <View style={styles.sectionHeader}>
          <Text style={[typography.titleSmall, { color: colors.textSecondary }]}>STORAGE & CLEANUP</Text>
        </View>
        <View style={[styles.card, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
          <Pressable
            onPress={handleClearCache}
            disabled={clearing}
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
                Delete orphaned partial files without touching saved videos.
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
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
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
