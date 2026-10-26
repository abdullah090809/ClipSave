import { useState, useCallback, useEffect, memo } from 'react';
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
import { ProgressBar } from '../../src/components/ProgressBar';
import { extractAndValidateTikTokUrl } from '../../src/utils/urlValidator';
import { resolveTikTokUrl } from '../../src/services/apiClient';
import { getSettings } from '../../src/storage/settingsStore';
import { subscribeQueue } from '../../src/storage/queueStore';
import { formatBytes } from '../../src/utils/formatters';
import { DownloadJob, ResolveError } from '../../src/types';

// Isolated active download banner: subscribes independently to avoid rerendering the URL input
const ActiveLiveShelf = memo(() => {
  const { colors } = useTheme();
  const router = useRouter();
  const [activeJob, setActiveJob] = useState<DownloadJob | null>(null);

  useEffect(() => {
    return subscribeQueue((jobs) => {
      const active = jobs.find(
        (j) => j.state === 'DOWNLOADING' || j.state === 'FINALIZING' || j.state === 'QUEUED'
      );
      setActiveJob(active || null);
    });
  }, []);

  if (!activeJob) return null;

  const progressFraction =
    activeJob.totalBytes && activeJob.totalBytes > 0
      ? activeJob.bytesDownloaded / activeJob.totalBytes
      : undefined;

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/queue')}
      android_ripple={{ color: colors.ripple }}
      style={[
        styles.activeShelfBar,
        {
          backgroundColor: colors.surfaceContainerLow || colors.surface,
          borderColor: colors.primary,
        },
        Platform.OS === 'android' ? elevation.level1 : {},
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Active download in progress: ${activeJob.media.title}. Tap to open queue.`}
    >
      <View style={styles.shelfTopRow}>
        <View style={styles.shelfStatusGroup}>
          <View style={[styles.pulseDot, { backgroundColor: colors.primary }]} />
          <Text style={[typography.labelMedium, { color: colors.primary }]}>
            ACTIVE DOWNLOAD
          </Text>
        </View>
        <Text style={[typography.micro, { color: colors.textMuted }]}>View Queue →</Text>
      </View>
      <Text style={[typography.titleSmall, { color: colors.textPrimary, marginTop: 4 }]} numberOfLines={1}>
        {activeJob.media.title || 'Downloading media stream...'}
      </Text>
      <View style={{ marginTop: 8 }}>
        <ProgressBar
          progress={progressFraction}
          statusLabel={`${formatBytes(activeJob.bytesDownloaded)} / ${formatBytes(activeJob.totalBytes)}`}
          showPercentage={true}
        />
      </View>
    </Pressable>
  );
});
ActiveLiveShelf.displayName = 'ActiveLiveShelf';

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const [inputUrl, setInputUrl] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isMockMode, setIsMockMode] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getSettings().then((s) => setIsMockMode(Boolean(s.useMockResolver))).catch(() => {});
    }, [])
  );

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Top Application Bar - Compact 48dp */}
      <View style={styles.topAppBar}>
        <View style={styles.brandRow}>
          <Text style={[typography.headlineMedium, { color: colors.textPrimary, letterSpacing: -0.3 }]}>
            ClipSave
          </Text>
          {isMockMode && (
            <Pressable
              onPress={() => router.push('/(tabs)/settings')}
              style={[styles.mockModeChip, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}
              accessibilityRole="button"
              accessibilityLabel="Mock mode active, tap to change in settings"
            >
              <Text style={[typography.micro, { color: colors.warning, fontWeight: '700' }]}>MOCK</Text>
            </Pressable>
          )}
        </View>

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
          {/* Dominant Hero Download Input Area (No enclosing card) */}
          <View style={styles.heroSection}>
            <Text style={[typography.titleLarge, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              Enter Video Link
            </Text>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginBottom: spacing.md }]}>
              Paste a public TikTok URL to resolve and save media
            </Text>

            {/* Unified Input Bar with Integrated Paste Action */}
            <View
              style={[
                styles.unifiedInputBar,
                {
                  backgroundColor: colors.surfaceContainerLow || colors.inputBackground,
                  borderColor: isInputFocused ? colors.primary : colors.outlineVariant || colors.inputBorder,
                },
              ]}
            >
              <Ionicons
                name="link-outline"
                size={20}
                color={isInputFocused ? colors.primary : colors.textMuted}
                style={styles.inputLeftIcon}
              />
              <TextInput
                style={[styles.textInput, { color: colors.textPrimary }]}
                placeholder="https://www.tiktok.com/@..."
                placeholderTextColor={colors.textMuted}
                value={inputUrl}
                onChangeText={(text) => {
                  setInputUrl(text);
                  if (validationError) setValidationError(null);
                }}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                onSubmitEditing={handleResolve}
                accessibilityLabel="TikTok video link input"
                accessibilityHint="Enter or paste a valid public TikTok video link"
              />

              {inputUrl.length > 0 ? (
                <Pressable
                  onPress={handleClear}
                  android_ripple={{ color: colors.ripple, borderless: true, radius: 20 }}
                  style={styles.inputActionBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Clear URL input"
                >
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </Pressable>
              ) : (
                <Pressable
                  onPress={handlePaste}
                  android_ripple={{ color: colors.ripple, borderless: false }}
                  style={[
                    styles.inlinePasteBtn,
                    { backgroundColor: colors.primaryContainer || colors.primaryLight },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Paste link from clipboard"
                >
                  <Ionicons name="clipboard-outline" size={14} color={colors.primary} />
                  <Text style={[typography.labelMedium, { color: colors.primary, marginLeft: 4 }]}>
                    Paste
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Inline Error Notice */}
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

            {/* Dominant Full-Width Primary Action */}
            <Button
              title="Resolve Video"
              icon={<Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
              onPress={handleResolve}
              variant="primary"
              size="lg"
              loading={resolving}
              style={styles.resolveButton}
              accessibilityLabel="Resolve video and show preview"
            />
          </View>

          {/* Active Download Live Shelf (Subscribes independently) */}
          <ActiveLiveShelf />

          {/* How It Works Guidance Stepper */}
          <View style={styles.workflowSection}>
            <Text style={[typography.titleSmall, { color: colors.textSecondary, marginBottom: spacing.md }]}>
              HOW IT WORKS
            </Text>

            <View style={styles.stepsContainer}>
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepBadge,
                    { backgroundColor: colors.surfaceContainerLow || colors.surfaceElevated },
                  ]}
                >
                  <Ionicons name="copy-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.stepTextWrapper}>
                  <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>1. Copy Link</Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    Copy a TikTok video share link from the app
                  </Text>
                </View>
              </View>

              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepBadge,
                    { backgroundColor: colors.surfaceContainerLow || colors.surfaceElevated },
                  ]}
                >
                  <Ionicons name="search-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.stepTextWrapper}>
                  <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>2. Inspect & Preview</Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    Resolve video stream, author details, and file size
                  </Text>
                </View>
              </View>

              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepBadge,
                    { backgroundColor: colors.surfaceContainerLow || colors.surfaceElevated },
                  ]}
                >
                  <Ionicons name="download-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.stepTextWrapper}>
                  <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>3. Save to Device</Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    Download chunked video file safely to local storage
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Minimalist Transparency Disclaimer */}
          <View style={styles.disclaimerContainer}>
            <Ionicons name="shield-checkmark-outline" size={15} color={colors.textMuted} />
            <Text style={[typography.micro, { color: colors.textMuted, marginLeft: 6, flex: 1 }]}>
              ClipSave only processes authorized public media links. Download media only with permission.
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
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mockModeChip: {
    marginLeft: spacing.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  topSettingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  heroSection: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  unifiedInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  inputLeftIcon: {
    marginRight: spacing.xs,
  },
  textInput: {
    flex: 1,
    height: 48,
    fontSize: 15,
    paddingVertical: 0,
  },
  inputActionBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlinePasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 32,
    borderRadius: borderRadius.sm,
  },
  errorCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  resolveButton: {
    height: 52,
    borderRadius: borderRadius.lg,
  },
  activeShelfBar: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    marginBottom: spacing.lg,
  },
  shelfTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shelfStatusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  workflowSection: {
    marginBottom: spacing.lg,
  },
  stepsContainer: {
    gap: spacing.sm,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepBadge: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm + 2,
  },
  stepTextWrapper: {
    flex: 1,
  },
  disclaimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
});
