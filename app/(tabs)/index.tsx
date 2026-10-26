import { useState, useCallback } from 'react';
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
import { DisclaimerBanner } from '../../src/components/DisclaimerBanner';
import { extractAndValidateTikTokUrl } from '../../src/utils/urlValidator';
import { resolveTikTokUrl } from '../../src/services/apiClient';
import { getSettings } from '../../src/storage/settingsStore';
import { ResolveError } from '../../src/types';

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
          {/* Mock Resolver Mode Notice (Dev) */}
          {isMockMode && (
            <View
              style={[
                styles.mockBanner,
                {
                  backgroundColor: colors.warningLight,
                  borderColor: colors.warning,
                },
              ]}
              accessible={true}
              accessibilityRole="alert"
            >
              <Ionicons name="construct-outline" size={16} color={colors.warning} />
              <Text style={[typography.labelMedium, { color: colors.warning, marginLeft: spacing.xs, flex: 1 }]}>
                Mock Resolver Mode Active (Offline Fixtures)
              </Text>
            </View>
          )}

          {/* Hero Branding */}
          <View style={styles.brandHero}>
            <View
              style={[
                styles.logoBadge,
                {
                  backgroundColor: colors.primaryContainer || colors.primaryLight,
                  borderColor: colors.primary,
                },
                Platform.OS === 'android' ? elevation.level1 : {},
              ]}
            >
              <Ionicons name="film" size={28} color={colors.primary} />
            </View>
            <Text style={[typography.display, { color: colors.textPrimary, marginTop: spacing.md }]}>
              ClipSave
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: 2, textAlign: 'center' }]}>
              Fast, watermark-free media downloader
            </Text>
          </View>

          {/* Transparency / Compliance Notice */}
          <DisclaimerBanner />

          {/* Main Download Card */}
          <Card variant="elevated" style={styles.inputCard}>
            <Text style={[typography.titleLarge, { color: colors.textPrimary }]}>
              Download TikTok Video
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 2 }]}>
              Paste any public video link from tiktok.com or vt.tiktok.com
            </Text>

            {/* Input Field Container */}
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: validationError
                    ? colors.danger
                    : isInputFocused
                    ? colors.primary
                    : colors.outlineVariant || colors.inputBorder,
                },
              ]}
            >
              <Ionicons
                name="link"
                size={20}
                color={isInputFocused ? colors.primary : colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.textInput, { color: colors.textPrimary }]}
                placeholder="https://www.tiktok.com/@user/video/..."
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
                  style={styles.clearIconButton}
                  accessibilityRole="button"
                  accessibilityLabel="Clear URL input"
                >
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </Pressable>
              )}
            </View>

            {/* Inline Error Message */}
            {validationError && (
              <View
                style={[styles.errorContainer, { backgroundColor: colors.dangerLight }]}
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

            {/* Action Buttons Row */}
            <View style={styles.actionRow}>
              <Button
                title="Paste"
                icon={<Ionicons name="clipboard-outline" size={18} color={colors.textPrimary} />}
                onPress={handlePaste}
                variant="secondary"
                style={styles.pasteButton}
                disabled={resolving}
                accessibilityLabel="Paste link from clipboard"
              />
              <Button
                title="Resolve & Preview"
                icon={<Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
                onPress={handleResolve}
                variant="primary"
                loading={resolving}
                style={styles.resolveButton}
                accessibilityLabel="Resolve TikTok video metadata"
              />
            </View>
          </Card>

          {/* Feature Highlights Grid */}
          <View style={styles.featuresRow}>
            <View
              style={[
                styles.featurePill,
                {
                  backgroundColor: colors.surfaceContainerLow || colors.surfaceElevated,
                  borderColor: colors.outlineVariant || colors.surfaceBorder,
                },
              ]}
            >
              <Ionicons name="sparkles" size={14} color={colors.primary} />
              <Text style={[typography.labelMedium, { color: colors.textSecondary, marginLeft: 6 }]}>
                Clean MP4 Stream
              </Text>
            </View>

            <View
              style={[
                styles.featurePill,
                {
                  backgroundColor: colors.surfaceContainerLow || colors.surfaceElevated,
                  borderColor: colors.outlineVariant || colors.surfaceBorder,
                },
              ]}
            >
              <Ionicons name="shield-checkmark" size={14} color={colors.success} />
              <Text style={[typography.labelMedium, { color: colors.textSecondary, marginLeft: 6 }]}>
                Private & Secure
              </Text>
            </View>

            <View
              style={[
                styles.featurePill,
                {
                  backgroundColor: colors.surfaceContainerLow || colors.surfaceElevated,
                  borderColor: colors.outlineVariant || colors.surfaceBorder,
                },
              ]}
            >
              <Ionicons name="infinite" size={14} color={colors.accent} />
              <Text style={[typography.labelMedium, { color: colors.textSecondary, marginLeft: 6 }]}>
                Any Duration
              </Text>
            </View>
          </View>

          {/* Guidance Card */}
          <Card variant="outlined" style={styles.guideCard}>
            <View style={styles.guideHeader}>
              <View style={[styles.guideIconCircle, { backgroundColor: colors.primaryContainer || colors.primaryLight }]}>
                <Ionicons name="help-circle-outline" size={18} color={colors.primary} />
              </View>
              <Text style={[typography.titleMedium, { color: colors.textPrimary, marginLeft: spacing.sm }]}>
                Quick Instructions
              </Text>
            </View>

            <View style={styles.guideSteps}>
              <View style={styles.stepRow}>
                <Text style={[typography.labelLarge, { color: colors.primary, width: 22 }]}>1.</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, flex: 1 }]}>
                  Copy the share link from any public TikTok video.
                </Text>
              </View>
              <View style={styles.stepRow}>
                <Text style={[typography.labelLarge, { color: colors.primary, width: 22 }]}>2.</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, flex: 1 }]}>
                  Tap <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Paste</Text> and click <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Resolve & Preview</Text>.
                </Text>
              </View>
              <View style={styles.stepRow}>
                <Text style={[typography.labelLarge, { color: colors.primary, width: 22 }]}>3.</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, flex: 1 }]}>
                  Confirm metadata in the preview sheet and download directly to your device.
                </Text>
              </View>
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  mockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  brandHero: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: spacing.sm,
  },
  clearIconButton: {
    width: spacing.touchTargetMin,
    height: spacing.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm + 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  pasteButton: {
    flex: 1,
  },
  resolveButton: {
    flex: 1.4,
  },
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    justifyContent: 'center',
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  guideCard: {
    marginHorizontal: spacing.lg,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guideIconCircle: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideSteps: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
