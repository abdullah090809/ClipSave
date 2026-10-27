import { useState, useCallback, useEffect, useRef } from 'react';
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
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { extractAndValidateTikTokUrl } from '../../src/utils/urlValidator';
import { resolveTikTokUrl } from '../../src/services/apiClient';
import { startDownload } from '../../src/services/downloadEngine';
import { getHistory } from '../../src/storage/historyStore';
import { shareSavedMedia } from '../../src/services/mediaManager';
import { formatBytes, formatDuration } from '../../src/utils/formatters';
import { HistoryItem, ResolvedMedia, ResolveError } from '../../src/types';
import { BottomSheetMenu, SheetAction } from '../../src/components/BottomSheetMenu';

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ prefill?: string; ts?: string }>();

  // State
  const [inputUrl, setInputUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [resolvedMedia, setResolvedMedia] = useState<ResolvedMedia | null>(null);
  const [recentItems, setRecentItems] = useState<HistoryItem[]>([]);
  const [selectedItemForMenu, setSelectedItemForMenu] = useState<HistoryItem | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [clipboardDetectedUrl, setClipboardDetectedUrl] = useState<string | null>(null);
  const resolvingRef = useRef(false);

  // Load recent activity
  const loadRecentActivity = useCallback(async () => {
    try {
      const history = await getHistory(false);
      setRecentItems(history.slice(0, 3));
    } catch {
      // ignore
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRecentActivity();
    }, [loadRecentActivity])
  );

  // Check clipboard on focus
  useFocusEffect(
    useCallback(() => {
      Clipboard.hasStringAsync()
        .then(async (has) => {
          if (!has) return;
          const text = await Clipboard.getStringAsync();
          if (text && text.trim()) {
            const check = extractAndValidateTikTokUrl(text.trim());
            if (check.isValid && check.normalizedUrl && check.normalizedUrl !== inputUrl) {
              setClipboardDetectedUrl(check.normalizedUrl);
            }
          }
        })
        .catch(() => {});
    }, [inputUrl])
  );

  // Prefill handling
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
    setErrorMessage(null);
    setResolvedMedia(null);

    try {
      const media = await resolveTikTokUrl(validation.normalizedUrl);
      setResolvedMedia(media);
      setClipboardDetectedUrl(null);
    } catch (err: unknown) {
      const resolveErr = err as ResolveError;
      setErrorMessage(resolveErr?.message || 'Unable to resolve video. Ensure the video is public.');
    } finally {
      resolvingRef.current = false;
      setResolving(false);
    }
  };

  const handleStartDownload = async (mediaToDownload: ResolvedMedia) => {
    try {
      await startDownload(mediaToDownload);
      setInputUrl('');
      setResolvedMedia(null);
      // Navigate to Queue tab so user sees download underway
      router.push('/(tabs)/queue');
    } catch {
      Alert.alert('Download Error', 'Could not start download. Please try again.');
    }
  };

  const handleLearnMore = () => {
    Alert.alert(
      'Supported TikTok Links',
      'ClipSave supports public TikTok videos from:\n\n• https://www.tiktok.com/@user/video/...\n• https://vt.tiktok.com/...\n• https://vm.tiktok.com/...\n\nPrivate videos or links requiring a user login cannot be resolved.'
    );
  };

  const handleNotificationPress = () => {
    Alert.alert('Notifications', 'All download notifications and alerts are up to date.');
  };

  const menuActions: SheetAction[] = selectedItemForMenu
    ? [
        {
          key: 'share',
          label: 'Share Video',
          icon: 'share-outline',
          onPress: () => shareSavedMedia(selectedItemForMenu.fileUri),
        },
        {
          key: 'view-history',
          label: 'View in History',
          icon: 'time-outline',
          onPress: () => router.push('/(tabs)/history'),
        },
      ]
    : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* 1. TOP HEADER */}
      <View style={[styles.header, { borderBottomColor: colors.outlineVariant }]}>
        <View style={styles.headerLeft}>
          <Image
            source={require('../../assets/tiktok-logo.png')}
            style={styles.headerLogoImg}
            resizeMode="contain"
          />
          <View style={styles.headerTitleBox}>
            <Text style={[typography.titleMedium, { color: colors.textPrimary, fontWeight: '800' }]}>
              ClipSave
            </Text>
            <Text style={[typography.caption, { color: colors.accent, fontWeight: '600' }]}>
              TikTok Video Downloader
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            onPress={handleNotificationPress}
            style={[styles.headerIconBtn, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={19} color={colors.textPrimary} />
            <View style={styles.unreadDot} />
          </Pressable>

          <Pressable
            onPress={() => router.push('/(tabs)/settings')}
            style={[styles.headerIconBtn, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant, marginLeft: spacing.sm }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={19} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* SMART CLIPBOARD NOTIFICATION BANNER */}
          {clipboardDetectedUrl && (
            <View style={[styles.clipboardBanner, { backgroundColor: colors.primaryContainer, borderColor: colors.primary }]}>
              <View style={styles.clipboardMeta}>
                <View style={styles.clipboardBadgeRow}>
                  <Ionicons name="clipboard" size={13} color={colors.primary} />
                  <Text style={[typography.captionMedium, { color: colors.primary, marginLeft: 4, fontWeight: '700' }]}>
                    LINK FOUND ON CLIPBOARD
                  </Text>
                </View>
                <Text style={[typography.bodySmall, { color: colors.textPrimary, marginTop: 2 }]} numberOfLines={1}>
                  {clipboardDetectedUrl}
                </Text>
              </View>

              <View style={styles.clipboardActionBox}>
                <Pressable
                  onPress={() => {
                    setInputUrl(clipboardDetectedUrl);
                    setClipboardDetectedUrl(null);
                  }}
                  style={[styles.clipboardUseBtn, { backgroundColor: colors.primary }]}
                  accessibilityRole="button"
                >
                  <Text style={[typography.captionMedium, { color: '#FFFFFF', fontWeight: '700' }]}>Paste</Text>
                </Pressable>
                <Pressable
                  onPress={() => setClipboardDetectedUrl(null)}
                  style={styles.clipboardDismiss}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <Ionicons name="close" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>
          )}

          {/* 2. HERO BANNER */}
          <View style={[styles.heroCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
            <View style={styles.heroLeft}>
              <View style={[styles.heroEyebrowBadge, { backgroundColor: 'rgba(6, 182, 212, 0.12)' }]}>
                <Text style={[styles.heroEyebrowText, { color: colors.accent }]}>
                  SAVE ANY TIKTOK VIDEO
                </Text>
              </View>

              <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
                Paste. Resolve.{'\n'}
                <Text style={{ color: colors.primary }}>Download.</Text>
              </Text>

              <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
                High quality videos, no watermark (when available), directly to your device.
              </Text>
            </View>

            <View style={styles.heroRight}>
              <View style={[styles.phoneGraphic, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
                <View style={[styles.phoneCameraPill, { backgroundColor: colors.surfaceBorder }]} />
                <Image
                  source={require('../../assets/tiktok-logo.png')}
                  style={styles.phoneLogoImg}
                  resizeMode="contain"
                />
                <View style={[styles.phoneDownloadBadge, { backgroundColor: colors.success }]}>
                  <Ionicons name="arrow-down" size={12} color="#FFFFFF" />
                </View>
              </View>
            </View>
          </View>

          {/* 3. MAIN DOWNLOAD INPUT BOX */}
          <View style={[styles.downloadBox, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
            {/* Input Bar */}
            <View
              style={[
                styles.inputBar,
                {
                  backgroundColor: colors.surface,
                  borderColor: errorMessage ? colors.danger : isFocused ? colors.primary : colors.surfaceBorder,
                },
              ]}
            >
              <Ionicons name="link-outline" size={19} color={isFocused ? colors.primary : colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { color: colors.textPrimary }]}
                placeholder="Paste TikTok link here..."
                placeholderTextColor={colors.textMuted}
                value={inputUrl}
                onChangeText={(t) => {
                  setInputUrl(t);
                  if (errorMessage) setErrorMessage(null);
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                onSubmitEditing={handleResolve}
                accessibilityLabel="TikTok video link input"
              />
              {inputUrl.length > 0 && (
                <Pressable onPress={handleClear} hitSlop={8} style={styles.clearIconBtn}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              )}
            </View>

            {/* Error Message */}
            {errorMessage ? (
              <View style={[styles.errorBox, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                <Text style={[typography.bodySmall, { color: colors.danger, marginLeft: 6, flex: 1 }]}>
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            {/* 3 Action Buttons Row: [Paste] [Clear] [Resolve ➔] */}
            <View style={styles.actionButtonsRow}>
              {/* Paste Button */}
              <Pressable
                onPress={handlePaste}
                style={[styles.actionBtn, styles.actionBtnOutline, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
                android_ripple={{ color: colors.ripple }}
                accessibilityRole="button"
                accessibilityLabel="Paste from clipboard"
              >
                <Ionicons name="clipboard-outline" size={16} color={colors.textPrimary} />
                <View style={styles.btnTextCol}>
                  <Text style={[typography.labelMedium, { color: colors.textPrimary, fontWeight: '700' }]}>Paste</Text>
                  <Text style={[styles.btnCaption, { color: colors.textMuted }]}>From clipboard</Text>
                </View>
              </Pressable>

              {/* Clear Button */}
              <Pressable
                onPress={handleClear}
                style={[styles.actionBtn, styles.actionBtnOutline, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
                android_ripple={{ color: colors.ripple }}
                accessibilityRole="button"
                accessibilityLabel="Clear input"
              >
                <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
                <View style={styles.btnTextCol}>
                  <Text style={[typography.labelMedium, { color: colors.textSecondary, fontWeight: '700' }]}>Clear</Text>
                  <Text style={[styles.btnCaption, { color: colors.textMuted }]}>Input</Text>
                </View>
              </Pressable>

              {/* Resolve Button */}
              <Pressable
                onPress={handleResolve}
                disabled={resolving}
                style={[styles.actionBtn, styles.actionBtnPrimary, { backgroundColor: colors.primary }]}
                android_ripple={{ color: colors.ripplePrimary }}
                accessibilityRole="button"
                accessibilityLabel="Resolve TikTok video"
              >
                {resolving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                    <View style={styles.btnTextCol}>
                      <Text style={[typography.labelMedium, { color: '#FFFFFF', fontWeight: '800' }]}>Resolve</Text>
                      <Text style={[styles.btnCaption, { color: 'rgba(255,255,255,0.8)' }]}>Fetch video</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={14} color="#FFFFFF" style={{ marginLeft: 2 }} />
                  </>
                )}
              </Pressable>
            </View>

            {/* Resolved Video Card */}
            {resolvedMedia && (
              <View style={[styles.resolvedCard, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
                <View style={styles.resolvedTopRow}>
                  <View style={[styles.resolvedThumbBox, { backgroundColor: colors.surfaceContainer }]}>
                    {resolvedMedia.thumbnailUrl ? (
                      <Image source={{ uri: resolvedMedia.thumbnailUrl }} style={styles.resolvedThumb} resizeMode="cover" />
                    ) : (
                      <Ionicons name="film-outline" size={24} color={colors.textMuted} />
                    )}
                    {resolvedMedia.durationSeconds ? (
                      <View style={styles.durationPill}>
                        <Text style={styles.durationText}>{formatDuration(resolvedMedia.durationSeconds)}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.resolvedMeta}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]} numberOfLines={2}>
                      {resolvedMedia.title || 'TikTok Video'}
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                      {resolvedMedia.author ? `@${resolvedMedia.author}` : 'TikTok Creator'}
                    </Text>
                    <Text style={[typography.captionMedium, { color: colors.accent, marginTop: 2 }]}>
                      {formatBytes(resolvedMedia.estimatedSizeBytes || 12000000)} • No Watermark
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => handleStartDownload(resolvedMedia)}
                  style={[styles.downloadNowBtn, { backgroundColor: colors.primary }]}
                  android_ripple={{ color: colors.ripplePrimary }}
                  accessibilityRole="button"
                  accessibilityLabel="Download resolved video"
                >
                  <Ionicons name="download" size={18} color="#FFFFFF" />
                  <Text style={[typography.labelLarge, { color: '#FFFFFF', fontWeight: '700', marginLeft: 8 }]}>
                    Download Video (No Watermark)
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* 4. FOUR FEATURE BADGES (2x2 GRID) */}
          <View style={styles.featuresGrid}>
            <View style={[styles.featureCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
              <View style={[styles.featureIconCircle, { backgroundColor: 'rgba(6, 182, 212, 0.15)' }]}>
                <Ionicons name="flash" size={18} color={colors.accent} />
              </View>
              <Text style={[typography.labelMedium, { color: colors.textPrimary, fontWeight: '700', marginTop: 8 }]}>
                Fast
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                Quick resolution
              </Text>
            </View>

            <View style={[styles.featureCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
              <View style={[styles.featureIconCircle, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
              </View>
              <Text style={[typography.labelMedium, { color: colors.textPrimary, fontWeight: '700', marginTop: 8 }]}>
                Secure
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                Your privacy matters
              </Text>
            </View>

            <View style={[styles.featureCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
              <View style={[styles.featureIconCircle, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                <Ionicons name="phone-portrait" size={18} color="#A78BFA" />
              </View>
              <Text style={[typography.labelMedium, { color: colors.textPrimary, fontWeight: '700', marginTop: 8 }]}>
                Android
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                Optimized for mobile
              </Text>
            </View>

            <View style={[styles.featureCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
              <View style={[styles.featureIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              </View>
              <Text style={[typography.labelMedium, { color: colors.textPrimary, fontWeight: '700', marginTop: 8 }]}>
                No Watermark
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                When available
              </Text>
            </View>
          </View>

          {/* 5. RECENT ACTIVITY SECTION */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[typography.titleSmall, { color: colors.textPrimary, fontWeight: '700' }]}>
              Recent Activity
            </Text>
            <Pressable onPress={() => router.push('/(tabs)/history')} hitSlop={8}>
              <Text style={[typography.labelMedium, { color: colors.primary, fontWeight: '600' }]}>
                View All &gt;
              </Text>
            </Pressable>
          </View>

          {recentItems.length > 0 ? (
            <View style={styles.recentList}>
              {recentItems.map((item) => (
                <View
                  key={item.id}
                  style={[styles.recentItemCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
                >
                  <View style={[styles.recentThumbBox, { backgroundColor: colors.surface }]}>
                    {item.thumbnailUrl ? (
                      <Image source={{ uri: item.thumbnailUrl }} style={styles.recentThumbImg} resizeMode="cover" />
                    ) : (
                      <Ionicons name="film-outline" size={20} color={colors.textMuted} />
                    )}
                    {item.durationSeconds ? (
                      <View style={styles.recentDurationBadge}>
                        <Text style={styles.recentDurationText}>{formatDuration(item.durationSeconds)}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.recentInfo}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]} numberOfLines={1}>
                      {item.title || 'TikTok Video'}
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                      {formatBytes(item.fileSizeBytes)} • {item.author ? `@${item.author}` : 'Video'}
                    </Text>
                    <View style={styles.completedBadgeRow}>
                      <View style={[styles.completedPill, { backgroundColor: colors.successLight }]}>
                        <Ionicons name="checkmark" size={11} color={colors.success} />
                        <Text style={[styles.completedText, { color: colors.success }]}>Completed</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.recentItemActions}>
                    <Pressable
                      onPress={() => shareSavedMedia(item.fileUri)}
                      style={[styles.iconActionBtn, { backgroundColor: colors.surface }]}
                      hitSlop={6}
                      accessibilityLabel="Share video"
                    >
                      <Ionicons name="share-outline" size={17} color={colors.textPrimary} />
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setSelectedItemForMenu(item);
                        setShowMenu(true);
                      }}
                      style={[styles.iconActionBtn, { backgroundColor: colors.surface, marginLeft: 6 }]}
                      hitSlop={6}
                      accessibilityLabel="More options"
                    >
                      <Ionicons name="ellipsis-vertical" size={17} color={colors.textMuted} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={[styles.emptyRecentCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
              <Ionicons name="cloud-download-outline" size={28} color={colors.textMuted} />
              <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 8 }]}>
                No downloads yet
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 2, textAlign: 'center' }]}>
                Paste a TikTok link above to start downloading.
              </Text>
            </View>
          )}

          {/* 6. SUPPORTED LINKS TIP CARD */}
          <View style={[styles.tipCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
            <View style={[styles.tipIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
              <Ionicons name="bulb-outline" size={20} color={colors.warning} />
            </View>

            <View style={styles.tipTextCol}>
              <Text style={[typography.titleSmall, { color: colors.textPrimary, fontWeight: '700' }]}>
                Supported Links
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2, lineHeight: 18 }]}>
                TikTok video links are supported. Make sure the video is public and accessible.
              </Text>
              <Pressable onPress={handleLearnMore} style={styles.learnMoreRow} hitSlop={6}>
                <Text style={[typography.labelMedium, { color: colors.accent, fontWeight: '600' }]}>
                  Learn More &gt;
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Action Menu */}
      <BottomSheetMenu
        visible={showMenu}
        title={selectedItemForMenu?.title || 'Video Actions'}
        actions={menuActions}
        onClose={() => {
          setShowMenu(false);
          setSelectedItemForMenu(null);
        }}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogoImg: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  headerTitleBox: {
    marginLeft: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  clipboardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    marginBottom: spacing.md,
  },
  clipboardMeta: {
    flex: 1,
  },
  clipboardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clipboardActionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  clipboardUseBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  clipboardDismiss: {
    padding: 6,
    marginLeft: 4,
  },
  // Hero Banner
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  heroLeft: {
    flex: 1.6,
    paddingRight: spacing.sm,
  },
  heroEyebrowBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  heroEyebrowText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  heroSubtitle: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },
  heroRight: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneGraphic: {
    width: 76,
    height: 110,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  phoneCameraPill: {
    position: 'absolute',
    top: 5,
    width: 20,
    height: 4,
    borderRadius: 2,
  },
  phoneLogoImg: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  phoneDownloadBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#070A13',
  },
  // Main Download Box
  downloadBox: {
    borderRadius: 18,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  clearIconBtn: {
    padding: 4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: borderRadius.md,
  },
  actionBtnOutline: {
    borderWidth: 1,
  },
  actionBtnPrimary: {
    flex: 1.3,
  },
  btnTextCol: {
    marginLeft: 6,
  },
  btnCaption: {
    fontSize: 9,
    fontWeight: '500',
    marginTop: 1,
  },
  resolvedCard: {
    marginTop: spacing.md,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  resolvedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resolvedThumbBox: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  resolvedThumb: {
    width: '100%',
    height: '100%',
  },
  durationPill: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  resolvedMeta: {
    flex: 1,
    marginLeft: spacing.md,
  },
  downloadNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  // Features Grid
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: spacing.xl,
  },
  featureCard: {
    width: '48.5%',
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.md,
  },
  featureIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Recent Activity
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  recentList: {
    gap: 10,
    marginBottom: spacing.xl,
  },
  recentItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.md,
  },
  recentThumbBox: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  recentThumbImg: {
    width: '100%',
    height: '100%',
  },
  recentDurationBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 3,
    borderRadius: 3,
  },
  recentDurationText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  recentInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  completedBadgeRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  completedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  completedText: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 3,
  },
  recentItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  iconActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRecentCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  // Tip Card
  tipCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  tipIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipTextCol: {
    flex: 1,
    marginLeft: spacing.md,
  },
  learnMoreRow: {
    marginTop: spacing.sm,
  },
});
