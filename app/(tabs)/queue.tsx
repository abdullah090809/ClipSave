import { memo, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Pressable,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius, layout } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { clearTerminalJobs } from '../../src/storage/queueStore';
import {
  pauseDownload,
  resumeDownload,
  removeDownloadJob,
  retryDownload,
} from '../../src/services/downloadEngine';
import { shareSavedMedia, playVideo } from '../../src/services/mediaManager';
import { useQueueStructure, useJob } from '../../src/hooks/useQueue';
import { jobProgressFraction } from '../../src/utils/jobDisplay';
import { formatBytes, formatDuration } from '../../src/utils/formatters';
import { DownloadJob } from '../../src/types';
import { BottomSheetMenu, SheetAction } from '../../src/components/BottomSheetMenu';
import { TabHeader } from '../../src/components/TabHeader';
import { AnimatedFill } from '../../src/components/ProgressBar';

type FilterType = 'all' | 'active' | 'paused' | 'done';

/** Clean Download Card Matching Reference Mockup with Direct Remove Actions */
const QueueJobCard = memo(function QueueJobCard({
  item,
  onOpenMenu,
  onRemove,
}: {
  item: DownloadJob;
  onOpenMenu: (job: DownloadJob) => void;
  onRemove: (job: DownloadJob) => void;
}) {
  const { colors } = useTheme();
  const job = useJob(item.id, item);

  const isPaused = job.state === 'PAUSED';
  const isActive = job.state === 'DOWNLOADING' || job.state === 'FINALIZING' || job.state === 'QUEUED';
  const isDone = job.state === 'COMPLETED';
  const isFailed = job.state === 'FAILED' || job.state === 'CANCELLED';

  const knownFraction = jobProgressFraction(job);
  const percent = Math.min(100, Math.max(0, Math.round((knownFraction ?? 0) * 100)));
  const totalBytes = job.totalBytes ?? job.media.estimatedSizeBytes;
  const sizeText = totalBytes
    ? `${formatBytes(job.bytesDownloaded || totalBytes)} • 1080p`
    : `${formatBytes(job.bytesDownloaded || 0)} • 1080p`;

  const handlePrimaryPill = () => {
    if (isPaused) {
      resumeDownload(job.id);
    } else if (isActive) {
      pauseDownload(job.id);
    } else if (isDone && job.finalFileUri) {
      playVideo(job.finalFileUri);
    } else if (isFailed) {
      retryDownload(job.id);
    }
  };

  const handleSecondaryPill = () => {
    onRemove(job);
  };

  return (
    <View
      style={[
        styles.jobCard,
        {
          backgroundColor: colors.surfaceContainer,
          borderColor: colors.surfaceBorder,
        },
      ]}
    >
      {/* Top Row: Thumbnail + Metadata + Right Header Actions (✕ Remove & 3-Dots) */}
      <View style={styles.cardTopRow}>
        {/* Thumbnail with duration badge and play icon */}
        <Pressable
          onPress={isDone && job.finalFileUri ? () => playVideo(job.finalFileUri!) : undefined}
          disabled={!isDone || !job.finalFileUri}
          style={styles.thumbnailWrapper}
          accessibilityRole={isDone ? 'button' : undefined}
          accessibilityLabel={isDone ? 'Play completed video' : undefined}
        >
          {job.media.thumbnailUrl ? (
            <Image
              source={{ uri: job.media.thumbnailUrl }}
              style={styles.thumbnailImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.thumbnailPlaceholder, { backgroundColor: colors.surfaceContainerHigh }]}>
              <Ionicons name="film-outline" size={24} color={colors.primary} />
            </View>
          )}
          <View style={styles.playOverlay}>
            <Ionicons name="play" size={12} color="#FFFFFF" />
          </View>
          {job.media.durationSeconds ? (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>
                {formatDuration(job.media.durationSeconds)}
              </Text>
            </View>
          ) : null}
        </Pressable>

        {/* Title, Creator, Size */}
        <View style={styles.metaCol}>
          <Text
            style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]}
            numberOfLines={2}
          >
            {job.media.title || 'TikTok Video'}
          </Text>
          <Text
            style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}
            numberOfLines={1}
          >
            @{job.media.authorUsername || job.media.author || 'creator'}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
            {sizeText}
          </Text>
        </View>

        {/* Right Header Actions: Quick ✕ Remove & 3-Dots Menu */}
        <View style={styles.cardHeaderActions}>
          <Pressable
            onPress={() => onRemove(job)}
            style={styles.cardHeaderIconButton}
            accessibilityRole="button"
            accessibilityLabel={isDone ? 'Remove from queue' : 'Cancel and remove'}
            hitSlop={8}
          >
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>

          <Pressable
            onPress={() => onOpenMenu(job)}
            style={styles.cardHeaderIconButton}
            accessibilityRole="button"
            accessibilityLabel="Download job options"
            hitSlop={8}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Progress Bar (Shown for active, paused, or queued jobs) */}
      {!isDone && (
        <View style={styles.progressSection}>
          <View style={[styles.progressTrack, { backgroundColor: colors.surfaceContainerHighest }]}>
            <AnimatedFill
              percent={isDone ? 100 : Math.max(percent, 4)}
              style={[
                styles.progressFill,
                { backgroundColor: isPaused ? colors.warning : colors.primary },
              ]}
            />
          </View>
          <Text style={[typography.numeric, styles.percentText, { color: colors.textSecondary }]}>
            {isDone ? '100%' : `${percent}%`}
          </Text>
        </View>
      )}

      {/* Bottom Actions Row: Two Equal Pill Buttons */}
      <View style={styles.pillsRow}>
        <Pressable
          onPress={handlePrimaryPill}
          android_ripple={{ color: colors.ripple }}
          style={[
            styles.pillButton,
            {
              backgroundColor: isPaused ? colors.primaryLight : colors.surfaceContainerHigh,
              borderColor: isPaused ? colors.primaryBorder : colors.outlineVariant,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            isPaused ? 'Resume download' : isActive ? 'Pause download' : isDone ? 'Play video' : 'Retry download'
          }
        >
          <Ionicons
            name={
              isPaused
                ? 'play-outline'
                : isActive
                ? 'pause-outline'
                : isDone
                ? 'play-circle-outline'
                : 'reload-outline'
            }
            size={16}
            color={isPaused ? colors.primary : colors.textPrimary}
          />
          <Text
            style={[
              typography.labelMedium,
              { color: isPaused ? colors.primary : colors.textPrimary, marginLeft: 6 },
            ]}
          >
            {isPaused ? 'Resume' : isActive ? 'Pause' : isDone ? 'Play' : 'Retry'}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSecondaryPill}
          android_ripple={{ color: colors.ripple }}
          style={[
            styles.pillButton,
            {
              backgroundColor: isDone || isFailed ? colors.surfaceContainerHigh : colors.surfaceContainerHigh,
              borderColor: colors.outlineVariant,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={isDone || isFailed ? 'Remove from queue' : 'Cancel download'}
        >
          <Ionicons
            name={isDone || isFailed ? 'trash-outline' : 'close-outline'}
            size={16}
            color={colors.danger}
          />
          <Text
            style={[
              typography.labelMedium,
              { color: colors.danger, marginLeft: 6 },
            ]}
          >
            {isDone || isFailed ? 'Remove' : 'Cancel'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

export default function QueueScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const jobs = useQueueStructure();

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedJob, setSelectedJob] = useState<DownloadJob | null>(null);
  const [showJobMenu, setShowJobMenu] = useState(false);
  const [showTopMenu, setShowTopMenu] = useState(false);

  // Compute counts
  const activeCount = useMemo(
    () => jobs.filter((j) => j.state === 'DOWNLOADING' || j.state === 'FINALIZING' || j.state === 'QUEUED').length,
    [jobs]
  );
  const pausedCount = useMemo(
    () => jobs.filter((j) => j.state === 'PAUSED').length,
    [jobs]
  );
  const doneCount = useMemo(
    () => jobs.filter((j) => j.state === 'COMPLETED').length,
    [jobs]
  );

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    if (activeFilter === 'active') {
      return jobs.filter((j) => j.state === 'DOWNLOADING' || j.state === 'FINALIZING' || j.state === 'QUEUED');
    }
    if (activeFilter === 'paused') {
      return jobs.filter((j) => j.state === 'PAUSED');
    }
    if (activeFilter === 'done') {
      return jobs.filter((j) => j.state === 'COMPLETED');
    }
    return jobs;
  }, [jobs, activeFilter]);

  const handlePauseAll = useCallback(() => {
    const toPause = jobs.filter(
      (j) => j.state === 'DOWNLOADING' || j.state === 'FINALIZING' || j.state === 'QUEUED'
    );
    toPause.forEach((j) => pauseDownload(j.id));
  }, [jobs]);

  const handleResumeAll = useCallback(() => {
    const toResume = jobs.filter((j) => j.state === 'PAUSED');
    toResume.forEach((j) => resumeDownload(j.id));
  }, [jobs]);

  const handleClearFinished = useCallback(() => {
    clearTerminalJobs();
  }, []);

  const handleRemoveJob = useCallback((job: DownloadJob) => {
    if (job.state === 'DOWNLOADING' || job.state === 'FINALIZING' || job.state === 'QUEUED') {
      Alert.alert(
        'Cancel & Remove Download?',
        `Stop downloading "${job.media.title || 'this video'}" and remove it from the queue?`,
        [
          { text: 'Keep', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => removeDownloadJob(job.id),
          },
        ]
      );
    } else if (job.state === 'PAUSED') {
      Alert.alert(
        'Remove Paused Download?',
        `Remove "${job.media.title || 'this video'}" from the queue?`,
        [
          { text: 'Keep', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => removeDownloadJob(job.id),
          },
        ]
      );
    } else {
      // Completed, failed, or cancelled: remove directly from queue
      removeDownloadJob(job.id);
    }
  }, []);

  const handleClearEntireQueue = useCallback(() => {
    Alert.alert(
      'Clear Entire Queue?',
      'Cancel and remove all downloads from the queue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            for (const j of jobs) {
              await removeDownloadJob(j.id);
            }
          },
        },
      ]
    );
  }, [jobs]);

  const topMenuActions: SheetAction[] = [
    {
      key: 'pause-all',
      label: 'Pause All Downloads',
      icon: 'pause-circle-outline',
      onPress: handlePauseAll,
    },
    {
      key: 'resume-all',
      label: 'Resume All Downloads',
      icon: 'play-circle-outline',
      onPress: handleResumeAll,
    },
    {
      key: 'clear-done',
      label: 'Clear Finished Downloads',
      icon: 'checkmark-done-outline',
      onPress: handleClearFinished,
    },
    {
      key: 'clear-all-queue',
      label: 'Clear Entire Queue',
      icon: 'trash-outline',
      destructive: true,
      onPress: handleClearEntireQueue,
    },
  ];

  const jobMenuActions: SheetAction[] = selectedJob
    ? [
        ...(selectedJob.state === 'PAUSED'
          ? [
              {
                key: 'resume',
                label: 'Resume Download',
                icon: 'play-outline' as const,
                onPress: () => resumeDownload(selectedJob.id),
              },
            ]
          : selectedJob.state === 'DOWNLOADING' || selectedJob.state === 'FINALIZING'
          ? [
              {
                key: 'pause',
                label: 'Pause Download',
                icon: 'pause-outline' as const,
                onPress: () => pauseDownload(selectedJob.id),
              },
            ]
          : []),
        ...(selectedJob.finalFileUri
          ? [
              {
                key: 'play',
                label: 'Play Video',
                icon: 'play-circle-outline' as const,
                onPress: () => playVideo(selectedJob.finalFileUri!),
              },
              {
                key: 'share',
                label: 'Share Video',
                icon: 'share-outline' as const,
                onPress: () => shareSavedMedia(selectedJob.finalFileUri!),
              },
            ]
          : []),
        {
          key: 'remove',
          label: 'Remove from Queue',
          icon: 'trash-outline' as const,
          destructive: true,
          onPress: () => handleRemoveJob(selectedJob),
        },
      ]
    : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* 1. TOP HEADER WITH LOGO + "QUEUE" + 3-DOTS OVERFLOW */}
      <TabHeader
        title="Queue"
        onOverflowPress={() => setShowTopMenu(true)}
        overflowLabel="Queue options"
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + layout.section + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. COMPACT 3-COLUMN STATUS SUMMARY CARD */}
        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: colors.surfaceContainer,
              borderColor: colors.surfaceBorder,
            },
          ]}
        >
          <Pressable
            onPress={() => setActiveFilter('active')}
            style={[
              styles.summaryCol,
              activeFilter === 'active' && { backgroundColor: colors.primaryLight },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${activeCount} Active downloads`}
          >
            <Text style={[typography.headlineMedium, { color: colors.primary, fontWeight: '800' }]}>
              {activeCount}
            </Text>
            <Text style={[typography.labelMedium, { color: colors.textSecondary, marginTop: 2 }]}>
              Active
            </Text>
          </Pressable>

          <View style={[styles.summaryDivider, { backgroundColor: colors.outlineVariant }]} />

          <Pressable
            onPress={() => setActiveFilter('paused')}
            style={[
              styles.summaryCol,
              activeFilter === 'paused' && { backgroundColor: colors.primaryLight },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${pausedCount} Paused downloads`}
          >
            <Text style={[typography.headlineMedium, { color: colors.warning, fontWeight: '800' }]}>
              {pausedCount}
            </Text>
            <Text style={[typography.labelMedium, { color: colors.textSecondary, marginTop: 2 }]}>
              Paused
            </Text>
          </Pressable>

          <View style={[styles.summaryDivider, { backgroundColor: colors.outlineVariant }]} />

          <Pressable
            onPress={() => setActiveFilter('done')}
            style={[
              styles.summaryCol,
              activeFilter === 'done' && { backgroundColor: colors.primaryLight },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${doneCount} Done downloads`}
          >
            <Text style={[typography.headlineMedium, { color: colors.success, fontWeight: '800' }]}>
              {doneCount}
            </Text>
            <Text style={[typography.labelMedium, { color: colors.textSecondary, marginTop: 2 }]}>
              Done
            </Text>
          </Pressable>
        </View>

        {/* 3. FILTER PILLS ROW */}
        <View style={styles.filterPillsRow}>
          {(['all', 'active', 'paused', 'done'] as FilterType[]).map((filter) => {
            const isSelected = activeFilter === filter;
            const label = filter === 'all' ? 'All' : filter === 'active' ? 'Active' : filter === 'paused' ? 'Paused' : 'Done';
            return (
              <Pressable
                key={filter}
                onPress={() => setActiveFilter(filter)}
                android_ripple={{ color: colors.ripple }}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surfaceContainer,
                    borderColor: isSelected ? colors.primary : colors.outlineVariant,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Filter by ${label}`}
              >
                <Text
                  style={[
                    typography.labelMedium,
                    {
                      color: isSelected ? colors.onPrimary : colors.textSecondary,
                      fontWeight: isSelected ? '700' : '600',
                    },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 4. DOWNLOAD ITEM CARDS OR CLEAN EMPTY STATE */}
        {filteredJobs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: colors.surfaceContainer, borderColor: colors.surfaceBorder },
              ]}
            >
              <Ionicons name="download-outline" size={36} color={colors.textMuted} />
            </View>
            <Text
              style={[
                typography.titleLarge,
                { color: colors.textPrimary, fontWeight: '700', marginTop: spacing.md },
              ]}
            >
              {jobs.length === 0 ? 'Your queue is empty' : `No ${activeFilter} downloads`}
            </Text>
            <Text
              style={[
                typography.bodyMedium,
                { color: colors.textSecondary, textAlign: 'center', marginTop: 4, paddingHorizontal: spacing.lg },
              ]}
            >
              {jobs.length === 0
                ? 'Videos you start downloading will appear here with live progress.'
                : 'Select another filter above to view your downloads.'}
            </Text>

            {jobs.length === 0 && (
              <Pressable
                onPress={() => router.navigate('/')}
                android_ripple={{ color: colors.ripplePrimary }}
                style={[styles.emptyActionButton, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Go to Home and download a video"
              >
                <Ionicons name="add" size={18} color={colors.onPrimary} />
                <Text style={[typography.labelMedium, { color: colors.onPrimary, fontWeight: '700' }]}>
                  Download a Video
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          filteredJobs.map((job) => (
            <QueueJobCard
              key={job.id}
              item={job}
              onOpenMenu={(j) => {
                setSelectedJob(j);
                setShowJobMenu(true);
              }}
              onRemove={handleRemoveJob}
            />
          ))
        )}
      </ScrollView>

      {/* Top Header Overflow Menu */}
      <BottomSheetMenu
        visible={showTopMenu}
        onClose={() => setShowTopMenu(false)}
        title="Queue Options"
        actions={topMenuActions}
      />

      {/* Download Job Actions Menu */}
      <BottomSheetMenu
        visible={showJobMenu}
        onClose={() => setShowJobMenu(false)}
        title={selectedJob?.media.title || 'Download Options'}
        actions={jobMenuActions}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.sm,
  },
  summaryCard: {
    flexDirection: 'row',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: spacing.sm,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterPill: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
  },
  jobCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  thumbnailWrapper: {
    width: 68,
    height: 92,
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
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    transform: [{ translateX: -12 }, { translateY: -12 }],
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  metaCol: {
    flex: 1,
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  cardHeaderIconButton: {
    padding: spacing.xs,
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  percentText: {
    fontSize: 12,
    minWidth: 36,
    textAlign: 'right',
  },
  pillsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  pillButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
});
