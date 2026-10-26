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
import { Card } from '../src/components/Card';
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
      {/* Top App Bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          android_ripple={{ color: colors.ripple, borderless: true, radius: 24 }}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Dismiss video preview"
        >
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typography.titleLarge, { color: colors.textPrimary }]}>Video Preview</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Main Preview Card */}
        <Card variant="elevated" style={styles.previewCard}>
          {/* Thumbnail / Hero Container */}
          <View style={[styles.mediaContainer, { backgroundColor: colors.surfaceContainerLow || colors.surfaceElevated }]}>
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

          {/* Details Body */}
          <View style={styles.detailsArea}>
            <View style={styles.badgeRow}>
              <Badge label="Stream Ready" variant="primary" />
              {media.isCleanSourceVerified && (
                <Badge label="Verified Clean" variant="success" />
              )}
            </View>

            {/* Video Title */}
            <Text style={[typography.headlineMedium, { color: colors.textPrimary, marginTop: spacing.sm }]}>
              {media.title || 'Untitled Video'}
            </Text>

            {/* Creator Attribution */}
            <View style={styles.authorRow}>
              <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
              <Text style={[typography.titleSmall, { color: colors.primary, marginLeft: 6 }]}>
                {media.author || 'Creator'}
                {media.authorUsername ? ` (${media.authorUsername})` : ''}
              </Text>
            </View>

            {/* Metadata Chips Grid */}
            <View
              style={[
                styles.metaGrid,
                {
                  backgroundColor: colors.surfaceContainerLow || colors.surfaceElevated,
                  borderColor: colors.outlineVariant || colors.surfaceBorder,
                },
              ]}
            >
              <View style={styles.metaItem}>
                <Text style={[typography.micro, { color: colors.textMuted }]}>FILE SIZE</Text>
                <Text style={[typography.labelLarge, { color: colors.textPrimary, marginTop: 2 }]}>
                  {formatBytes(media.estimatedSizeBytes)}
                </Text>
              </View>

              <View style={[styles.metaDivider, { backgroundColor: colors.outlineVariant || colors.surfaceBorder }]} />

              <View style={styles.metaItem}>
                <Text style={[typography.micro, { color: colors.textMuted }]}>FORMAT</Text>
                <Text style={[typography.labelLarge, { color: colors.textPrimary, marginTop: 2, textTransform: 'uppercase' }]}>
                  {media.format || 'MP4'}
                </Text>
              </View>

              <View style={[styles.metaDivider, { backgroundColor: colors.outlineVariant || colors.surfaceBorder }]} />

              <View style={styles.metaItem}>
                <Text style={[typography.micro, { color: colors.textMuted }]}>TYPE</Text>
                <Text style={[typography.labelLarge, { color: colors.textPrimary, marginTop: 2 }]}>
                  Video (VOD)
                </Text>
              </View>
            </View>

            {/* Responsibility Notice */}
            <View
              style={[
                styles.reminderBox,
                {
                  backgroundColor: colors.surfaceContainerLow || colors.surfaceElevated,
                  borderColor: colors.outlineVariant || colors.surfaceBorder,
                },
              ]}
            >
              <Ionicons name="shield-outline" size={16} color={colors.textMuted} />
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs, flex: 1 }]}>
                Confirm you are authorized to save this video to your local device.
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>

      {/* Bottom Sticky Action Bar */}
      <View
        style={[
          styles.bottomActionBar,
          {
            backgroundColor: colors.surfaceContainerLowest || colors.surface,
            borderTopColor: colors.outlineVariant || colors.surfaceBorder,
          },
          Platform.OS === 'android' ? elevation.level2 : {},
        ]}
      >
        <Button
          title="Cancel"
          onPress={() => router.back()}
          variant="secondary"
          style={styles.cancelButton}
          disabled={downloadStarting}
          accessibilityLabel="Cancel and return"
        />
        <Button
          title="Start Download"
          icon={<Ionicons name="download" size={18} color="#FFFFFF" />}
          onPress={handleStartDownload}
          variant="primary"
          loading={downloadStarting}
          style={styles.downloadButton}
          accessibilityLabel="Confirm and start downloading video"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  closeBtn: {
    width: spacing.touchTargetMin,
    height: spacing.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100, // Space for sticky bottom action bar
  },
  previewCard: {
    padding: 0,
    overflow: 'hidden',
  },
  mediaContainer: {
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
    padding: spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  metaGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.lg,
  },
  metaItem: {
    flex: 1,
    alignItems: 'center',
  },
  metaDivider: {
    width: 1,
    height: 24,
  },
  reminderBox: {
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
  cancelButton: {
    flex: 1,
  },
  downloadButton: {
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
});
