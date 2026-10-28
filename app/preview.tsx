import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../src/theme/ThemeContext';
import { spacing, borderRadius, layout, iconSize } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';
import { Button } from '../src/components/Button';
import { IconButton } from '../src/components/IconButton';
import { startDownload } from '../src/services/downloadEngine';
import { shareSavedMedia } from '../src/services/mediaManager';
import { formatBytes, formatDuration } from '../src/utils/formatters';
import { ResolvedMedia } from '../src/types';

function parseMedia(json?: string): ResolvedMedia | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as ResolvedMedia;
  } catch {
    return null;
  }
}

export default function PreviewScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    mediaJson?: string;
    fileUri?: string;
    title?: string;
  }>();

  const media = useMemo(() => parseMedia(params.mediaJson), [params.mediaJson]);
  const isLocalFile = Boolean(params.fileUri);
  const [imageError, setImageError] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(false);

  const handleOpenLocalVideo = async () => {
    if (params.fileUri) {
      await shareSavedMedia(params.fileUri);
    }
  };

  // If local file is provided, render Saved Video Preview
  if (isLocalFile && params.fileUri) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top', 'bottom']}
      >
        <View style={styles.topBar}>
          <IconButton
            icon="arrow-back"
            label="Back"
            color={colors.textPrimary}
            onPress={() => router.back()}
          />
          <Text style={[typography.titleMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
            Saved Video
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Video Placeholder / Big Icon Card */}
          <View
            style={[
              styles.savedVideoHero,
              { backgroundColor: colors.surfaceContainer, borderColor: colors.surfaceBorder },
            ]}
          >
            <View
              style={[
                styles.largePlayCircle,
                { backgroundColor: colors.primary },
              ]}
            >
              <Ionicons name="play" size={32} color={colors.onPrimary} style={{ marginLeft: 3 }} />
            </View>
            <Text
              style={[
                typography.titleLarge,
                { color: colors.textPrimary, fontWeight: '700', textAlign: 'center', marginTop: spacing.md },
              ]}
              numberOfLines={3}
            >
              {params.title || 'ClipSave TikTok Video'}
            </Text>
            <View style={styles.savedBadgeRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={[typography.caption, { color: colors.success, fontWeight: '600', marginLeft: 4 }]}>
                Saved to Device & Gallery (ClipSave Album)
              </Text>
            </View>
          </View>

          {/* Quick Info Box */}
          <View
            style={[
              styles.infoCard,
              { backgroundColor: colors.surfaceContainer, borderColor: colors.surfaceBorder },
            ]}
          >
            <View style={styles.infoRow}>
              <Ionicons name="phone-portrait-outline" size={20} color={colors.primary} />
              <View style={styles.infoTextCol}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                  Watch in Video Player
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Opens with your phone's default video player (Photos, Gallery, VLC, or Mi Video) with full screen & controls.
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

            <View style={styles.infoRow}>
              <Ionicons name="images-outline" size={20} color={colors.primary} />
              <View style={styles.infoTextCol}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                  Gallery Integration
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  This video is also accessible anytime directly in your device's Gallery app under the "ClipSave" album.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View
          style={[
            styles.actions,
            { borderTopColor: colors.outlineVariant, backgroundColor: colors.background },
          ]}
        >
          <Button
            title="Play Video"
            onPress={handleOpenLocalVideo}
            size="lg"
            accessibilityLabel="Play video in phone video player"
          />
          <Button
            title="Share Video"
            variant="tonal"
            onPress={handleOpenLocalVideo}
            accessibilityLabel="Share video"
          />
        </View>
      </SafeAreaView>
    );
  }

  // Pre-download preview (if mediaJson was provided)
  const topBar = (
    <View style={styles.topBar}>
      <IconButton icon="close" label="Close preview" color={colors.textPrimary} onPress={() => router.back()} />
      <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>Download this video?</Text>
    </View>
  );

  if (!media) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        {topBar}
        <View style={styles.errorBody}>
          <Ionicons name="alert-circle-outline" size={iconSize.hero} color={colors.danger} />
          <Text style={[typography.titleLarge, { color: colors.textPrimary, marginTop: spacing.md }]}>
            Video details unavailable
          </Text>
          <Text style={[typography.body, styles.errorText, { color: colors.textSecondary }]}>
            The link could not be loaded. Go back and resolve it again.
          </Text>
          <Button title="Back to Home" variant="tonal" onPress={() => router.back()} style={styles.errorAction} />
        </View>
      </SafeAreaView>
    );
  }

  const handleStart = async () => {
    if (starting) return;
    setStarting(true);
    setStartError(false);
    try {
      await startDownload(media);
      router.replace('/(tabs)/queue');
    } catch {
      setStarting(false);
      setStartError(true);
    }
  };

  const facts: { label: string; value: string }[] = [];
  if (media.durationSeconds !== undefined && media.durationSeconds > 0) {
    facts.push({ label: 'Duration', value: formatDuration(media.durationSeconds) });
  }
  if (media.estimatedSizeBytes !== undefined) {
    facts.push({ label: 'Estimated size', value: formatBytes(media.estimatedSizeBytes) });
  }
  facts.push({ label: 'Format', value: (media.format || 'mp4').toUpperCase() });

  const showThumb = !!media.thumbnailUrl && !imageError;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {topBar}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summary}>
          <View style={[styles.thumb, { backgroundColor: colors.surfaceContainer }]}>
            {showThumb ? (
              <Image
                source={{ uri: media.thumbnailUrl }}
                style={styles.thumbImg}
                resizeMode="cover"
                onError={() => setImageError(true)}
                accessibilityLabel={`Thumbnail for ${media.title}`}
              />
            ) : (
              <Ionicons name="videocam-outline" size={iconSize.xl} color={colors.textMuted} />
            )}
          </View>
          <View style={styles.summaryText}>
            <Text style={[typography.titleMedium, { color: colors.textPrimary }]} numberOfLines={4}>
              {media.title || 'TikTok video'}
            </Text>
            {media.author ? (
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]} numberOfLines={1}>
                {media.author}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={[styles.facts, { borderTopColor: colors.outlineVariant }]}>
          {facts.map((f) => (
            <View key={f.label} style={[styles.factRow, { borderBottomColor: colors.outlineVariant }]}>
              <Text style={[typography.body, { color: colors.textSecondary }]}>{f.label}</Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{f.value}</Text>
            </View>
          ))}
        </View>

        {media.isCleanSourceVerified ? (
          <Text style={[typography.bodySmall, styles.note, { color: colors.textSecondary }]}>
            The resolver reports this as a clean source.
          </Text>
        ) : null}
        {startError ? (
          <Text style={[typography.bodySmall, styles.note, { color: colors.danger }]} accessibilityLiveRegion="polite">
            Couldn’t start the download. Try again.
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.actions, { borderTopColor: colors.outlineVariant, backgroundColor: colors.background }]}>
        <Button
          title={`Download${media.estimatedSizeBytes !== undefined ? ` · ${formatBytes(media.estimatedSizeBytes)}` : ''}`}
          onPress={handleStart}
          size="lg"
          loading={starting}
          accessibilityLabel={`Download ${media.title}`}
        />
        <Button title="Cancel" variant="ghost" onPress={() => router.back()} disabled={starting} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { height: 56, flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.xs, gap: spacing.xs },
  content: { paddingHorizontal: layout.gutter, paddingTop: spacing.md, paddingBottom: layout.section },
  summary: { flexDirection: 'row', gap: layout.gutter },
  thumb: {
    width: 96,
    height: 128,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: { width: 96, height: 128 },
  summaryText: { flex: 1, paddingTop: spacing.xs },
  facts: { marginTop: layout.section, borderTopWidth: StyleSheet.hairlineWidth },
  factRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  note: { marginTop: spacing.md },
  actions: { padding: layout.gutter, gap: layout.stack, borderTopWidth: StyleSheet.hairlineWidth },
  errorBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxxl },
  errorText: { textAlign: 'center', marginTop: spacing.sm },
  errorAction: { marginTop: spacing.xl, minWidth: 180 },
  savedVideoHero: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  largePlayCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  infoCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  infoTextCol: {
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});
