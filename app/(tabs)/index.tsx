import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Image,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius, layout } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { validateMediaUrl, detectPlatform } from '../../src/utils/urlValidator';
import { resolveMediaUrl, checkAndWarmBackend } from '../../src/services/apiClient';
import { startDownload } from '../../src/services/downloadEngine';
import { getInitialSharedUrl, subscribeToSharedUrls } from '../../src/services/shareIntent';
import { ensureMediaLibraryPermissions } from '../../src/services/mediaManager';
import { formatBytes, formatDuration } from '../../src/utils/formatters';
import { ResolvedMedia, MediaFormatOption, ResolveError } from '../../src/types';
import { getSettings } from '../../src/storage/settingsStore';
import { BottomSheetMenu, SheetAction } from '../../src/components/BottomSheetMenu';
import { TabHeader } from '../../src/components/TabHeader';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';

interface PlatformCardConfig {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  formats: string;
  badge: string;
}

const PLATFORMS_CONFIG: PlatformCardConfig[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    icon: 'logo-youtube',
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.12)',
    formats: 'Videos, Shorts & MP3',
    badge: '1080p HD',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: 'musical-notes',
    color: '#06B6D4',
    bgColor: 'rgba(6, 182, 212, 0.12)',
    formats: 'Watermark-free clips',
    badge: 'Clean MP4',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: 'logo-instagram',
    color: '#E1306C',
    bgColor: 'rgba(225, 48, 108, 0.12)',
    formats: 'Reels, Posts & Stories',
    badge: 'High Res',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: 'logo-facebook',
    color: '#1877F2',
    bgColor: 'rgba(24, 119, 242, 0.12)',
    formats: 'Public reels & video clips',
    badge: 'HD Video',
  },
];

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
  const [selectedFormat, setSelectedFormat] = useState<MediaFormatOption | null>(null);
  const [showPreviewMenu, setShowPreviewMenu] = useState(false);
  const [pendingPermissionDownload, setPendingPermissionDownload] = useState<ResolvedMedia | null>(null);
  const [infoDialog, setInfoDialog] = useState<{
    title: string;
    message: string;
    icon?: keyof typeof Ionicons.glyphMap;
    iconColor?: string;
  } | null>(null);
  const [clipboardDetectedUrl, setClipboardDetectedUrl] = useState<string | null>(null);
  const [clipboardPlatform, setClipboardPlatform] = useState<string>('video');
  const [isFocused, setIsFocused] = useState(false);
  const resolvingRef = useRef(false);

  // Real-time platform detection as user types or pastes
  const liveDetection = detectPlatform(inputUrl);

  // Check clipboard helper
  const checkClipboard = useCallback(async () => {
    try {
      const has = await Clipboard.hasStringAsync();
      if (!has) {
        setClipboardDetectedUrl(null);
        return;
      }
      const text = await Clipboard.getStringAsync();
      if (!text || !text.trim()) {
        setClipboardDetectedUrl(null);
        return;
      }
      const check = validateMediaUrl(text.trim());
      if (check.isValid && check.normalizedUrl) {
        if (check.normalizedUrl !== inputUrl.trim()) {
          setClipboardDetectedUrl(check.normalizedUrl);
          setClipboardPlatform(
            check.platform === 'youtube'
              ? check.isShort
                ? 'YouTube Short'
                : 'YouTube Video'
              : check.platform === 'instagram'
              ? check.isShort
                ? 'Instagram Reel'
                : 'Instagram Video'
              : check.platform === 'facebook'
              ? check.isShort
                ? 'Facebook Reel'
                : 'Facebook Video'
              : 'TikTok Video'
          );
        } else {
          setClipboardDetectedUrl(null);
        }
      } else {
        setClipboardDetectedUrl(null);
      }
    } catch {
      // Ignore clipboard error
    }
  }, [inputUrl]);

  // Check clipboard on mount and whenever app resumes to foreground from another app
  useEffect(() => {
    checkClipboard();

    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkClipboard();
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(checkClipboard, 350);
      }
    });

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      subscription.remove();
    };
  }, [checkClipboard]);

  // Check clipboard whenever Home screen tab gains focus
  useFocusEffect(
    useCallback(() => {
      checkClipboard();
      const timer = setTimeout(checkClipboard, 350);
      return () => clearTimeout(timer);
    }, [checkClipboard])
  );

  // Handle URL prefill from Android share intent or external navigation
  useEffect(() => {
    if (params.prefill) {
      setInputUrl(params.prefill);
      setErrorMessage(null);
      setResolvedMedia(null);
      setSelectedFormat(null);
    }
  }, [params.prefill, params.ts]);

  // Links shared to ClipSave from other apps (Android share sheet)
  useEffect(() => {
    const applySharedUrl = (url: string) => {
      setInputUrl(url);
      setErrorMessage(null);
      setResolvedMedia(null);
      setSelectedFormat(null);
      setClipboardDetectedUrl(null);
      checkAndWarmBackend().catch(() => {});
      router.navigate('/');
    };
    const initial = getInitialSharedUrl();
    if (initial) applySharedUrl(initial);
    return subscribeToSharedUrls(applySharedUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePaste = async () => {
    try {
      const hasStr = await Clipboard.hasStringAsync();
      const text = hasStr ? await Clipboard.getStringAsync() : '';
      if (!text || !text.trim()) {
        setInfoDialog({
          title: 'Empty Clipboard',
          message: 'No text was found on your clipboard. Please copy a video link first.',
          icon: 'clipboard-outline',
        });
        return;
      }
      setInputUrl(text.trim());
      setErrorMessage(null);
      setClipboardDetectedUrl(null);
      checkAndWarmBackend().catch(() => {});
    } catch {
      setInfoDialog({
        title: 'Clipboard Access',
        message: 'Could not read from clipboard. Please grant clipboard permissions or paste manually.',
        icon: 'alert-circle-outline',
      });
    }
  };

  const handleClear = () => {
    setInputUrl('');
    setErrorMessage(null);
    setResolvedMedia(null);
    setSelectedFormat(null);
  };

  const handleResolve = async () => {
    const rawUrl = inputUrl.trim();
    if (!rawUrl) {
      setErrorMessage('Please paste or enter a YouTube, TikTok, Instagram, or Facebook link.');
      return;
    }
    const validation = validateMediaUrl(rawUrl);
    if (!validation.isValid || !validation.normalizedUrl) {
      setErrorMessage(validation.errorMessage || 'Invalid link format. Please provide a supported video link.');
      return;
    }

    if (resolvingRef.current) return;
    resolvingRef.current = true;
    setResolving(true);
    setResolvingStatus('Resolving media...');
    setErrorMessage(null);
    setResolvedMedia(null);
    setSelectedFormat(null);

    try {
      const media = await resolveMediaUrl(validation.normalizedUrl, (status) => {
        setResolvingStatus(status);
      });
      setResolvedMedia(media);

      // Select default format based on user setting
      const settings = await getSettings();
      const preferred = settings.defaultQuality || '1080p';
      const available = media.availableFormats || [];
      const match = available.find((f) => f.quality === preferred || f.id === preferred) || available[0] || null;
      setSelectedFormat(match);

      setClipboardDetectedUrl(null);
    } catch (err: unknown) {
      const resolveErr = err as ResolveError;
      setErrorMessage(resolveErr?.message || 'Unable to resolve video. Ensure the video is public and available.');
    } finally {
      resolvingRef.current = false;
      setResolving(false);
      setResolvingStatus(null);
    }
  };

  const handleStartDownload = async (mediaToDownload: ResolvedMedia) => {
    try {
      const hasPerm = await ensureMediaLibraryPermissions().catch(() => false);
      if (!hasPerm) {
        setPendingPermissionDownload(mediaToDownload);
        return;
      }
      await startDownload(mediaToDownload);
      setInputUrl('');
      setResolvedMedia(null);
      setSelectedFormat(null);
      router.navigate('/(tabs)/queue');
    } catch {
      setInfoDialog({
        title: 'Download Error',
        message: 'Could not start download. Please try again.',
        icon: 'alert-circle',
      });
    }
  };

  const handleDownloadActiveFormat = () => {
    if (!resolvedMedia) return;
    const targetFormat = selectedFormat || (resolvedMedia.availableFormats && resolvedMedia.availableFormats[0]);

    if (targetFormat) {
      const mediaWithFormat: ResolvedMedia = {
        ...resolvedMedia,
        id: `${resolvedMedia.id}_${targetFormat.id}`,
        mediaUrl: targetFormat.mediaUrl,
        audioUrl: targetFormat.audioUrl,
        format: targetFormat.extension,
        quality: targetFormat.quality,
        estimatedSizeBytes: targetFormat.estimatedSizeBytes ?? resolvedMedia.estimatedSizeBytes,
      };
      handleStartDownload(mediaWithFormat);
    } else {
      handleStartDownload(resolvedMedia);
    }
  };

  const handlePlatformPress = (platform: PlatformCardConfig) => {
    setInfoDialog({
      title: `${platform.name} Downloads`,
      message: `To download from ${platform.name}:\n\n1. Open the ${platform.name} app or website\n2. Tap "Share" on any public video and select "Copy Link"\n3. Return here and tap "Get video"`,
      icon: platform.icon,
      iconColor: platform.color,
    });
  };

  // Dynamic preview menu actions matching available formats
  const previewMenuActions: SheetAction[] = resolvedMedia
    ? [
        ...(resolvedMedia.availableFormats && resolvedMedia.availableFormats.length > 0
          ? resolvedMedia.availableFormats.map((fmt) => ({
              key: `fmt_${fmt.id}`,
              label: `Download ${fmt.label}${fmt.estimatedSizeBytes ? ` (${formatBytes(fmt.estimatedSizeBytes)})` : ''}`,
              icon: (fmt.isVideo ? 'videocam-outline' : 'musical-notes-outline') as any,
              onPress: () => {
                const targetMedia: ResolvedMedia = {
                  ...resolvedMedia,
                  id: `${resolvedMedia.id}_${fmt.id}`,
                  mediaUrl: fmt.mediaUrl,
                  audioUrl: fmt.audioUrl,
                  format: fmt.extension,
                  quality: fmt.quality,
                  estimatedSizeBytes: fmt.estimatedSizeBytes,
                };
                handleStartDownload(targetMedia);
              },
            }))
          : [
              {
                key: 'download-video',
                label: 'Download MP4 Video',
                icon: 'videocam-outline' as any,
                onPress: () => handleStartDownload(resolvedMedia),
              },
            ]),
        {
          key: 'copy-link',
          label: 'Copy Original Link',
          icon: 'link-outline',
          onPress: async () => {
            await Clipboard.setStringAsync(resolvedMedia.sourceUrl);
            setInfoDialog({
              title: 'Link Copied',
              message: 'Original video link copied to clipboard.',
              icon: 'checkmark-circle-outline',
              iconColor: colors.primary,
            });
          },
        },
        {
          key: 'dismiss',
          label: 'Dismiss Preview',
          icon: 'close-outline',
          destructive: true,
          onPress: () => {
            setResolvedMedia(null);
            setSelectedFormat(null);
          },
        },
      ]
    : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* 1. SCREEN HEADER WITH BRAND LOGO & TITLE */}
      <TabHeader brand />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + layout.section + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 2. INTENTIONAL HERO SECTION WITH ARTISAN BADGE */}
          <View style={styles.heroSection}>
            <View style={[styles.heroBadge, { backgroundColor: colors.primaryContainer, borderColor: colors.primaryBorder }]}>
              <Ionicons name="sparkles" size={12} color={colors.primary} />
              <Text style={[typography.micro, { color: colors.primary, fontWeight: '700', marginLeft: 6, letterSpacing: 0.6 }]}>
                UNIVERSAL MEDIA SAVER • HD & AUDIO
              </Text>
            </View>

            <Text
              style={[
                styles.heroTitle,
                { color: colors.textPrimary },
              ]}
              accessibilityRole="header"
            >
              Save Any Video
            </Text>

            <Text
              style={[
                typography.body,
                styles.heroSubtitle,
                { color: colors.textSecondary },
              ]}
            >
              Paste any public link to save watermark-free video or audio directly to your device gallery.
            </Text>
          </View>

          {/* 3. TACTILE INPUT CARD WITH EMBEDDED HEADER & DETECTED BADGE */}
          <View
            style={[
              styles.inputCard,
              {
                backgroundColor: colors.surfaceContainer,
                borderColor: errorMessage
                  ? colors.danger
                  : isFocused
                  ? colors.primary
                  : colors.surfaceBorder,
              },
            ]}
          >
            {/* Input Card Header Row */}
            <View style={styles.inputCardHeader}>
              <Text style={[typography.micro, { color: colors.textMuted, fontWeight: '700', letterSpacing: 0.8 }]}>
                SOURCE LINK
              </Text>

              {inputUrl.length > 0 && liveDetection.platform !== 'generic' ? (
                <View
                  style={[
                    styles.platformPill,
                    {
                      backgroundColor:
                        liveDetection.platform === 'youtube'
                          ? 'rgba(239, 68, 68, 0.12)'
                          : liveDetection.platform === 'instagram'
                          ? 'rgba(225, 48, 108, 0.12)'
                          : liveDetection.platform === 'facebook'
                          ? 'rgba(24, 119, 242, 0.12)'
                          : 'rgba(6, 182, 212, 0.12)',
                      borderColor:
                        liveDetection.platform === 'youtube'
                          ? '#EF4444'
                          : liveDetection.platform === 'instagram'
                          ? '#E1306C'
                          : liveDetection.platform === 'facebook'
                          ? '#1877F2'
                          : '#06B6D4',
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      liveDetection.platform === 'youtube'
                        ? 'logo-youtube'
                        : liveDetection.platform === 'instagram'
                        ? 'logo-instagram'
                        : liveDetection.platform === 'facebook'
                        ? 'logo-facebook'
                        : 'musical-notes'
                    }
                    size={11}
                    color={
                      liveDetection.platform === 'youtube'
                        ? '#EF4444'
                        : liveDetection.platform === 'instagram'
                        ? '#E1306C'
                        : liveDetection.platform === 'facebook'
                        ? '#1877F2'
                        : '#06B6D4'
                    }
                  />
                  <Text
                    style={[
                      typography.micro,
                      {
                        color:
                          liveDetection.platform === 'youtube'
                            ? '#EF4444'
                            : liveDetection.platform === 'instagram'
                            ? '#E1306C'
                            : liveDetection.platform === 'facebook'
                            ? '#1877F2'
                            : '#06B6D4',
                        fontWeight: '700',
                        marginLeft: 4,
                      },
                    ]}
                  >
                    {liveDetection.platform === 'youtube'
                      ? liveDetection.isShort
                        ? 'YouTube Short'
                        : 'YouTube Video'
                      : liveDetection.platform === 'instagram'
                      ? liveDetection.isShort
                        ? 'Instagram Reel'
                        : 'Instagram Video'
                      : liveDetection.platform === 'facebook'
                      ? liveDetection.isShort
                        ? 'Facebook Reel'
                        : 'Facebook Video'
                      : 'TikTok Video'}
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={handlePaste}
                  style={[styles.pasteQuickBtn, { backgroundColor: colors.surfaceContainerHigh }]}
                  accessibilityRole="button"
                  accessibilityLabel="Paste from clipboard"
                  hitSlop={6}
                >
                  <Ionicons name="clipboard-outline" size={11} color={colors.primary} />
                  <Text style={[typography.micro, { color: colors.primary, fontWeight: '700', marginLeft: 4 }]}>
                    Paste from clipboard
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Input Inner Row */}
            <View style={styles.inputInnerRow}>
              <View style={[styles.inputIconCircle, { backgroundColor: colors.surfaceContainerHigh }]}>
                <Ionicons
                  name="link-outline"
                  size={18}
                  color={isFocused ? colors.primary : colors.textSecondary}
                />
              </View>

              <TextInput
                style={[
                  styles.textInput,
                  typography.body,
                  { color: colors.textPrimary },
                ]}
                placeholder="Paste or enter link here..."
                placeholderTextColor={colors.textMuted}
                value={inputUrl}
                onChangeText={(text) => {
                  setInputUrl(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                onSubmitEditing={handleResolve}
                accessibilityLabel="Media link input"
                accessibilityHint="Paste or type a YouTube or TikTok URL to download"
              />

              {inputUrl.length > 0 ? (
                <Pressable
                  onPress={handleClear}
                  style={styles.iconActionBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Clear input field"
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* 4. CONTEXTUAL CLIPBOARD SUGGESTION CHIP */}
          {clipboardDetectedUrl && clipboardDetectedUrl !== inputUrl.trim() && (
            <Pressable
              onPress={() => {
                setInputUrl(clipboardDetectedUrl);
                setClipboardDetectedUrl(null);
                setErrorMessage(null);
                checkAndWarmBackend().catch(() => {});
              }}
              android_ripple={{ color: colors.ripple }}
              style={[
                styles.clipboardSuggestion,
                {
                  backgroundColor: colors.surfaceContainerHigh,
                  borderColor: colors.surfaceBorder,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Paste detected ${clipboardPlatform} link`}
            >
              <View style={[styles.clipboardIconBubble, { backgroundColor: colors.primaryContainer }]}>
                <Ionicons
                  name={
                    clipboardPlatform.includes('YouTube')
                      ? 'logo-youtube'
                      : clipboardPlatform.includes('Instagram')
                      ? 'logo-instagram'
                      : clipboardPlatform.includes('Facebook')
                      ? 'logo-facebook'
                      : 'musical-notes'
                  }
                  size={13}
                  color={colors.primary}
                />
              </View>
              <Text style={[typography.captionMedium, { color: colors.textPrimary, flex: 1 }]}>
                {`Found ${clipboardPlatform} on clipboard • Tap to paste`}
              </Text>
              <Ionicons name="arrow-forward" size={14} color={colors.textSecondary} />
            </Pressable>
          )}

          {/* 5. INLINE ERROR CONTAINER */}
          {errorMessage ? (
            <View
              style={[
                styles.errorContainer,
                { backgroundColor: colors.dangerLight, borderColor: colors.dangerBorder },
              ]}
            >
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={[typography.bodySmall, { color: colors.danger, flex: 1, fontWeight: '500' }]}>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          {/* 6. PRIMARY ACTION BUTTON ("GET VIDEO") */}
          <Pressable
            onPress={handleResolve}
            disabled={resolving}
            android_ripple={{ color: colors.ripplePrimary, borderless: false }}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: colors.primary,
                opacity: resolving ? 0.8 : pressed ? 0.92 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={resolving ? (resolvingStatus || 'Resolving media') : 'Get video'}
            accessibilityState={{ disabled: resolving, busy: resolving }}
          >
            {resolving ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator size="small" color={colors.onPrimary} />
                <Text style={[typography.labelLarge, styles.buttonText, { color: colors.onPrimary }]}>
                  {resolvingStatus || 'Resolving media...'}
                </Text>
              </View>
            ) : (
              <View style={styles.buttonContent}>
                <Ionicons name="arrow-down-circle-outline" size={20} color={colors.onPrimary} />
                <Text style={[typography.labelLarge, styles.buttonText, { color: colors.onPrimary }]}>
                  Get video
                </Text>
              </View>
            )}
          </Pressable>

          {/* 7. RESOLVED VIDEO PREVIEW CARD (Visible after extraction) */}
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
              {/* Platform Tag Header */}
              <View style={styles.previewPlatformTagRow}>
                <View
                  style={[
                    styles.previewPlatformTag,
                    {
                      backgroundColor:
                        resolvedMedia.platform === 'youtube'
                          ? 'rgba(239, 68, 68, 0.12)'
                          : resolvedMedia.platform === 'instagram'
                          ? 'rgba(225, 48, 108, 0.12)'
                          : resolvedMedia.platform === 'facebook'
                          ? 'rgba(24, 119, 242, 0.12)'
                          : 'rgba(6, 182, 212, 0.12)',
                      borderColor:
                        resolvedMedia.platform === 'youtube'
                          ? '#EF4444'
                          : resolvedMedia.platform === 'instagram'
                          ? '#E1306C'
                          : resolvedMedia.platform === 'facebook'
                          ? '#1877F2'
                          : '#06B6D4',
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      resolvedMedia.platform === 'youtube'
                        ? 'logo-youtube'
                        : resolvedMedia.platform === 'instagram'
                        ? 'logo-instagram'
                        : resolvedMedia.platform === 'facebook'
                        ? 'logo-facebook'
                        : 'musical-notes'
                    }
                    size={12}
                    color={
                      resolvedMedia.platform === 'youtube'
                        ? '#EF4444'
                        : resolvedMedia.platform === 'instagram'
                        ? '#E1306C'
                        : resolvedMedia.platform === 'facebook'
                        ? '#1877F2'
                        : '#06B6D4'
                    }
                  />
                  <Text
                    style={[
                      typography.micro,
                      {
                        color:
                          resolvedMedia.platform === 'youtube'
                            ? '#EF4444'
                            : resolvedMedia.platform === 'instagram'
                            ? '#E1306C'
                            : resolvedMedia.platform === 'facebook'
                            ? '#1877F2'
                            : '#06B6D4',
                        marginLeft: 4,
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {resolvedMedia.platform === 'youtube'
                      ? 'YouTube'
                      : resolvedMedia.platform === 'instagram'
                      ? 'Instagram'
                      : resolvedMedia.platform === 'facebook'
                      ? 'Facebook'
                      : 'TikTok'}
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
                      <Ionicons
                        name={selectedFormat?.isVideo === false ? 'musical-notes' : 'film-outline'}
                        size={28}
                        color={colors.primary}
                      />
                    </View>
                  )}
                  <View style={styles.playOverlay}>
                    <Ionicons
                      name={selectedFormat?.isVideo === false ? 'musical-notes' : 'play'}
                      size={14}
                      color="#FFFFFF"
                    />
                  </View>
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
                    {resolvedMedia.title || 'Untitled Video'}
                  </Text>
                  <Text
                    style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 4 }]}
                    numberOfLines={1}
                  >
                    @{resolvedMedia.authorUsername || resolvedMedia.author || 'creator'}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                    {selectedFormat?.estimatedSizeBytes
                      ? `${formatBytes(selectedFormat.estimatedSizeBytes)} • `
                      : resolvedMedia.estimatedSizeBytes
                      ? `${formatBytes(resolvedMedia.estimatedSizeBytes)} • `
                      : ''}
                    {selectedFormat?.label || 'Ready to download'}
                  </Text>
                </View>
              </View>

              {/* Quality & Format Selection Pills */}
              {resolvedMedia.availableFormats && resolvedMedia.availableFormats.length > 0 && (
                <View style={styles.formatsSection}>
                  <Text style={[typography.captionMedium, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                    Select Format & Quality:
                  </Text>
                  <View style={styles.formatPillsRow}>
                    {resolvedMedia.availableFormats.map((fmt) => {
                      const isSelected = selectedFormat?.id === fmt.id;
                      return (
                        <Pressable
                          key={fmt.id}
                          onPress={() => setSelectedFormat(fmt)}
                          style={[
                            styles.formatPill,
                            {
                              backgroundColor: isSelected ? colors.primary : colors.surfaceContainerHigh,
                              borderColor: isSelected ? colors.primary : colors.outlineVariant,
                            },
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          accessibilityLabel={`Format option: ${fmt.label}`}
                        >
                          <Ionicons
                            name={fmt.isVideo ? 'videocam' : 'musical-note'}
                            size={12}
                            color={isSelected ? colors.onPrimary : colors.textPrimary}
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={[
                              typography.micro,
                              {
                                color: isSelected ? colors.onPrimary : colors.textPrimary,
                                fontWeight: isSelected ? '700' : '600',
                              },
                            ]}
                          >
                            {fmt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Direct Download Button */}
              <Pressable
                onPress={handleDownloadActiveFormat}
                android_ripple={{ color: colors.ripplePrimary }}
                style={[
                  styles.downloadTriggerButton,
                  { backgroundColor: colors.primary },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Download selected format"
              >
                <Ionicons
                  name={selectedFormat?.isVideo === false ? 'musical-notes' : 'download'}
                  size={18}
                  color={colors.onPrimary}
                />
                <Text style={[typography.labelMedium, { color: colors.onPrimary, fontWeight: '700' }]}>
                  {selectedFormat?.isVideo === false
                    ? `Download Audio (${selectedFormat.label})`
                    : `Download Video (${selectedFormat?.label || '1080p'})`}
                </Text>
              </Pressable>
            </View>
          )}

          {/* 8. SUPPORTED PLATFORMS BENTO SHOWCASE (Always present to anchor screen hierarchy) */}
          <View style={styles.showcaseSection}>
            <View style={styles.showcaseHeader}>
              <Text style={[typography.micro, { color: colors.textMuted, fontWeight: '700', letterSpacing: 0.8 }]}>
                SUPPORTED PLATFORMS
              </Text>
              <Text style={[typography.micro, { color: colors.primary, fontWeight: '600' }]}>
                Auto-Detection Active
              </Text>
            </View>

            <View style={styles.platformsGrid}>
              {PLATFORMS_CONFIG.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => handlePlatformPress(p)}
                  android_ripple={{ color: colors.ripple }}
                  style={[
                    styles.platformCard,
                    {
                      backgroundColor: colors.surfaceContainer,
                      borderColor: colors.surfaceBorder,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.name}: ${p.formats}. Tap for instructions or paste.`}
                >
                  <View style={styles.platformCardTop}>
                    <View style={[styles.platformIconCircle, { backgroundColor: p.bgColor }]}>
                      <Ionicons name={p.icon} size={18} color={p.color} />
                    </View>
                    <View style={[styles.platformPillBadge, { backgroundColor: colors.surfaceContainerHigh }]}>
                      <Text style={[typography.micro, { color: colors.textSecondary, fontWeight: '600' }]}>
                        {p.badge}
                      </Text>
                    </View>
                  </View>
                  <Text style={[typography.bodyMedium, styles.platformName, { color: colors.textPrimary }]}>
                    {p.name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                    {p.formats}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 9. MINIMALIST 3-STEP QUICK WORKFLOW GUIDE */}
          <View
            style={[
              styles.howItWorksCard,
              {
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.surfaceBorder,
              },
            ]}
          >
            <View style={styles.howItWorksHeader}>
              <Ionicons name="information-circle-outline" size={15} color={colors.textSecondary} />
              <Text style={[typography.micro, { color: colors.textSecondary, fontWeight: '700', letterSpacing: 0.6, marginLeft: 6 }]}>
                HOW TO DOWNLOAD
              </Text>
            </View>

            <View style={styles.stepsRow}>
              <View style={styles.stepItem}>
                <View style={[styles.stepNumBubble, { backgroundColor: colors.surfaceContainerHigh }]}>
                  <Text style={[typography.micro, { color: colors.textPrimary, fontWeight: '700' }]}>1</Text>
                </View>
                <Text style={[typography.caption, styles.stepText, { color: colors.textSecondary }]}>
                  Copy link from app
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} style={styles.stepChevron} />

              <View style={styles.stepItem}>
                <View style={[styles.stepNumBubble, { backgroundColor: colors.surfaceContainerHigh }]}>
                  <Text style={[typography.micro, { color: colors.textPrimary, fontWeight: '700' }]}>2</Text>
                </View>
                <Text style={[typography.caption, styles.stepText, { color: colors.textSecondary }]}>
                  Paste & Get video
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} style={styles.stepChevron} />

              <View style={styles.stepItem}>
                <View style={[styles.stepNumBubble, { backgroundColor: colors.surfaceContainerHigh }]}>
                  <Text style={[typography.micro, { color: colors.textPrimary, fontWeight: '700' }]}>3</Text>
                </View>
                <Text style={[typography.caption, styles.stepText, { color: colors.textSecondary }]}>
                  Save to Gallery
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Theme-Aware Gallery Permission Dialog */}
      <ConfirmDialog
        visible={!!pendingPermissionDownload}
        title="Gallery Permission Needed"
        message="ClipSave needs access to your media library to save downloaded videos to your device Gallery album. You can still download directly to app storage."
        icon="images-outline"
        cancelText="Cancel"
        confirmText="Download Anyway"
        onCancel={() => setPendingPermissionDownload(null)}
        onConfirm={async () => {
          const media = pendingPermissionDownload;
          setPendingPermissionDownload(null);
          if (media) {
            await startDownload(media);
            setInputUrl('');
            setResolvedMedia(null);
            setSelectedFormat(null);
            router.navigate('/(tabs)/queue');
          }
        }}
      />

      {/* Theme-Aware Info Dialog (replaces all white native Alert.alert popups) */}
      <ConfirmDialog
        visible={!!infoDialog}
        title={infoDialog?.title || ''}
        message={infoDialog?.message || ''}
        icon={infoDialog?.icon}
        iconColor={infoDialog?.iconColor}
        cancelText={null}
        confirmText="Got it"
        onConfirm={() => setInfoDialog(null)}
      />

      {/* Preview 3-Dots Action Menu */}
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
    paddingTop: spacing.xs,
  },
  heroSection: {
    marginBottom: spacing.md,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  heroSubtitle: {
    marginTop: spacing.xs,
    lineHeight: 20,
    maxWidth: '94%',
  },
  inputCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  inputCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  pasteQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  platformPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  inputInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
  },
  inputIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  textInput: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    fontSize: 15,
  },
  iconActionBtn: {
    padding: spacing.xs,
  },
  clipboardSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  clipboardIconBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  primaryButton: {
    borderRadius: borderRadius.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  buttonText: {
    fontWeight: '700',
    fontSize: 15,
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  previewPlatformTagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  previewPlatformTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  previewTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  thumbnailWrapper: {
    width: 84,
    height: 112,
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
    paddingHorizontal: 5,
    paddingVertical: 2,
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
  formatsSection: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.25)',
  },
  formatPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  formatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  downloadTriggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    minHeight: 48,
    marginTop: spacing.md,
  },
  showcaseSection: {
    marginTop: spacing.md,
  },
  showcaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
    paddingHorizontal: 2,
  },
  platformsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  platformCard: {
    width: '48%',
    flexGrow: 1,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  platformCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  platformIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformPillBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  platformName: {
    fontWeight: '700',
  },
  howItWorksCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  howItWorksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
  },
  stepNumBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepText: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
  },
  stepChevron: {
    marginHorizontal: 2,
    marginTop: -14,
  },
});
