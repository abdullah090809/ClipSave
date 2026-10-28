import { useState, useEffect, useRef } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius, layout } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { extractAndValidateTikTokUrl } from '../../src/utils/urlValidator';
import { resolveTikTokUrl, checkAndWarmBackend } from '../../src/services/apiClient';
import { startDownload } from '../../src/services/downloadEngine';
import { formatBytes, formatDuration } from '../../src/utils/formatters';
import { ResolvedMedia, ResolveError } from '../../src/types';
import { BottomSheetMenu, SheetAction } from '../../src/components/BottomSheetMenu';
import { TabHeader } from '../../src/components/TabHeader';
import { AccordionRow } from '../../src/components/AccordionRow';

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ prefill?: string; ts?: string }>();

  // State
  const [inputUrl, setInputUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolvingStatus, setResolvingStatus] = useState<string | null>(null);
  const [resolvedMedia, setResolvedMedia] = useState<ResolvedMedia | null>(null);
  const [showTopMenu, setShowTopMenu] = useState(false);
  const [showPreviewMenu, setShowPreviewMenu] = useState(false);
  const [clipboardDetectedUrl, setClipboardDetectedUrl] = useState<string | null>(null);
  const resolvingRef = useRef(false);

  // Check clipboard when component mounts or becomes active (without continuous polling)
  useEffect(() => {
    let isMounted = true;
    Clipboard.hasStringAsync()
      .then(async (has) => {
        if (!has || !isMounted) return;
        const text = await Clipboard.getStringAsync();
        if (text && text.trim() && isMounted) {
          const check = extractAndValidateTikTokUrl(text.trim());
          if (check.isValid && check.normalizedUrl && check.normalizedUrl !== inputUrl) {
            setClipboardDetectedUrl(check.normalizedUrl);
          }
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [inputUrl]);

  // Handle URL prefill from Android share intent or external navigation
  useEffect(() => {
    if (params.prefill) {
      setInputUrl(params.prefill);
      setErrorMessage(null);
      setResolvedMedia(null);
    }
  }, [params.prefill, params.ts]);

  const handlePaste = async () => {
    try {
      const hasStr = await Clipboard.hasStringAsync();
      const text = hasStr ? await Clipboard.getStringAsync() : '';
      if (!text || !text.trim()) {
        Alert.alert('Empty Clipboard', 'No text found on clipboard.');
        return;
      }
      setInputUrl(text.trim());
      setErrorMessage(null);
      setClipboardDetectedUrl(null);
      checkAndWarmBackend().catch(() => {});
    } catch {
      Alert.alert('Clipboard Access', 'Could not read from clipboard.');
    }
  };

  const handleClear = () => {
    setInputUrl('');
    setErrorMessage(null);
    setResolvedMedia(null);
  };

  const handleResolve = async () => {
    const rawUrl = inputUrl.trim();
    if (!rawUrl) {
      setErrorMessage('Please paste or enter a TikTok video link.');
      return;
    }
    const validation = extractAndValidateTikTokUrl(rawUrl);
    if (!validation.isValid || !validation.normalizedUrl) {
      setErrorMessage(validation.errorMessage || 'Invalid TikTok URL. Check link format.');
      return;
    }

    if (resolvingRef.current) return;
    resolvingRef.current = true;
    setResolving(true);
    setResolvingStatus('Resolving video...');
    setErrorMessage(null);
    setResolvedMedia(null);

    try {
      const media = await resolveTikTokUrl(validation.normalizedUrl, (status) => {
        setResolvingStatus(status);
      });
      setResolvedMedia(media);
      setClipboardDetectedUrl(null);
    } catch (err: unknown) {
      const resolveErr = err as ResolveError;
      setErrorMessage(resolveErr?.message || 'Unable to resolve video. Ensure the video is public.');
    } finally {
      resolvingRef.current = false;
      setResolving(false);
      setResolvingStatus(null);
    }
  };

  const handleStartDownload = async (mediaToDownload: ResolvedMedia) => {
    try {
      await startDownload(mediaToDownload);
      setInputUrl('');
      setResolvedMedia(null);
      // Navigate to Queue tab so user sees active download
      router.navigate('/(tabs)/queue');
    } catch {
      Alert.alert('Download Error', 'Could not start download. Please try again.');
    }
  };

  const topMenuActions: SheetAction[] = [
    {
      key: 'paste',
      label: 'Paste from Clipboard',
      icon: 'clipboard-outline',
      onPress: handlePaste,
    },
    {
      key: 'queue',
      label: 'View Queue',
      icon: 'download-outline',
      onPress: () => router.navigate('/(tabs)/queue'),
    },
    {
      key: 'history',
      label: 'Download History',
      icon: 'library-outline',
      onPress: () => router.navigate('/(tabs)/history'),
    },
    {
      key: 'settings',
      label: 'Settings & Appearance',
      icon: 'settings-outline',
      onPress: () => router.navigate('/(tabs)/settings'),
    },
  ];

  const previewMenuActions: SheetAction[] = resolvedMedia
    ? [
        {
          key: 'download-video',
          label: 'Download MP4 Video',
          icon: 'videocam-outline',
          onPress: () => handleStartDownload(resolvedMedia),
        },
        {
          key: 'download-audio',
          label: 'Download Audio Only (MP3)',
          icon: 'musical-notes-outline',
          onPress: () => {
            const audioMedia: ResolvedMedia = {
              ...resolvedMedia,
              id: `${resolvedMedia.id}_audio`,
              title: `${resolvedMedia.title} (Audio)`,
              format: 'mp3',
            };
            handleStartDownload(audioMedia);
          },
        },
        {
          key: 'copy-link',
          label: 'Copy TikTok Link',
          icon: 'link-outline',
          onPress: async () => {
            await Clipboard.setStringAsync(resolvedMedia.sourceUrl);
            Alert.alert('Copied', 'Original video link copied to clipboard.');
          },
        },
        {
          key: 'dismiss',
          label: 'Dismiss Preview',
          icon: 'close-outline',
          destructive: true,
          onPress: () => setResolvedMedia(null),
        },
      ]
    : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* 1. COMPACT SCREEN HEADER WITH LOGO, NAME & 3-DOTS OVERFLOW */}
      <TabHeader
        brand
        onOverflowPress={() => setShowTopMenu(true)}
        overflowLabel="Home options"
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + layout.section + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 2. CENTERED HERO SECTION */}
          <View style={styles.heroSection}>
            <Text
              style={[
                typography.headlineMedium,
                { color: colors.textPrimary, fontWeight: '800', textAlign: 'center' },
              ]}
              accessibilityRole="header"
            >
              Paste a TikTok link
            </Text>
            <Text
              style={[
                typography.bodyMedium,
                { color: colors.textSecondary, textAlign: 'center', marginTop: 4 },
              ]}
            >
              Save your favorite videos in seconds
            </Text>
          </View>

          {/* 3. CLIPBOARD PROMPT CHIP (IF DETECTED) */}
          {clipboardDetectedUrl && !inputUrl && (
            <Pressable
              onPress={() => {
                setInputUrl(clipboardDetectedUrl);
                setClipboardDetectedUrl(null);
                setErrorMessage(null);
                checkAndWarmBackend().catch(() => {});
              }}
              android_ripple={{ color: colors.ripple }}
              style={[
                styles.clipboardChip,
                {
                  backgroundColor: colors.primaryLight,
                  borderColor: colors.primaryBorder,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Paste detected TikTok link"
            >
              <Ionicons name="clipboard-outline" size={16} color={colors.primary} />
              <Text
                style={[typography.labelMedium, { color: colors.primary, flex: 1 }]}
                numberOfLines={1}
              >
                TikTok link detected: tap to paste
              </Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primary} />
            </Pressable>
          )}

          {/* 4. LINK INPUT FIELD */}
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: colors.inputBackground,
                borderColor: errorMessage ? colors.danger : colors.inputBorder,
              },
            ]}
          >
            <Ionicons
              name="link-outline"
              size={20}
              color={colors.textSecondary}
              style={styles.inputLeftIcon}
            />
            <TextInput
              style={[
                styles.textInput,
                typography.body,
                { color: colors.textPrimary },
              ]}
              placeholder="Paste TikTok link here..."
              placeholderTextColor={colors.textMuted}
              value={inputUrl}
              onChangeText={(text) => {
                setInputUrl(text);
                if (errorMessage) setErrorMessage(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={handleResolve}
              accessibilityLabel="TikTok video link input"
              accessibilityHint="Paste or type a TikTok video URL to download"
            />
            {inputUrl.length > 0 ? (
              <Pressable
                onPress={handleClear}
                style={styles.clearButton}
                accessibilityRole="button"
                accessibilityLabel="Clear input field"
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {/* Inline Validation / Error Message */}
          {errorMessage ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={[typography.bodySmall, { color: colors.danger, flex: 1 }]}>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          {/* 5. PRIMARY FULL-WIDTH ACTION BUTTON */}
          <Pressable
            onPress={handleResolve}
            disabled={resolving}
            android_ripple={{ color: colors.ripplePrimary, borderless: false }}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: colors.primary,
                opacity: resolving ? 0.8 : pressed ? 0.9 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={resolving ? (resolvingStatus || 'Resolving video') : 'Get video'}
            accessibilityState={{ disabled: resolving, busy: resolving }}
          >
            {resolving ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator size="small" color={colors.onPrimary} />
                <Text style={[typography.labelLarge, styles.buttonText, { color: colors.onPrimary }]}>
                  {resolvingStatus || 'Resolving video...'}
                </Text>
              </View>
            ) : (
              <View style={styles.buttonContent}>
                <Ionicons name="download-outline" size={20} color={colors.onPrimary} />
                <Text style={[typography.labelLarge, styles.buttonText, { color: colors.onPrimary }]}>
                  Get video
                </Text>
              </View>
            )}
          </Pressable>

          {/* 6. RESOLVED VIDEO PREVIEW CARD */}
          {resolvedMedia && (
            <View
              style={[
                styles.previewCard,
                {
                  backgroundColor: colors.surfaceContainer,
                  borderColor: colors.surfaceBorder,
                },
              ]}
            >
              <View style={styles.previewTopRow}>
                {/* Thumbnail with duration badge and play icon overlay */}
                <View style={styles.thumbnailWrapper}>
                  {resolvedMedia.thumbnailUrl ? (
                    <Image
                      source={{ uri: resolvedMedia.thumbnailUrl }}
                      style={styles.thumbnailImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.thumbnailPlaceholder, { backgroundColor: colors.surfaceContainerHigh }]}>
                      <Ionicons name="film-outline" size={28} color={colors.primary} />
                    </View>
                  )}
                  {/* Subtle play icon overlay */}
                  <View style={styles.playOverlay}>
                    <Ionicons name="play" size={14} color="#FFFFFF" />
                  </View>
                  {/* Duration badge */}
                  {resolvedMedia.durationSeconds ? (
                    <View style={styles.durationBadge}>
                      <Text style={styles.durationText}>
                        {formatDuration(resolvedMedia.durationSeconds)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Video Metadata */}
                <View style={styles.previewMeta}>
                  <Text
                    style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]}
                    numberOfLines={2}
                  >
                    {resolvedMedia.title || 'TikTok Video'}
                  </Text>
                  <Text
                    style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 4 }]}
                    numberOfLines={1}
                  >
                    @{resolvedMedia.authorUsername || resolvedMedia.author || 'creator'}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                    {resolvedMedia.estimatedSizeBytes
                      ? `${formatBytes(resolvedMedia.estimatedSizeBytes)} • `
                      : ''}
                    1080p HD • No watermark
                  </Text>
                </View>

                {/* 3-Dots Action Menu for Preview */}
                <Pressable
                  onPress={() => setShowPreviewMenu(true)}
                  style={styles.previewMenuButton}
                  accessibilityRole="button"
                  accessibilityLabel="Preview options"
                  hitSlop={8}
                >
                  <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
                </Pressable>
              </View>

              {/* Direct Download Button */}
              <Pressable
                onPress={() => handleStartDownload(resolvedMedia)}
                android_ripple={{ color: colors.ripplePrimary }}
                style={[
                  styles.downloadTriggerButton,
                  { backgroundColor: colors.primary },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Download video now"
              >
                <Ionicons name="download" size={18} color={colors.onPrimary} />
                <Text style={[typography.labelMedium, { color: colors.onPrimary, fontWeight: '700' }]}>
                  Download Video (1080p)
                </Text>
              </Pressable>
            </View>
          )}

          {/* 7. EXPANDABLE ACCORDION ROWS */}
          <View style={styles.accordionsSection}>
            {/* Accordion 1: Quick actions (Yellow star icon) */}
            <AccordionRow
              title="Quick actions"
              subtitle="Utilities and shortcuts"
              icon="star"
              iconColor="#F59E0B"
              iconBgColor="rgba(245, 158, 11, 0.15)"
            >
              <View style={styles.accordionContentList}>
                <Pressable
                  onPress={handlePaste}
                  style={styles.accordionActionItem}
                  accessibilityRole="button"
                  accessibilityLabel="Paste from clipboard"
                >
                  <Ionicons name="clipboard-outline" size={18} color={colors.primary} />
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1 }]}>
                    Paste from Clipboard
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>

                <Pressable
                  onPress={handleClear}
                  style={styles.accordionActionItem}
                  accessibilityRole="button"
                  accessibilityLabel="Clear input"
                >
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1 }]}>
                    Clear Input Field
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            </AccordionRow>

            {/* Accordion 2: More features (Purple sparkles/grid icon) */}
            <AccordionRow
              title="More features"
              subtitle="Quality & technology highlights"
              icon="sparkles"
              iconColor="#8B5CF6"
              iconBgColor="rgba(139, 92, 246, 0.15)"
            >
              <View style={styles.accordionFeaturesList}>
                <View style={styles.featureItem}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#8B5CF6" />
                  <View style={styles.featureTextCol}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                      No Watermark Guarantee
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>
                      Resolves original clean MP4 video streams without logos or overlays.
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <Ionicons name="film-outline" size={20} color="#8B5CF6" />
                  <View style={styles.featureTextCol}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                      Full HD 1080p Resolution
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>
                      Downloads highest quality stream available from TikTok CDN.
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <Ionicons name="flash-outline" size={20} color="#8B5CF6" />
                  <View style={styles.featureTextCol}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                      Fast Multithreaded Engine
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>
                      Automatic resume support and concurrent chunk downloading.
                    </Text>
                  </View>
                </View>
              </View>
            </AccordionRow>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Top Header Overflow Bottom Sheet */}
      <BottomSheetMenu
        visible={showTopMenu}
        onClose={() => setShowTopMenu(false)}
        title="ClipSave Menu"
        actions={topMenuActions}
      />

      {/* Resolved Media Preview Bottom Sheet */}
      <BottomSheetMenu
        visible={showPreviewMenu}
        onClose={() => setShowPreviewMenu(false)}
        title="Video Options"
        actions={previewMenuActions}
      />
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
  content: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.md,
  },
  heroSection: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  clipboardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    marginBottom: spacing.sm,
  },
  inputLeftIcon: {
    marginRight: spacing.sm,
  },
  textInput: {
    flex: 1,
    height: 48,
    paddingVertical: 0,
  },
  clearButton: {
    padding: spacing.xs,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  primaryButton: {
    borderRadius: borderRadius.lg,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  buttonText: {
    fontWeight: '700',
    fontSize: 16,
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  previewTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  thumbnailWrapper: {
    width: 76,
    height: 104,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000000',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    transform: [{ translateX: -14 }, { translateY: -14 }],
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  previewMeta: {
    flex: 1,
  },
  previewMenuButton: {
    padding: spacing.xs,
  },
  downloadTriggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    minHeight: 44,
    marginTop: spacing.md,
  },
  accordionsSection: {
    marginTop: spacing.xs,
  },
  accordionContentList: {
    gap: spacing.sm,
  },
  accordionActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  accordionFeaturesList: {
    gap: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  featureTextCol: {
    flex: 1,
  },
});
