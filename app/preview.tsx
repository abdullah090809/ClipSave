import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme/ThemeContext';
import { spacing, borderRadius, elevation } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';
import { Badge } from '../src/components/Badge';
import { Button } from '../src/components/Button';
import { startDownload } from '../src/services/downloadEngine';
import { formatBytes, formatDuration } from '../src/utils/formatters';
import { ResolvedMedia } from '../src/types';

export default function PreviewModal() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ mediaJson?: string }>();
  const [imageError, setImageError] = useState(false);
  const [downloadStarting, setDownloadStarting] = useState(false);

  let media: ResolvedMedia | null = null;
  try {
    if (params.mediaJson) {
      media = JSON.parse(params.mediaJson);
    }
  } catch {
    media = null;
  }

  if (!media) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            android_ripple={{ color: colors.ripple, borderless: true, radius: 24 }}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close preview"
          >
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={[typography.titleLarge, { color: colors.textPrimary }]}>Preview</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceContainerHigh || colors.surfaceElevated }]}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
          </View>
          <Text style={[typography.headlineMedium, { color: colors.textPrimary, marginTop: spacing.md }]}>
            No Media Found
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, maxWidth: 300 }]}>
            The video information could not be loaded. Please return to the download screen and try again.
          </Text>
          <Button
            title="Go Back"
            onPress={() => router.back()}
            variant="primary"
            style={{ marginTop: spacing.xl, minWidth: 160 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const handleStartDownload = async () => {
    if (!media || downloadStarting) return;
    setDownloadStarting(true);
    try {
      await startDownload(media);
      router.replace('/(tabs)/queue');
    } catch {
      setDownloadStarting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Top Modal Header with Drag Indicator and Dismiss Button */}
      <View style={styles.sheetHeader}>
        <View style={[styles.dragHandle, { backgroundColor: colors.outlineVariant || colors.surfaceBorder }]} />
        <View style={styles.topBarRow}>
          <Pressable
            onPress={() => router.back()}
            android_ripple={{ color: colors.ripple, borderless: true, radius: 24 }}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Dismiss video preview"
          >
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={[typography.titleLarge, { color: colors.textPrimary }]}>Video Confirmation</Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Cinematic 16:9 Hero Card */}
        <View
          style={[
            styles.heroContainer,
            {
              backgroundColor: colors.surfaceContainerLowest || colors.surface,
              borderColor: colors.outlineVariant || colors.surfaceBorder,
            },
            Platform.OS === 'android' ? elevation.level2 : {},
          ]}
        >
          {/* Media Player Canvas */}
          <View style={[styles.mediaCanvas, { backgroundColor: colors.surfaceContainerLow || colors.surfaceElevated }]}>
            {media.thumbnailUrl && !imageError ? (
              <Image
                source={{ uri: media.thumbnailUrl }}
                style={styles.thumbnailImage}
                resizeMode="cover"
                onError={() => setImageError(true)}
                accessibilityLabel={`Thumbnail for ${media.title}`}
              />
            ) : (
              <View style={styles.placeholderThumbnail}>
                <Ionicons name="film-outline" size={54} color={colors.textMuted} />
              </View>
            )}

            {/* Duration pill overlay */}
            {media.durationSeconds !== undefined && media.durationSeconds > 0 && (
              <View style={styles.durationPill}>
                <Ionicons name="time" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={[typography.labelMedium, { color: '#FFFFFF' }]}>
                  {formatDuration(media.durationSeconds)}
                </Text>
              </View>
            )}
          </View>

          {/* Details & Metadata Body */}
          <View style={styles.detailsArea}>
            <View style={styles.badgeRow}>
              <Badge label="Public Stream Ready" variant="primary" />
              {media.isCleanSourceVerified && (
                <Badge label="Verified Clean MP4" variant="success" />
              )}
            </View>

            {/* Video Title */}
            <Text style={[typography.headlineMedium, { color: colors.textPrimary, marginTop: spacing.md }]}>
              {media.title || 'TikTok Video'}
            </Text>

            {/* Creator Attribution */}
            <View style={styles.authorRow}>
              <View style={[styles.authorAvatar, { backgroundColor: colors.primaryContainer || colors.primaryLight }]}>
                <Ionicons name="person" size={14} color={colors.primary} />
              </View>
              <Text style={[typography.titleSmall, { color: colors.primary, marginLeft: spacing.sm }]}>
                {media.author || 'Creator'}
                {media.authorUsername ? ` (@${media.authorUsername.replace(/^@/, '')})` : ''}
              </Text>
            </View>

            {/* 3-Column Material Metric Chips */}
            <View
              style={[
                styles.metricRow,
                {
                  backgroundColor: colors.surfaceContainerLow || colors.surfaceElevated,
                  borderColor: colors.outlineVariant || colors.surfaceBorder,
                },
              ]}
            >
              <View style={styles.metricItem}>
                <Text style={[typography.micro, { color: colors.textMuted }]}>FILE SIZE</Text>
                <Text style={[typography.labelLarge, { color: colors.textPrimary, marginTop: 2 }]}>
                  {formatBytes(media.estimatedSizeBytes)}
                </Text>
              </View>

              <View style={[styles.metricDivider, { backgroundColor: colors.outlineVariant || colors.surfaceBorder }]} />

              <View style={styles.metricItem}>
                <Text style={[typography.micro, { color: colors.textMuted }]}>FORMAT</Text>
                <Text style={[typography.labelLarge, { color: colors.textPrimary, marginTop: 2, textTransform: 'uppercase' }]}>
                  {media.format || 'MP4'}
                </Text>
              </View>

              <View style={[styles.metricDivider, { backgroundColor: colors.outlineVariant || colors.surfaceBorder }]} />

              <View style={styles.metricItem}>
                <Text style={[typography.micro, { color: colors.textMuted }]}>TYPE</Text>
                <Text style={[typography.labelLarge, { color: colors.textPrimary, marginTop: 2 }]}>
                  VOD Video
                </Text>
              </View>
            </View>

            {/* Safe Authorization Notice */}
            <View
              style={[
                styles.safeNoticeBox,
                {
                  backgroundColor: colors.surfaceContainerLow || colors.surfaceElevated,
                  borderColor: colors.outlineVariant || colors.surfaceBorder,
                },
              ]}
            >
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.success} />
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs, flex: 1 }]}>
                Verified stream will download chunk-by-chunk to your device storage.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Floating Bottom Action Bar */}
      <View
        style={[
          styles.bottomActionBar,
          {
            backgroundColor: colors.surfaceContainerLowest || colors.surface,
            borderTopColor: colors.outlineVariant || colors.surfaceBorder,
          },
          Platform.OS === 'android' ? elevation.level3 : {},
        ]}
      >
        <Button
          title="Cancel"
          onPress={() => router.back()}
          variant="secondary"
          size="lg"
          style={styles.cancelBtn}
          disabled={downloadStarting}
          accessibilityLabel="Cancel and return to home"
        />
        <Button
          title="Download Now"
          icon={<Ionicons name="download" size={20} color="#FFFFFF" />}
          onPress={handleStartDownload}
          variant="primary"
          size="lg"
          loading={downloadStarting}
          style={styles.downloadBtn}
          accessibilityLabel="Start downloading video now"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.xs,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  closeBtn: {
    width: spacing.touchTargetMin,
    height: spacing.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: 110, // Space for sticky bottom action bar
  },
  heroContainer: {
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  mediaCanvas: {
    width: '100%',
    height: 220,
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  placeholderThumbnail: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationPill: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsArea: {
    padding: spacing.xl,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.lg,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 26,
  },
  safeNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
  },
  cancelBtn: {
    flex: 1,
  },
  downloadBtn: {
    flex: 1.8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
});
