import { useState, useCallback, useEffect } from 'react';
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
import { useRouter, useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius, elevation } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { extractAndValidateTikTokUrl } from '../../src/utils/urlValidator';
import { resolveTikTokUrl } from '../../src/services/apiClient';
import { getSettings } from '../../src/storage/settingsStore';
import { subscribeQueue } from '../../src/storage/queueStore';
import { formatBytes } from '../../src/utils/formatters';
import { DownloadJob, ResolveError } from '../../src/types';

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const [inputUrl, setInputUrl] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isMockMode, setIsMockMode] = useState(false);
  const [activeJobs, setActiveJobs] = useState<DownloadJob[]>([]);

  useFocusEffect(
    useCallback(() => {
      getSettings().then((s) => setIsMockMode(Boolean(s.useMockResolver))).catch(() => {});
    }, [])
  );

  useEffect(() => {
    return subscribeQueue((jobs) => {
      const active = jobs.filter(
        (j) => j.state === 'DOWNLOADING' || j.state === 'FINALIZING' || j.state === 'QUEUED'
      );
      setActiveJobs(active);
    });
  }, []);

  const handlePaste = async () => {
    try {
      const hasString = await Clipboard.hasStringAsync();
      if (!hasString) {
        Alert.alert('Empty Clipboard', 'Your clipboard does not contain any text.');
        return;
      }
      const text = await Clipboard.getStringAsync();
      if (!text || !text.trim()) {
        Alert.alert('Empty Clipboard', 'Your clipboard does not contain any text.');
        return;
      }
      setInputUrl(text.trim());
      setValidationError(null);
    } catch {
      Alert.alert('Clipboard Access', 'Could not read from clipboard.');
    }
  };

  const handleClear = () => {
    setInputUrl('');
    setValidationError(null);
  };

  const handleResolve = async () => {
    if (!inputUrl.trim()) {
      setValidationError('Please paste or enter a TikTok video link.');
      return;
    }

    setValidationError(null);

    const validation = extractAndValidateTikTokUrl(inputUrl);
    if (!validation.isValid || !validation.normalizedUrl) {
      setValidationError(validation.errorMessage || 'Invalid TikTok URL. Please check the link.');
      return;
    }

    setResolving(true);
    try {
      const resolvedMedia = await resolveTikTokUrl(validation.normalizedUrl);
      setResolving(false);

      router.push({
        pathname: '/preview',
        params: {
          mediaJson: JSON.stringify(resolvedMedia),
        },
      });
    } catch (err: any) {
      setResolving(false);
      const resolveErr = err as ResolveError;
      setValidationError(resolveErr.message || 'Unable to resolve video. Please verify your link or network.');
    }
  };

  const currentActiveJob = activeJobs[0];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Top Application Bar */}
      <View style={styles.topAppBar}>
        <View style={styles.brandTitleRow}>
          <View
            style={[
              styles.appIconBadge,
              { backgroundColor: colors.primaryContainer || colors.primaryLight },
            ]}
          >
            <Ionicons name="film" size={20} color={colors.primary} />
          </View>
          <View style={{ marginLeft: spacing.sm }}>
            <Text style={[typography.titleLarge, { color: colors.textPrimary }]}>ClipSave</Text>
            <Text style={[typography.micro, { color: colors.textMuted }]}>TikTok Downloader</Text>
          </View>
        </View>

        <View style={styles.topBarActions}>
          {isMockMode && (
            <Pressable
              onPress={() => router.push('/(tabs)/settings')}
              style={[styles.mockModeChip, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}
              accessibilityRole="button"
              accessibilityLabel="Mock mode active, tap to change in settings"
            >
              <Ionicons name="construct-outline" size={13} color={colors.warning} />
              <Text style={[typography.labelMedium, { color: colors.warning, marginLeft: 4 }]}>Mock Mode</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => router.push('/(tabs)/settings')}
            android_ripple={{ color: colors.ripple, borderless: true, radius: 24 }}
            style={styles.topSettingsBtn}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
          >
            <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Primary Action Console (Floating Hero Deck) */}
          <View
            style={[
              styles.actionConsole,
              {
                backgroundColor: colors.surfaceContainerLowest || colors.surface,
                borderColor: isInputFocused ? colors.primary : colors.outlineVariant || colors.surfaceBorder,
              },
              Platform.OS === 'android' ? elevation.level2 : {},
            ]}
          >
            <View style={styles.consoleHeader}>
              <Text style={[typography.headlineMedium, { color: colors.textPrimary }]}>
                Download Video
              </Text>
              <Pressable
                onPress={handlePaste}
                android_ripple={{ color: colors.ripple, borderless: false }}
                style={[
                  styles.pasteChip,
                  {
                    backgroundColor: colors.primaryContainer || colors.primaryLight,
                    borderColor: colors.primary,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Paste link from clipboard"
              >
                <Ionicons name="clipboard-outline" size={15} color={colors.primary} />
                <Text style={[typography.labelMedium, { color: colors.primary, marginLeft: 4 }]}>
                  Paste Link
                </Text>
              </Pressable>
            </View>

            {/* URL Input Box */}
            <View
              style={[
                styles.urlInputContainer,
                {
                  backgroundColor: colors.surfaceContainerLow || colors.inputBackground,
                  borderColor: validationError
                    ? colors.danger
                    : isInputFocused
                    ? colors.primary
                    : colors.outlineVariant || colors.inputBorder,
                },
              ]}
            >
              <Ionicons
                name="link-outline"
                size={20}
                color={isInputFocused ? colors.primary : colors.textMuted}
                style={styles.linkIcon}
              />
              <TextInput
                style={[styles.urlTextInput, { color: colors.textPrimary }]}
                placeholder="Paste TikTok video link here..."
                placeholderTextColor={colors.textMuted}
                value={inputUrl}
                onChangeText={(t) => {
                  setInputUrl(t);
                  if (validationError) setValidationError(null);
                }}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                onSubmitEditing={handleResolve}
                editable={!resolving}
                accessibilityLabel="TikTok Video URL Input"
                accessibilityHint="Enter or paste a valid public TikTok video link"
              />
              {inputUrl.length > 0 && (
                <Pressable
                  onPress={handleClear}
                  android_ripple={{ color: colors.ripple, borderless: true, radius: 20 }}
                  style={styles.clearBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Clear URL input"
                >
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </Pressable>
              )}
            </View>

            {/* Inline Error Callout */}
            {validationError && (
              <View
                style={[styles.errorCallout, { backgroundColor: colors.dangerLight }]}
                accessible={true}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text style={[typography.bodySmall, { color: colors.danger, marginLeft: spacing.xs, flex: 1 }]}>
                  {validationError}
                </Text>
              </View>
            )}

            {/* Dominant Primary Action */}
            <Button
              title="Resolve & Preview"
              icon={<Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
              onPress={handleResolve}
              variant="primary"
              size="lg"
              loading={resolving}
              style={styles.resolveButton}
              accessibilityLabel="Resolve video and show preview"
            />
          </View>

          {/* Active Download Live Shelf (Shows when downloads are running) */}
          {currentActiveJob && (
            <Card
              variant="elevated"
              onPress={() => router.push('/(tabs)/queue')}
              style={styles.activeShelfCard}
              accessibilityLabel="View active download in queue"
            >
              <View style={styles.shelfHeader}>
                <View style={styles.shelfTitleGroup}>
                  <View style={[styles.pulseDot, { backgroundColor: colors.primary }]} />
                  <Text style={[typography.labelMedium, { color: colors.primary }]}>
                    DOWNLOAD IN PROGRESS
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </View>
              <Text style={[typography.titleSmall, { color: colors.textPrimary, marginTop: 4 }]} numberOfLines={1}>
                {currentActiveJob.media.title || 'TikTok Video'}
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                {formatBytes(currentActiveJob.bytesDownloaded)}
                {currentActiveJob.totalBytes ? ` / ${formatBytes(currentActiveJob.totalBytes)}` : ' streaming'} • {currentActiveJob.statusMessage}
              </Text>
            </Card>
          )}

          {/* Quick Workflow Stepper (Compact 3-Step Row) */}
          <View style={styles.workflowContainer}>
            <Text style={[typography.micro, { color: colors.textMuted, marginBottom: spacing.sm }]}>
              HOW CLIPSAVE WORKS
            </Text>
            <View
              style={[
                styles.workflowRow,
                {
                  backgroundColor: colors.surfaceContainerLow || colors.surfaceElevated,
                  borderColor: colors.outlineVariant || colors.surfaceBorder,
                },
              ]}
            >
              <View style={styles.stepItem}>
                <View style={[styles.stepNumberBadge, { backgroundColor: colors.primaryContainer || colors.primaryLight }]}>
                  <Text style={[typography.labelMedium, { color: colors.primary }]}>1</Text>
                </View>
                <Text style={[typography.labelMedium, { color: colors.textPrimary, marginTop: 6 }]}>
                  Copy Link
                </Text>
                <Text style={[typography.micro, { color: colors.textMuted, marginTop: 2 }]}>
                  from TikTok
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={16} color={colors.outlineVariant || colors.surfaceBorder} />

              <View style={styles.stepItem}>
                <View style={[styles.stepNumberBadge, { backgroundColor: colors.primaryContainer || colors.primaryLight }]}>
                  <Text style={[typography.labelMedium, { color: colors.primary }]}>2</Text>
                </View>
                <Text style={[typography.labelMedium, { color: colors.textPrimary, marginTop: 6 }]}>
                  Paste & Verify
                </Text>
                <Text style={[typography.micro, { color: colors.textMuted, marginTop: 2 }]}>
                  clean stream
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={16} color={colors.outlineVariant || colors.surfaceBorder} />

              <View style={styles.stepItem}>
                <View style={[styles.stepNumberBadge, { backgroundColor: colors.primaryContainer || colors.primaryLight }]}>
                  <Text style={[typography.labelMedium, { color: colors.primary }]}>3</Text>
                </View>
                <Text style={[typography.labelMedium, { color: colors.textPrimary, marginTop: 6 }]}>
                  Save to Phone
                </Text>
                <Text style={[typography.micro, { color: colors.textMuted, marginTop: 2 }]}>
                  gallery or files
                </Text>
              </View>
            </View>
          </View>

          {/* Trust & Transparency Minimal Footer */}
          <View style={styles.transparencyFooter}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.textMuted} />
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginLeft: 6, flex: 1 }]}>
              ClipSave does not bypass private accounts. Zero tracking, local device storage.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topAppBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appIconBadge: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  mockModeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  topSettingsBtn: {
    width: spacing.touchTargetMin,
    height: spacing.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxxl,
  },
  actionConsole: {
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    padding: spacing.xl,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  consoleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pasteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  urlInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    minHeight: 56,
  },
  linkIcon: {
    marginRight: spacing.sm,
  },
  urlTextInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: spacing.sm,
  },
  clearBtn: {
    width: spacing.touchTargetMin,
    height: spacing.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  resolveButton: {
    marginTop: spacing.lg,
    width: '100%',
  },
  activeShelfCard: {
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  shelfHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shelfTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  workflowContainer: {
    marginBottom: spacing.lg,
  },
  workflowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transparencyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
});
