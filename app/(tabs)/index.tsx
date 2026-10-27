import { useState, useCallback, useEffect, useRef, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
  Image,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { Button } from '../../src/components/Button';
import { extractAndValidateTikTokUrl } from '../../src/utils/urlValidator';
import { resolveTikTokUrl } from '../../src/services/apiClient';
import { getSettings } from '../../src/storage/settingsStore';
import { subscribeQueue } from '../../src/storage/queueStore';
import { getHistory } from '../../src/storage/historyStore';
import { shareSavedMedia } from '../../src/services/mediaManager';
import { pauseDownload, resumeDownload, cancelDownload } from '../../src/services/downloadEngine';
import { jobProgressDetail, jobProgressFraction, jobStatusLabel, jobBucket } from '../../src/utils/jobDisplay';
import { formatBytes, formatDuration } from '../../src/utils/formatters';
import { DownloadJob, HistoryItem, ResolveError } from '../../src/types';

const SAMPLE_TIKTOK_URL = 'https://www.tiktok.com/@tiktok/video/7123456789012345678';

/** Live active download monitor component right on Home */
const LiveDownloadMonitor = memo(function LiveDownloadMonitor() {
  const { colors } = useTheme();
  const router = useRouter();
  const [activeJobs, setActiveJobs] = useState<DownloadJob[]>([]);

  useEffect(() => {
    return subscribeQueue((jobs) => {
      const active = jobs.filter((j) => jobBucket(j) === 'active');
      setActiveJobs(active);
    });
  }, []);

  if (activeJobs.length === 0) return null;

  const currentJob = activeJobs[0];
  const fraction = jobProgressFraction(currentJob) ?? 0.1;
  const isPaused = currentJob.state === 'PAUSED';

  return (
    <View style={[styles.liveMonitorCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.primary }]}>
      <View style={styles.liveMonitorTop}>
        <View style={[styles.livePulseDot, { backgroundColor: isPaused ? colors.warning : colors.primary }]} />
        <Text style={[typography.labelMedium, { color: isPaused ? colors.warning : colors.primary, flex: 1, marginLeft: 6 }]}>
          {isPaused ? 'DOWNLOAD PAUSED' : 'NOW DOWNLOADING'} ({activeJobs.length} active)
        </Text>
        <Pressable
          onPress={() => router.push('/(tabs)/queue')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open activity queue"
        >
          <Text style={[typography.labelMedium, { color: colors.primary }]}>View All →</Text>
        </Pressable>
      </View>

      <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600', marginTop: 4 }]} numberOfLines={1}>
        {currentJob.media.title || 'TikTok Video'}
      </Text>

      <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
        {jobStatusLabel(currentJob)} · {jobProgressDetail(currentJob)}
      </Text>

      {/* Progress track */}
      <View style={[styles.progressTrack, { backgroundColor: colors.outlineVariant }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: isPaused ? colors.warning : colors.primary,
              width: `${Math.round(fraction * 100)}%`,
            },
          ]}
        />
      </View>

      {/* Quick In-Place Action Controls */}
      <View style={styles.liveActionRow}>
        {isPaused ? (
          <Pressable
            onPress={() => resumeDownload(currentJob.id)}
            style={[styles.smallActionButton, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Resume download"
          >
            <Ionicons name="play" size={14} color="#FFFFFF" />
            <Text style={[typography.labelMedium, { color: '#FFFFFF', marginLeft: 4 }]}>Resume</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => pauseDownload(currentJob.id)}
            style={[styles.smallActionButton, { backgroundColor: colors.surface }]}
            accessibilityRole="button"
            accessibilityLabel="Pause download"
          >
            <Ionicons name="pause" size={14} color={colors.textPrimary} />
            <Text style={[typography.labelMedium, { color: colors.textPrimary, marginLeft: 4 }]}>Pause</Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => cancelDownload(currentJob.id)}
          style={[styles.smallActionButton, { backgroundColor: colors.surface, marginLeft: spacing.sm }]}
          accessibilityRole="button"
          accessibilityLabel="Cancel download"
        >
          <Ionicons name="close" size={14} color={colors.danger} />
          <Text style={[typography.labelMedium, { color: colors.danger, marginLeft: 4 }]}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
});

/** Recent Downloads showcase on Home */
const RecentDownloadsShowcase = memo(function RecentDownloadsShowcase() {
  const { colors } = useTheme();
  const router = useRouter();
  const [recents, setRecents] = useState<HistoryItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      getHistory(false).then((items) => setRecents(items.slice(0, 3))).catch(() => {});
    }, [])
  );

  if (recents.length === 0) return null;

  return (
    <View style={styles.showcaseContainer}>
      <View style={styles.showcaseHeader}>
        <Text style={[typography.titleSmall, { color: colors.textSecondary }]}>RECENT DOWNLOADS</Text>
        <Pressable
          onPress={() => router.push('/(tabs)/history')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open library"
        >
          <Text style={[typography.labelMedium, { color: colors.primary }]}>Open Library →</Text>
        </Pressable>
      </View>

      {recents.map((item) => (
        <View
          key={item.id}
          style={[styles.recentItemCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
        >
          <View style={[styles.recentThumbBox, { backgroundColor: colors.surface }]}>
            {item.thumbnailUrl ? (
              <Image source={{ uri: item.thumbnailUrl }} style={styles.recentThumbImage} resizeMode="cover" />
            ) : (
              <Ionicons name="film-outline" size={20} color={colors.textMuted} />
            )}
            {item.durationSeconds ? (
              <View style={styles.durationPill}>
                <Text style={styles.durationText}>{formatDuration(item.durationSeconds)}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.recentMeta}>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]} numberOfLines={1}>
              {item.title || 'Saved Video'}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
              {formatBytes(item.fileSizeBytes)} {item.author ? `· ${item.author}` : ''}
            </Text>
          </View>

          <Pressable
            onPress={() => shareSavedMedia(item.fileUri)}
            style={[styles.iconShareCircle, { backgroundColor: colors.primaryLight }]}
            android_ripple={{ color: colors.ripple }}
            accessibilityRole="button"
            accessibilityLabel={`Share ${item.title}`}
          >
            <Ionicons name="share-outline" size={16} color={colors.primary} />
          </Pressable>
        </View>
      ))}
    </View>
  );
});

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ prefill?: string; ts?: string }>();

  const [inputUrl, setInputUrl] = useState('');
  const [message, setMessage] = useState<{ text: string; fromResolver: boolean } | null>(null);
  const [resolving, setResolving] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isMockMode, setIsMockMode] = useState(false);
  const [clipboardDetectedUrl, setClipboardDetectedUrl] = useState<string | null>(null);
  const resolvingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      // Check mock mode
      getSettings()
        .then((s) => setIsMockMode(Boolean(s.useMockResolver)))
        .catch(() => {});

      // Smart Clipboard Detection
      Clipboard.hasStringAsync()
        .then(async (has) => {
          if (!has) return;
          const text = await Clipboard.getStringAsync();
          if (text && text.trim()) {
            const val = extractAndValidateTikTokUrl(text.trim());
            if (val.isValid && val.normalizedUrl && val.normalizedUrl !== inputUrl) {
              setClipboardDetectedUrl(val.normalizedUrl);
            }
          }
        })
        .catch(() => {});
    }, [inputUrl])
  );

  // Prefill when coming from History or external route
  useEffect(() => {
    if (params.prefill) {
      setInputUrl(params.prefill);
      setMessage(null);
    }
  }, [params.prefill, params.ts]);

  const handlePaste = async () => {
    try {
      const hasString = await Clipboard.hasStringAsync();
      const text = hasString ? await Clipboard.getStringAsync() : '';
      if (!text || !text.trim()) {
        Alert.alert('Empty Clipboard', 'Your clipboard does not contain any text.');
        return;
      }
      setInputUrl(text.trim());
      setMessage(null);
      setClipboardDetectedUrl(null);
    } catch {
      Alert.alert('Clipboard Access', 'Could not read from clipboard.');
    }
  };

  const handleClear = () => {
    setInputUrl('');
    setMessage(null);
  };

  const executeResolve = async (urlToResolve: string) => {
    if (resolvingRef.current) return;
    const validation = extractAndValidateTikTokUrl(urlToResolve);
    if (!validation.isValid || !validation.normalizedUrl) {
      setMessage({
        text: validation.errorMessage || 'Invalid TikTok URL. Please check the link.',
        fromResolver: false,
      });
      return;
    }

    resolvingRef.current = true;
    setResolving(true);
    setMessage(null);
    try {
      const resolvedMedia = await resolveTikTokUrl(validation.normalizedUrl);
      setClipboardDetectedUrl(null);
      router.push({ pathname: '/preview', params: { mediaJson: JSON.stringify(resolvedMedia) } });
    } catch (err: unknown) {
      const resolveErr = err as ResolveError;
      setMessage({
        text: resolveErr?.message || 'Unable to resolve video. Please verify your link or network.',
        fromResolver: true,
      });
    } finally {
      resolvingRef.current = false;
      setResolving(false);
    }
  };

  const handleResolve = () => {
    if (!inputUrl.trim()) {
      setMessage({ text: 'Paste or enter a TikTok video link above.', fromResolver: false });
      return;
    }
    executeResolve(inputUrl.trim());
  };

  const handleTrySample = () => {
    setInputUrl(SAMPLE_TIKTOK_URL);
    setMessage(null);
    executeResolve(SAMPLE_TIKTOK_URL);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Top Header Bar */}
      <View style={[styles.topBar, { borderBottomColor: colors.outlineVariant }]}>
        <View style={styles.brandRow}>
          <View style={[styles.brandIcon, { backgroundColor: colors.primaryContainer || colors.primaryLight }]}>
            <Ionicons name="film" size={20} color={colors.primary} />
          </View>
          <Text style={[typography.titleLarge, { color: colors.textPrimary, marginLeft: spacing.sm }]}>
            ClipSave
          </Text>
        </View>

        <View style={styles.headerActions}>
          {isMockMode ? (
            <Pressable
              onPress={() => router.push('/(tabs)/settings')}
              style={[styles.modePill, { borderColor: colors.warning, backgroundColor: colors.warningLight }]}
              accessibilityRole="button"
              accessibilityLabel="Mock mode enabled. Tap to change."
            >
              <Text style={[typography.labelMedium, { color: colors.warning }]}>Mock</Text>
            </Pressable>
          ) : (
            <View style={[styles.modePill, { borderColor: colors.success, backgroundColor: colors.successLight }]}>
              <View style={[styles.readyDot, { backgroundColor: colors.success }]} />
              <Text style={[typography.labelMedium, { color: colors.success, marginLeft: 4 }]}>Ready</Text>
            </View>
          )}

          <Pressable
            onPress={() => router.push('/(tabs)/settings')}
            style={styles.headerIconButton}
            android_ripple={{ color: colors.ripple }}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
          >
            <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Smart Clipboard Detection Banner */}
          {clipboardDetectedUrl && (
            <View style={[styles.clipboardBanner, { backgroundColor: colors.primaryContainer, borderColor: colors.primary }]}>
              <View style={styles.clipboardBannerMeta}>
                <View style={styles.clipboardRow}>
                  <Ionicons name="clipboard" size={16} color={colors.primary} />
                  <Text style={[typography.labelMedium, { color: colors.primary, marginLeft: 6 }]}>
                    Link Detected on Clipboard
                  </Text>
                </View>
                <Text style={[typography.bodySmall, { color: colors.textPrimary, marginTop: 2 }]} numberOfLines={1}>
                  {clipboardDetectedUrl}
                </Text>
              </View>

              <View style={styles.clipboardActions}>
                <Pressable
                  onPress={() => executeResolve(clipboardDetectedUrl)}
                  style={[styles.clipboardDownloadBtn, { backgroundColor: colors.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel="Download link from clipboard"
                >
                  <Text style={[typography.labelMedium, { color: '#FFFFFF' }]}>Download</Text>
                </Pressable>

                <Pressable
                  onPress={() => setClipboardDetectedUrl(null)}
                  style={styles.clipboardDismissBtn}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss clipboard link"
                >
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>
          )}

          {/* Main Download Console Hub Card */}
          <View style={[styles.consoleCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
            <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
              Download TikTok Media
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md }]}>
              Paste any public TikTok video or photo link to download cleanly without watermark.
            </Text>

            {/* Input Row */}
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: colors.surface,
                  borderColor: message ? colors.danger : isFocused ? colors.primary : colors.outlineVariant,
                },
              ]}
            >
              <Ionicons name="link-outline" size={20} color={colors.textMuted} style={styles.inputPrefixIcon} />
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                placeholder="Paste TikTok video link..."
                placeholderTextColor={colors.textMuted}
                value={inputUrl}
                onChangeText={(t) => {
                  setInputUrl(t);
                  if (message) setMessage(null);
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                onSubmitEditing={handleResolve}
                accessibilityLabel="TikTok video URL"
              />
              {inputUrl.length > 0 ? (
                <Pressable onPress={handleClear} hitSlop={8} style={styles.inputActionIcon}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </Pressable>
              ) : (
                <Pressable
                  onPress={handlePaste}
                  style={[styles.pasteChip, { backgroundColor: colors.primaryContainer }]}
                  accessibilityRole="button"
                  accessibilityLabel="Paste from clipboard"
                >
                  <Ionicons name="clipboard-outline" size={14} color={colors.primary} />
                  <Text style={[typography.labelMedium, { color: colors.primary, marginLeft: 4 }]}>Paste</Text>
                </Pressable>
              )}
            </View>

            {/* Inline message slot */}
            {message && (
              <View style={styles.messageBox}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={[typography.bodySmall, { color: colors.danger, marginLeft: 6, flex: 1 }]}>
                  {message.text}
                </Text>
                {message.fromResolver ? (
                  <Pressable onPress={() => router.push('/(tabs)/settings')} style={{ marginLeft: 6 }}>
                    <Text style={[typography.labelMedium, { color: colors.primary }]}>Settings</Text>
                  </Pressable>
                ) : null}
              </View>
            )}

            {/* Primary Action Button */}
            <Button
              title="Fetch & Download Video"
              onPress={handleResolve}
              variant="primary"
              size="lg"
              loading={resolving}
              style={styles.resolveButton}
              icon={<Ionicons name="download-outline" size={20} color="#FFFFFF" />}
              accessibilityLabel="Fetch and download video"
            />

            {/* Quick Action Helpers */}
            <View style={styles.quickChipsRow}>
              <Pressable
                onPress={handleTrySample}
                style={[styles.helperChip, { borderColor: colors.outlineVariant, backgroundColor: colors.surface }]}
                accessibilityRole="button"
                accessibilityLabel="Try sample link"
              >
                <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
                <Text style={[typography.labelMedium, { color: colors.textPrimary, marginLeft: 4 }]}>Try Sample</Text>
              </Pressable>

              <Pressable
                onPress={handlePaste}
                style={[styles.helperChip, { borderColor: colors.outlineVariant, backgroundColor: colors.surface }]}
                accessibilityRole="button"
                accessibilityLabel="Paste clipboard"
              >
                <Ionicons name="clipboard-outline" size={14} color={colors.textSecondary} />
                <Text style={[typography.labelMedium, { color: colors.textSecondary, marginLeft: 4 }]}>Paste</Text>
              </Pressable>

              <Pressable
                onPress={handleClear}
                style={[styles.helperChip, { borderColor: colors.outlineVariant, backgroundColor: colors.surface }]}
                accessibilityRole="button"
                accessibilityLabel="Clear input"
              >
                <Ionicons name="trash-outline" size={14} color={colors.textSecondary} />
                <Text style={[typography.labelMedium, { color: colors.textSecondary, marginLeft: 4 }]}>Clear</Text>
              </Pressable>
            </View>
          </View>

          {/* Feature Highlights Pills */}
          <View style={styles.featuresRow}>
            <View style={[styles.featureBadge, { backgroundColor: colors.surfaceContainer }]}>
              <Ionicons name="checkmark-done" size={14} color={colors.success} />
              <Text style={[typography.labelMedium, { color: colors.textSecondary, marginLeft: 4 }]}>No Watermark</Text>
            </View>
            <View style={[styles.featureBadge, { backgroundColor: colors.surfaceContainer }]}>
              <Ionicons name="flash-outline" size={14} color={colors.primary} />
              <Text style={[typography.labelMedium, { color: colors.textSecondary, marginLeft: 4 }]}>Fast HD</Text>
            </View>
            <View style={[styles.featureBadge, { backgroundColor: colors.surfaceContainer }]}>
              <Ionicons name="images-outline" size={14} color={colors.accent} />
              <Text style={[typography.labelMedium, { color: colors.textSecondary, marginLeft: 4 }]}>To Gallery</Text>
            </View>
          </View>

          {/* Live Now Downloading Activity Card */}
          <LiveDownloadMonitor />

          {/* Recent Downloads Showcase */}
          <RecentDownloadsShowcase />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandIcon: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  readyDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  headerIconButton: {
    padding: 6,
    borderRadius: borderRadius.full,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  clipboardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    marginBottom: spacing.md,
  },
  clipboardBannerMeta: {
    flex: 1,
  },
  clipboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clipboardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
    gap: spacing.xs,
  },
  clipboardDownloadBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: borderRadius.sm,
  },
  clipboardDismissBtn: {
    padding: 6,
  },
  consoleCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
  },
  inputPrefixIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 6,
  },
  inputActionIcon: {
    padding: 4,
  },
  pasteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  resolveButton: {
    marginTop: spacing.md,
  },
  quickChipsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  helperChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  featuresRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  featureBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
  },
  liveMonitorCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  liveMonitorTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  liveActionRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  smallActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
  },
  showcaseContainer: {
    marginTop: spacing.xs,
  },
  showcaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  recentItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  recentThumbBox: {
    width: 48,
    height: 60,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  recentThumbImage: {
    width: '100%',
    height: '100%',
  },
  durationPill: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
  },
  recentMeta: {
    flex: 1,
    marginLeft: spacing.md,
  },
  iconShareCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
});
