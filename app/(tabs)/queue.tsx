import { memo, useCallback, useMemo, useState } from 'react';
import { View, Text, SectionList, StyleSheet, Alert, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { clearTerminalJobs } from '../../src/storage/queueStore';
import {
  pauseDownload,
  resumeDownload,
  cancelDownload,
  retryDownload,
} from '../../src/services/downloadEngine';
import { shareSavedMedia } from '../../src/services/mediaManager';
import { useQueueStructure, useJob } from '../../src/hooks/useQueue';
import {
  JobBucket,
  jobBucket,
  jobProgressDetail,
  jobProgressFraction,
  jobStatusLabel,
} from '../../src/utils/jobDisplay';
import { formatBytes } from '../../src/utils/formatters';
import { DownloadJob } from '../../src/types';

interface Section {
  key: JobBucket;
  title: string;
  data: DownloadJob[];
}

const SECTION_TITLES: Record<JobBucket, string> = {
  active: 'In Progress',
  failed: 'Needs Attention',
  done: 'Completed Downloads',
};
const SECTION_ORDER: JobBucket[] = ['active', 'failed', 'done'];

/**
 * Active card: reads live byte progress through useJob so only this card
 * updates on progress ticks.
 */
const ActiveCard = memo(function ActiveCard({
  item,
  onCancel,
}: {
  item: DownloadJob;
  onCancel: (job: DownloadJob) => void;
}) {
  const { colors } = useTheme();
  const job = useJob(item.id, item);
  const paused = job.state === 'PAUSED';
  const fraction = jobProgressFraction(job);
  const accentColor = paused ? colors.warning : colors.primary;
  const percentText = Math.round((fraction ?? 0.08) * 100);

  return (
    <View
      style={[
        styles.transferCard,
        {
          backgroundColor: colors.surfaceContainer,
          borderColor: paused ? colors.warning : colors.outlineVariant,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        {/* Left thumbnail / icon box */}
        <View style={[styles.thumbBox, { backgroundColor: colors.surface }]}>
          {job.media.thumbnailUrl ? (
            <Image source={{ uri: job.media.thumbnailUrl }} style={styles.thumbImage} resizeMode="cover" />
          ) : (
            <Ionicons name="film-outline" size={22} color={colors.textMuted} />
          )}
        </View>

        <View style={styles.cardMeta}>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]} numberOfLines={1}>
            {job.media.title || 'TikTok Video'}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
            {job.media.author ? `@${job.media.author} · ` : ''}{formatBytes(job.totalBytes || job.bytesDownloaded)}
          </Text>

          {/* Status badge pill */}
          <View style={styles.badgeRow}>
            <View style={[styles.statusBadge, { backgroundColor: paused ? colors.warningLight : colors.primaryLight }]}>
              <View style={[styles.statusDot, { backgroundColor: accentColor }]} />
              <Text style={[typography.labelMedium, { color: accentColor, marginLeft: 4 }]}>
                {jobStatusLabel(job)} ({percentText}%)
              </Text>
            </View>
            <Text style={[typography.labelMedium, { color: colors.textMuted, marginLeft: spacing.sm }]}>
              {jobProgressDetail(job)}
            </Text>
          </View>
        </View>
      </View>

      {/* Progress track */}
      <View style={[styles.progressTrack, { backgroundColor: colors.outlineVariant }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: accentColor,
              width: `${percentText}%`,
            },
          ]}
        />
      </View>

      {/* Action buttons */}
      <View style={styles.cardActionRow}>
        {paused ? (
          <Pressable
            onPress={() => resumeDownload(job.id)}
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Resume download"
          >
            <Ionicons name="play" size={14} color="#FFFFFF" />
            <Text style={[typography.labelMedium, { color: '#FFFFFF', marginLeft: 4 }]}>Resume</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => pauseDownload(job.id)}
            style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Pause download"
          >
            <Ionicons name="pause" size={14} color={colors.textPrimary} />
            <Text style={[typography.labelMedium, { color: colors.textPrimary, marginLeft: 4 }]}>Pause</Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => onCancel(job)}
          style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: 1, marginLeft: spacing.sm }]}
          accessibilityRole="button"
          accessibilityLabel="Cancel download"
        >
          <Ionicons name="close" size={14} color={colors.danger} />
          <Text style={[typography.labelMedium, { color: colors.danger, marginLeft: 4 }]}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
});

