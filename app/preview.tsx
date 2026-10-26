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
      {/* Top Modal Header */}
      <View style={styles.header}>
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
          <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
            Confirm Download
          </Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Cinematic Media Hero */}
        <View
          style={[
            styles.mediaHero,
            { backgroundColor: colors.surfaceContainerLow || colors.surfaceElevated },
            Platform.OS === 'android' ? elevation.level2 : {},
          ]}
        >
          {media.thumbnailUrl && !imageError ? (
            <Image
              source={{ uri: media.thumbnailUrl }}
              style={styles.heroImage}
              resizeMode="cover"
              onError={() => setImageError(true)}
              accessibilityLabel={`Thumbnail for ${media.title}`}
            />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Ionicons name="videocam-outline" size={56} color={colors.textMuted} />
            </View>
          )}

          {/* Overlaid Badges */}
          <View style={styles.heroOverlay}>
            <View style={styles.creatorOverlayPill}>
              <Ionicons name="person-circle-outline" size={14} color="#FFFFFF" />
              <Text style={[typography.micro, { color: '#FFFFFF', marginLeft: 4, fontWeight: '700' }]} numberOfLines={1}>
                {media.author || 'Creator'}
              </Text>
            </View>

            {media.durationSeconds !== undefined && media.durationSeconds > 0 && (
              <View style={styles.durationOverlayPill}>
                <Ionicons name="time-outline" size={12} color="#FFFFFF" />
                <Text style={[typography.micro, { color: '#FFFFFF', marginLeft: 3, fontWeight: '700' }]}>
                  {formatDuration(media.durationSeconds)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Media Details */}
        <View style={styles.detailsContainer}>
          <Text style={[typography.headlineSmall, { color: colors.textPrimary }]} numberOfLines={3}>
            {media.title || 'TikTok Video'}
          </Text>

          {/* Quick Specifications Strip */}
          <View style={styles.specsRow}>
            <View
              style={[
                styles.specChip,
                { backgroundColor: colors.surfaceContainerLow || colors.surfaceElevated },
              ]}
            >
              <Text style={[typography.micro, { color: colors.textMuted }]}>ESTIMATED SIZE</Text>
              <Text style={[typography.titleSmall, { color: colors.primary, marginTop: 2 }]}>
                {formatBytes(media.estimatedSizeBytes)}
              </Text>
            </View>

            <View
              style={[
                styles.specChip,
                { backgroundColor: colors.surfaceContainerLow || colors.surfaceElevated },
              ]}
            >
              <Text style={[typography.micro, { color: colors.textMuted }]}>FORMAT</Text>
              <Text style={[typography.titleSmall, { color: colors.textPrimary, marginTop: 2, textTransform: 'uppercase' }]}>
                {media.format || 'MP4'}
              </Text>
            </View>

            <View
              style={[
                styles.specChip,
                { backgroundColor: colors.surfaceContainerLow || colors.surfaceElevated },
              ]}
            >
              <Text style={[typography.micro, { color: colors.textMuted }]}>STREAM</Text>
              <Text style={[typography.titleSmall, { color: colors.success, marginTop: 2 }]}>
                Verified Clean
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Decision Dock */}
      <View
        style={[
          styles.decisionDock,
          {
            backgroundColor: colors.surfaceContainerLowest || colors.surface,
            borderTopColor: colors.outlineVariant || colors.surfaceBorder,
          },
          Platform.OS === 'android' ? elevation.level3 : {},
        ]}
      >
        <Button
          title={downloadStarting ? 'Starting Download...' : `Download Video (${formatBytes(media.estimatedSizeBytes)})`}
          icon={<Ionicons name="download" size={18} color="#FFFFFF" />}
          onPress={handleStartDownload}
          variant="primary"
          size="lg"
          loading={downloadStarting}
          style={styles.downloadBtn}
          accessibilityLabel={`Confirm and download ${media.title}`}
        />

        <Pressable
          onPress={() => router.back()}
          android_ripple={{ color: colors.ripple, borderless: false }}
          style={styles.cancelBtn}
          accessibilityRole="button"
          accessibilityLabel="Cancel and return to home"
        >
          <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>
            Cancel
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 8,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  topBarRow: {
    width: '100%',
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: 120,
  },
  mediaHero: {
    width: '100%',
    height: 230,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: spacing.md,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creatorOverlayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    maxWidth: '65%',
  },
  durationOverlayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  detailsContainer: {
    marginTop: spacing.xs,
  },
  specsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  specChip: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  decisionDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'android' ? spacing.md : spacing.xl,
    borderTopWidth: 1,
  },
  downloadBtn: {
    height: 52,
    borderRadius: borderRadius.lg,
  },
  cancelBtn: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
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
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
});
