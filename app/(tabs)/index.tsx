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
import { validateMediaUrl, detectPlatform } from '../../src/utils/urlValidator';
import { resolveMediaUrl, checkAndWarmBackend } from '../../src/services/apiClient';
import { startDownload } from '../../src/services/downloadEngine';
import { formatBytes, formatDuration } from '../../src/utils/formatters';
import { ResolvedMedia, MediaFormatOption, ResolveError } from '../../src/types';
import { getSettings } from '../../src/storage/settingsStore';
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
  const [selectedFormat, setSelectedFormat] = useState<MediaFormatOption | null>(null);
  const [showTopMenu, setShowTopMenu] = useState(false);
  const [showPreviewMenu, setShowPreviewMenu] = useState(false);
  const [clipboardDetectedUrl, setClipboardDetectedUrl] = useState<string | null>(null);
  const [clipboardPlatform, setClipboardPlatform] = useState<string>('video');
  const resolvingRef = useRef(false);

  // Real-time platform detection as user types or pastes
  const liveDetection = detectPlatform(inputUrl);

  // Check clipboard when component mounts or becomes active (without continuous polling)
  useEffect(() => {
    let isMounted = true;
    Clipboard.hasStringAsync()
      .then(async (has) => {
        if (!has || !isMounted) return;
        const text = await Clipboard.getStringAsync();
        if (text && text.trim() && isMounted) {
          const check = validateMediaUrl(text.trim());
          if (check.isValid && check.normalizedUrl && check.normalizedUrl !== inputUrl) {
            setClipboardDetectedUrl(check.normalizedUrl);
            setClipboardPlatform(check.platform === 'youtube' ? (check.isShort ? 'YouTube Short' : 'YouTube') : 'TikTok');
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
      setSelectedFormat(null);
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
    setSelectedFormat(null);
  };

  const handleResolve = async () => {
    const rawUrl = inputUrl.trim();
    if (!rawUrl) {
      setErrorMessage('Please paste or enter a YouTube or TikTok link.');
      return;
    }
    const validation = validateMediaUrl(rawUrl);
    if (!validation.isValid || !validation.normalizedUrl) {
      setErrorMessage(validation.errorMessage || 'Invalid link format. Please provide a YouTube or TikTok link.');
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
      await startDownload(mediaToDownload);
      setInputUrl('');
      setResolvedMedia(null);
      setSelectedFormat(null);
      // Navigate to Queue tab so user sees active download
      router.navigate('/(tabs)/queue');
    } catch {
      Alert.alert('Download Error', 'Could not start download. Please try again.');
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
        format: targetFormat.extension,
        quality: targetFormat.quality,
        estimatedSizeBytes: targetFormat.estimatedSizeBytes ?? resolvedMedia.estimatedSizeBytes,
      };
      handleStartDownload(mediaWithFormat);
    } else {
      handleStartDownload(resolvedMedia);
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
            Alert.alert('Copied', 'Original video link copied to clipboard.');
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
              Paste video link
            </Text>
            <Text
              style={[
                typography.bodyMedium,
                { color: colors.textSecondary, textAlign: 'center', marginTop: 4 },
              ]}
            >
              Save YouTube & TikTok videos with sound
            </Text>

            {/* Supported Platform Badges */}
            <View style={styles.supportedPlatformsRow}>
              <View style={[styles.platformBadge, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: '#EF4444' }]}>
                <Ionicons name="logo-youtube" size={13} color="#EF4444" />
                <Text style={[typography.micro, { color: '#EF4444', marginLeft: 4 }]}>YouTube</Text>
              </View>
              <View style={[styles.platformBadge, { backgroundColor: 'rgba(6, 182, 212, 0.12)', borderColor: '#06B6D4' }]}>
                <Ionicons name="musical-notes" size={13} color="#06B6D4" />
                <Text style={[typography.micro, { color: '#06B6D4', marginLeft: 4 }]}>TikTok</Text>
              </View>
              <View style={[styles.platformBadge, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant, opacity: 0.7 }]}>
                <Ionicons name="logo-instagram" size={13} color={colors.textMuted} />
                <Text style={[typography.micro, { color: colors.textMuted, marginLeft: 4 }]}>IG (Soon)</Text>
              </View>
              <View style={[styles.platformBadge, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant, opacity: 0.7 }]}>
                <Ionicons name="logo-facebook" size={13} color={colors.textMuted} />
                <Text style={[typography.micro, { color: colors.textMuted, marginLeft: 4 }]}>FB (Soon)</Text>
              </View>
            </View>
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
              accessibilityLabel={`Paste detected ${clipboardPlatform} link`}
            >
              <Ionicons
                name={clipboardPlatform.includes('YouTube') ? 'logo-youtube' : 'musical-notes'}
                size={16}
                color={colors.primary}
              />
              <Text
                style={[typography.labelMedium, { color: colors.primary, flex: 1 }]}
                numberOfLines={1}
              >
                {clipboardPlatform} link detected: tap to paste
              </Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primary} />
            </Pressable>
          )}

          {/* 4. REAL-TIME DETECTED PLATFORM PILL (WHILE TYPING/PASTING) */}
          {inputUrl.length > 0 && liveDetection.platform !== 'generic' && (
            <View style={styles.detectedPillRow}>
              {liveDetection.platform === 'youtube' && (
                <View style={[styles.detectedPill, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#EF4444' }]}>
                  <Ionicons name="logo-youtube" size={14} color="#EF4444" />
                  <Text style={[typography.micro, { color: '#EF4444', fontWeight: '700', marginLeft: 4 }]}>
                    {liveDetection.isShort ? 'YouTube Short' : 'YouTube Video'}
                  </Text>
                </View>
              )}
              {liveDetection.platform === 'tiktok' && (
                <View style={[styles.detectedPill, { backgroundColor: 'rgba(6, 182, 212, 0.15)', borderColor: '#06B6D4' }]}>
                  <Ionicons name="musical-notes" size={14} color="#06B6D4" />
                  <Text style={[typography.micro, { color: '#06B6D4', fontWeight: '700', marginLeft: 4 }]}>
                    TikTok Video
                  </Text>
                </View>
              )}
              {liveDetection.platform === 'instagram' && (
                <View style={[styles.detectedPill, { backgroundColor: 'rgba(168, 85, 247, 0.15)', borderColor: '#A855F7' }]}>
                  <Ionicons name="logo-instagram" size={14} color="#A855F7" />
                  <Text style={[typography.micro, { color: '#A855F7', fontWeight: '700', marginLeft: 4 }]}>
                    Instagram (Coming Soon)
                  </Text>
                </View>
              )}
              {liveDetection.platform === 'facebook' && (
                <View style={[styles.detectedPill, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: '#3B82F6' }]}>
                  <Ionicons name="logo-facebook" size={14} color="#3B82F6" />
                  <Text style={[typography.micro, { color: '#3B82F6', fontWeight: '700', marginLeft: 4 }]}>
                    Facebook (Coming Soon)
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* 5. LINK INPUT FIELD */}
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
              placeholder="Paste YouTube or TikTok link..."
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
              accessibilityLabel="Media link input"
              accessibilityHint="Paste or type a YouTube or TikTok URL to download"
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

          {/* 6. PRIMARY FULL-WIDTH ACTION BUTTON */}
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
                <Ionicons name="download-outline" size={20} color={colors.onPrimary} />
                <Text style={[typography.labelLarge, styles.buttonText, { color: colors.onPrimary }]}>
                  Get video
                </Text>
              </View>
            )}
          </Pressable>

          {/* 7. RESOLVED VIDEO PREVIEW CARD */}
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
                          : 'rgba(6, 182, 212, 0.12)',
                      borderColor:
                        resolvedMedia.platform === 'youtube' ? '#EF4444' : '#06B6D4',
                    },
                  ]}
                >
                  <Ionicons
                    name={resolvedMedia.platform === 'youtube' ? 'logo-youtube' : 'musical-notes'}
                    size={12}
                    color={resolvedMedia.platform === 'youtube' ? '#EF4444' : '#06B6D4'}
                  />
                  <Text
                    style={[
                      typography.micro,
                      {
                        color: resolvedMedia.platform === 'youtube' ? '#EF4444' : '#06B6D4',
                        marginLeft: 4,
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {resolvedMedia.platform === 'youtube' ? 'YouTube' : 'TikTok'}
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
                  {/* Play icon overlay */}
                  <View style={styles.playOverlay}>
                    <Ionicons
                      name={selectedFormat?.isVideo === false ? 'musical-notes' : 'play'}
                      size={14}
                      color="#FFFFFF"
                    />
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

          {/* 8. EXPANDABLE ACCORDION ROWS */}
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
              title="Supported platforms"
              subtitle="Multi-platform video & audio saving"
              icon="sparkles"
              iconColor="#8B5CF6"
              iconBgColor="rgba(139, 92, 246, 0.15)"
            >
              <View style={styles.accordionFeaturesList}>
                <View style={styles.featureItem}>
                  <Ionicons name="logo-youtube" size={20} color="#EF4444" />
                  <View style={styles.featureTextCol}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                      YouTube Videos & Shorts
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                      Full HD 1080p, 720p, 360p, and high-quality audio extraction with sound included.
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <Ionicons name="musical-notes" size={20} color="#06B6D4" />
                  <View style={styles.featureTextCol}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                      TikTok Videos & Sounds
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                      Clean watermark-free HD downloads and audio-only extraction directly to your device.
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#10B981" />
                  <View style={styles.featureTextCol}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                      Public Media Gallery Integration
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                      Single clean copy stored in your ClipSave gallery album with zero duplicate copies.
                    </Text>
                  </View>
                </View>
              </View>
            </AccordionRow>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Top Header Overflow Menu */}
      <BottomSheetMenu
        visible={showTopMenu}
        onClose={() => setShowTopMenu(false)}
        title="Home Options"
        actions={topMenuActions}
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
    paddingTop: layout.section / 2,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  supportedPlatformsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  detectedPillRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  detectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  clipboardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    marginBottom: spacing.sm,
  },
  inputLeftIcon: {
    marginRight: spacing.sm,
  },
  textInput: {
    flex: 1,
    height: '100%',
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
    paddingHorizontal: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
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
    paddingHorizontal: 10,
    borderRadius: borderRadius.full,
    borderWidth: 1,
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
