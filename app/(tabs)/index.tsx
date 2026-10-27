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
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { Button } from '../../src/components/Button';
import { IconButton } from '../../src/components/IconButton';
import { TextButton } from '../../src/components/TextButton';
import { extractAndValidateTikTokUrl } from '../../src/utils/urlValidator';
import { resolveTikTokUrl } from '../../src/services/apiClient';
import { getSettings } from '../../src/storage/settingsStore';
import { subscribeQueue } from '../../src/storage/queueStore';
import { jobProgressDetail, jobProgressFraction, jobStatusLabel, jobBucket } from '../../src/utils/jobDisplay';
import { formatBytes } from '../../src/utils/formatters';
import { DownloadJob, ResolveError } from '../../src/types';

const RECENT_LIMIT = 3;

/** One compact line per recent job. Owns its own queue subscription so typing in the field never re-renders it. */
const RecentActivity = memo(function RecentActivity() {
  const { colors } = useTheme();
  const router = useRouter();
  const [jobs, setJobs] = useState<DownloadJob[]>([]);

  useEffect(() => {
    return subscribeQueue((all) => setJobs(all.slice(0, RECENT_LIMIT)));
  }, []);

  if (jobs.length === 0) return null;

  return (
    <View style={styles.recent}>
      <View style={styles.recentHeader}>
        <Text style={[typography.titleSmall, { color: colors.textSecondary }]}>Recent</Text>
        <TextButton title="See queue" onPress={() => router.push('/(tabs)/queue')} />
      </View>
      {jobs.map((job) => {
        const bucket = jobBucket(job);
        const fraction = jobProgressFraction(job);
        const detail =
          bucket === 'active'
            ? `${jobStatusLabel(job)} · ${jobProgressDetail(job)}`
            : bucket === 'done'
            ? `Saved · ${formatBytes(job.bytesDownloaded)}`
            : `${jobStatusLabel(job)}${job.errorMessage ? ` · ${job.errorMessage}` : ''}`;
        return (
          <Pressable
            key={job.id}
            onPress={() => router.push('/(tabs)/queue')}
            android_ripple={{ color: colors.ripple }}
            style={[styles.recentRow, { borderTopColor: colors.outlineVariant }]}
            accessibilityRole="button"
            accessibilityLabel={`${job.media.title || 'Video'}, ${detail}. Open queue.`}
          >
            <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
              {job.media.title || 'TikTok video'}
            </Text>
            <Text
              style={[
                typography.bodySmall,
                { color: bucket === 'failed' ? colors.danger : colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {detail}
            </Text>
            {bucket === 'active' ? (
              <View style={[styles.thinTrack, { backgroundColor: colors.outlineVariant }]}>
                <View
                  style={[
                    styles.thinFill,
                    { backgroundColor: colors.primary, width: `${Math.round((fraction ?? 0.08) * 100)}%` },
                  ]}
                />
              </View>
            ) : null}
          </Pressable>
        );
      })}
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
  const resolvingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      getSettings()
        .then((s) => setIsMockMode(Boolean(s.useMockResolver)))
        .catch(() => {});
    }, [])
  );

  // History "Re-download" hands the saved source link back to this field.
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
    } catch {
      Alert.alert('Clipboard Access', 'Could not read from clipboard.');
    }
  };

  const handleClear = () => {
    setInputUrl('');
    setMessage(null);
  };

  const handleResolve = async () => {
    if (resolvingRef.current) return;
    if (!inputUrl.trim()) {
      setMessage({ text: 'Paste or enter a TikTok video link.', fromResolver: false });
      return;
    }
    setMessage(null);

    const validation = extractAndValidateTikTokUrl(inputUrl);
    if (!validation.isValid || !validation.normalizedUrl) {
      setMessage({
        text: validation.errorMessage || 'Invalid TikTok URL. Please check the link.',
        fromResolver: false,
      });
      return;
    }

    resolvingRef.current = true;
    setResolving(true);
    try {
      const resolvedMedia = await resolveTikTokUrl(validation.normalizedUrl);
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

  const hasText = inputUrl.length > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[typography.titleLarge, { color: colors.textPrimary }]}>ClipSave</Text>
        {isMockMode ? (
          <Pressable
            onPress={() => router.push('/(tabs)/settings')}
            style={[styles.mockChip, { borderColor: colors.warning }]}
            accessibilityRole="button"
            accessibilityLabel="Mock resolver is on. Open settings to change it."
          >
            <Text style={[typography.labelMedium, { color: colors.warning }]}>Mock mode</Text>
          </Pressable>
        ) : null}
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
          {/* Task: one field, one action */}
          <View
            style={[
              styles.field,
              {
                backgroundColor: colors.surfaceContainer,
                borderColor: message ? colors.danger : isFocused ? colors.primary : 'transparent',
              },
            ]}
          >
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              placeholder="Paste a TikTok link"
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
              accessibilityLabel="TikTok video link"
              accessibilityHint="Enter or paste a public TikTok video link"
            />
            {hasText ? (
              <IconButton icon="close-circle" label="Clear link" onPress={handleClear} color={colors.textMuted} />
            ) : (
              <TextButton
                title="Paste"
                onPress={handlePaste}
                accessibilityLabel="Paste link from clipboard"
              />
            )}
          </View>

          {/* Guidance and errors share one slot so nothing jumps */}
          <View style={styles.helperSlot} accessibilityLiveRegion="polite">
            {message ? (
              <View>
                <Text style={[typography.bodySmall, { color: colors.danger }]}>{message.text}</Text>
                {message.fromResolver ? (
                  <TextButton
                    title="Check resolver in Settings"
                    onPress={() => router.push('/(tabs)/settings')}
                    style={styles.inlineAction}
                  />
                ) : null}
              </View>
            ) : (
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                Works with tiktok.com, vm.tiktok.com and vt.tiktok.com links.
              </Text>
            )}
          </View>

          <Button
            title="Continue"
            onPress={handleResolve}
            variant="primary"
            size="lg"
            loading={resolving}
            style={styles.primary}
            accessibilityLabel="Continue and preview this video"
          />

          <Text style={[typography.bodySmall, styles.privacy, { color: colors.textMuted }]}>
            Only save videos you have permission to download.{' '}
            <Text
              style={{ color: colors.primary }}
              onPress={() => router.push('/about')}
              accessibilityRole="link"
            >
              Privacy
            </Text>
          </Text>

          <RecentActivity />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  header: {
    height: 56,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mockChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 0, minHeight: 48 },
  helperSlot: { minHeight: 40, paddingTop: spacing.sm, paddingHorizontal: spacing.xs },
  inlineAction: { alignSelf: 'flex-start', marginLeft: -12 },
  primary: { borderRadius: borderRadius.md },
  privacy: { marginTop: spacing.md, paddingHorizontal: spacing.xs },
  recent: { marginTop: spacing.xxxl },
  recentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recentRow: {
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  thinTrack: { height: 3, borderRadius: 2, marginTop: spacing.sm, overflow: 'hidden' },
  thinFill: { height: '100%', borderRadius: 2 },
});