const FailedCard = memo(function FailedCard({ item }: { item: DownloadJob }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.transferCard,
        {
          backgroundColor: colors.surfaceContainer,
          borderColor: colors.danger,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.thumbBox, { backgroundColor: colors.dangerLight }]}>
          <Ionicons name="alert-circle-outline" size={24} color={colors.danger} />
        </View>

        <View style={styles.cardMeta}>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]} numberOfLines={1}>
            {item.media.title || 'TikTok Video'}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.danger, marginTop: 2 }]} numberOfLines={2}>
            {item.errorMessage || 'Download interrupted or failed.'}
          </Text>
        </View>
      </View>

      <View style={styles.cardActionRow}>
        <Pressable
          onPress={() => retryDownload(item.id)}
          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel="Retry download"
        >
          <Ionicons name="refresh" size={14} color="#FFFFFF" />
          <Text style={[typography.labelMedium, { color: '#FFFFFF', marginLeft: 4 }]}>Retry Download</Text>
        </Pressable>
      </View>
    </View>
  );
});

const DoneCard = memo(function DoneCard({ item }: { item: DownloadJob }) {
  const { colors } = useTheme();
  const uri = item.finalFileUri;

  return (
    <View
      style={[
        styles.transferCard,
        {
          backgroundColor: colors.surfaceContainer,
          borderColor: colors.outlineVariant,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.thumbBox, { backgroundColor: colors.surface }]}>
          {item.media.thumbnailUrl ? (
            <Image source={{ uri: item.media.thumbnailUrl }} style={styles.thumbImage} resizeMode="cover" />
          ) : (
            <Ionicons name="checkmark-circle-outline" size={24} color={colors.success} />
          )}
        </View>

        <View style={styles.cardMeta}>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]} numberOfLines={1}>
            {item.media.title || 'Saved Video'}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
            {formatBytes(item.bytesDownloaded)} · Saved to Gallery
          </Text>
        </View>

        {uri ? (
          <Pressable
            onPress={() => shareSavedMedia(uri)}
            style={[styles.iconActionCircle, { backgroundColor: colors.primaryLight }]}
            accessibilityRole="button"
            accessibilityLabel={`Share ${item.media.title}`}
          >
            <Ionicons name="share-outline" size={16} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

export default function QueueScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const jobs = useQueueStructure();
  const [filterBucket, setFilterBucket] = useState<'all' | JobBucket>('all');

  const handleCancel = useCallback((job: DownloadJob) => {
    Alert.alert(
      'Cancel this download?',
      'The partial file will be removed. You can start it again from the Download tab.',
      [
        { text: 'Keep Downloading', style: 'cancel' },
        { text: 'Cancel Download', style: 'destructive', onPress: () => cancelDownload(job.id) },
      ]
    );
  }, []);

  const counts = useMemo(() => {
    let active = 0;
    let failed = 0;
    let done = 0;
    for (const j of jobs) {
      const b = jobBucket(j);
      if (b === 'active') active++;
      else if (b === 'failed') failed++;
      else if (b === 'done') done++;
    }
    return { active, failed, done, total: jobs.length };
  }, [jobs]);

  const sections = useMemo<Section[]>(() => {
    const buckets: Record<JobBucket, DownloadJob[]> = { active: [], failed: [], done: [] };
    for (const j of jobs) buckets[jobBucket(j)].push(j);

    const keysToInclude =
      filterBucket === 'all' ? SECTION_ORDER : SECTION_ORDER.filter((k) => k === filterBucket);

    return keysToInclude
      .filter((k) => buckets[k].length > 0)
      .map((k) => ({
        key: k,
        title: SECTION_TITLES[k],
        data: buckets[k],
      }));
  }, [jobs, filterBucket]);

  const renderItem = useCallback(
    ({ item, section }: { item: DownloadJob; section: Section }) =>
      section.key === 'active' ? (
        <ActiveCard item={item} onCancel={handleCancel} />
      ) : section.key === 'failed' ? (
        <FailedCard item={item} />
      ) : (
        <DoneCard item={item} />
      ),
    [handleCancel]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => (
      <View style={[styles.sectionHeaderRow, { backgroundColor: colors.background }]}>
        <Text style={[typography.titleSmall, { color: colors.textSecondary }]}>
          {section.title.toUpperCase()} ({section.data.length})
        </Text>
        {section.key === 'done' ? (
          <Pressable
            onPress={clearTerminalJobs}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear finished downloads"
          >
            <Text style={[typography.labelMedium, { color: colors.primary }]}>Clear Finished</Text>
          </Pressable>
        ) : null}
      </View>
    ),
    [colors.background, colors.textSecondary, colors.primary]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Top Header Bar */}
      <View style={[styles.topBar, { borderBottomColor: colors.outlineVariant }]}>
        <View>
          <Text style={[typography.titleLarge, { color: colors.textPrimary }]}>Activity</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 1 }]}>
            {counts.active} active · {counts.total} total jobs
          </Text>
        </View>

        {counts.done > 0 && (
          <Pressable
            onPress={clearTerminalJobs}
            style={[styles.clearPill, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
            accessibilityRole="button"
            accessibilityLabel="Clear completed jobs"
          >
            <Ionicons name="checkmark-done" size={14} color={colors.textSecondary} />
            <Text style={[typography.labelMedium, { color: colors.textSecondary, marginLeft: 4 }]}>
              Clear Done
            </Text>
          </Pressable>
        )}
      </View>

      {/* Metric Filter Tabs */}
      <View style={styles.metricsRow}>
        <Pressable
          onPress={() => setFilterBucket('all')}
          style={[
            styles.metricTab,
            {
              backgroundColor: filterBucket === 'all' ? colors.primaryContainer : colors.surfaceContainer,
              borderColor: filterBucket === 'all' ? colors.primary : colors.outlineVariant,
            },
          ]}
        >
          <Text style={[typography.titleSmall, { color: filterBucket === 'all' ? colors.primary : colors.textPrimary }]}>
            {counts.total}
          </Text>
          <Text style={[typography.labelMedium, { color: filterBucket === 'all' ? colors.primary : colors.textMuted }]}>
            All
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilterBucket('active')}
          style={[
            styles.metricTab,
            {
              backgroundColor: filterBucket === 'active' ? colors.primaryContainer : colors.surfaceContainer,
              borderColor: filterBucket === 'active' ? colors.primary : colors.outlineVariant,
            },
          ]}
        >
          <Text style={[typography.titleSmall, { color: filterBucket === 'active' ? colors.primary : colors.textPrimary }]}>
            {counts.active}
          </Text>
          <Text style={[typography.labelMedium, { color: filterBucket === 'active' ? colors.primary : colors.textMuted }]}>
            Active
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilterBucket('failed')}
          style={[
            styles.metricTab,
            {
              backgroundColor: filterBucket === 'failed' ? colors.dangerLight : colors.surfaceContainer,
              borderColor: filterBucket === 'failed' ? colors.danger : colors.outlineVariant,
            },
          ]}
        >
          <Text style={[typography.titleSmall, { color: filterBucket === 'failed' ? colors.danger : colors.textPrimary }]}>
            {counts.failed}
          </Text>
          <Text style={[typography.labelMedium, { color: filterBucket === 'failed' ? colors.danger : colors.textMuted }]}>
            Failed
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilterBucket('done')}
          style={[
            styles.metricTab,
            {
              backgroundColor: filterBucket === 'done' ? colors.successLight : colors.surfaceContainer,
              borderColor: filterBucket === 'done' ? colors.success : colors.outlineVariant,
            },
          ]}
        >
          <Text style={[typography.titleSmall, { color: filterBucket === 'done' ? colors.success : colors.textPrimary }]}>
            {counts.done}
          </Text>
          <Text style={[typography.labelMedium, { color: filterBucket === 'done' ? colors.success : colors.textMuted }]}>
            Done
          </Text>
        </Pressable>
      </View>

      {/* List / Empty State */}
      {sections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceContainer }]}>
            <Ionicons name="swap-vertical-outline" size={36} color={colors.textMuted} />
          </View>
          <Text style={[typography.titleMedium, { color: colors.textPrimary, marginTop: spacing.md }]}>
            No Transfers in Queue
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, textAlign: 'center', marginTop: 4, maxWidth: 260 }]}>
            Paste a link on the Download tab to start downloading TikTok videos.
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)')}
            style={[styles.emptyActionBtn, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Start a download"
          >
            <Ionicons name="download-outline" size={18} color="#FFFFFF" />
            <Text style={[typography.labelMedium, { color: '#FFFFFF', marginLeft: 6 }]}>
              Start a Download
            </Text>
          </Pressable>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      )}
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  clearPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  metricTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  transferCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbBox: {
    width: 48,
    height: 58,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  cardMeta: {
    flex: 1,
    marginLeft: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  cardActionRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  iconActionCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
});
