import { memo, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
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
import {
  shareSavedMedia,
  playVideo,
} from '../../src/services/mediaManager';
import { useQueueStructure, useJob } from '../../src/hooks/useQueue';
import { jobProgressFraction } from '../../src/utils/jobDisplay';
import { formatBytes, formatDuration, formatSpeed } from '../../src/utils/formatters';
import { DownloadJob } from '../../src/types';
import { BottomSheetMenu, SheetAction } from '../../src/components/BottomSheetMenu';
import { TabHeader } from '../../src/components/TabHeader';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
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
  const percent = isDone ? 100 : Math.min(99, Math.max(0, Math.round((knownFraction ?? 0) * 100)));
  const totalBytes = job.totalBytes ?? job.media.estimatedSizeBytes;
  const qualityDisplay = job.media.quality === 'audio' ? 'Audio (MP3)' : (job.media.quality ? `${job.media.quality}` : '1080p');
  const speedText =
    isActive && job.speedBytesPerSecond && job.speedBytesPerSecond > 0
      ? ` • ${formatSpeed(job.speedBytesPerSecond)}`
      : '';
  const sizeText = totalBytes
    ? (isActive
        ? `${formatBytes(job.bytesDownloaded || 0)} / ${formatBytes(totalBytes)} • ${qualityDisplay}${speedText}`
        : `${formatBytes(job.bytesDownloaded || totalBytes)} • ${qualityDisplay}${speedText}`)
    : `${formatBytes(job.bytesDownloaded || 0)} • ${qualityDisplay}${speedText}`;

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
    if (isDone && job.finalFileUri) {
      shareSavedMedia(job.finalFileUri);
    } else {
      onRemove(job);
    }
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
            {job.media.title || (job.media.platform === 'youtube' ? 'YouTube Video' : job.media.platform === 'instagram' ? 'Instagram Video' : job.media.platform === 'facebook' ? 'Facebook Video' : 'TikTok Video')}
          </Text>
          <Text
            style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}
            numberOfLines={1}
          >
            @{job.media.authorUsername || job.media.author || 'creator'}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
            {sizeText}
            {isDone && (
              <Text
                onPress={
                  job.finalFileUri
                    ? () => playVideo(job.finalFileUri!)
                    : undefined
                }
                style={{
                  color: job.statusMessage === 'Saved to Gallery' ? colors.success : colors.primary,
                  fontWeight: '600',
                }}
              >
                {` • ${job.statusMessage || 'Completed'}`}
              </Text>
            )}
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
          <View style={styles.progressMeta}>
            {isActive && job.speedBytesPerSecond && job.speedBytesPerSecond > 0 ? (
              <View style={styles.speedBadge}>
                <Ionicons name="speedometer-outline" size={12} color={colors.primary} />
                <Text style={[typography.micro, { color: colors.primary, fontWeight: '700', marginLeft: 3 }]}>
                  {formatSpeed(job.speedBytesPerSecond)}
                </Text>
              </View>
            ) : null}
            <Text style={[typography.numeric, styles.percentText, { color: colors.textSecondary }]}>
              {isDone ? '100%' : `${percent}%`}
            </Text>
          </View>
        </View>
      )}

      {/* Bottom Actions Row: Contextual Actions */}
      <View style={styles.pillsRow}>
        <Pressable
          onPress={handlePrimaryPill}
          android_ripple={{ color: colors.ripple }}
          style={[
            styles.pillButton,
            {
              backgroundColor: isPaused
                ? colors.primaryLight
                : isDone
                ? colors.primary
                : colors.surfaceContainerHigh,
              borderColor: isPaused
                ? colors.primaryBorder
                : isDone
                ? colors.primary
                : colors.outlineVariant,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            isPaused
              ? 'Resume download'
              : isActive
              ? 'Pause download'
              : isDone
              ? 'Play video'
              : 'Retry download'
          }
        >
          <Ionicons
            name={
              isPaused
                ? 'play'
                : isActive
                ? 'pause'
                : isDone
                ? 'play'
                : 'reload'
            }
            size={15}
            color={isPaused ? colors.primary : isDone ? colors.onPrimary : colors.textPrimary}
          />
          <Text
            style={[
              typography.labelMedium,
              {
                color: isPaused
                  ? colors.primary
                  : isDone
                  ? colors.onPrimary
                  : colors.textPrimary,
                marginLeft: 6,
                fontWeight: '700',
              },
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
              backgroundColor: colors.surfaceContainerHigh,
              borderColor: colors.outlineVariant,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            isDone ? 'Share video' : isFailed ? 'Remove from queue' : 'Cancel download'
          }
        >
          <Ionicons
            name={
              isDone
                ? 'share-social-outline'
                : isFailed
                ? 'trash-outline'
                : 'close-outline'
            }
            size={16}
            color={isDone ? colors.textPrimary : colors.danger}
          />
          <Text
            style={[
              typography.labelMedium,
              {
                color: isDone ? colors.textPrimary : colors.danger,
                marginLeft: 6,
                fontWeight: '600',
              },
            ]}
          >
            {isDone ? 'Share' : isFailed ? 'Remove' : 'Cancel'}
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
  const [jobToCancel, setJobToCancel] = useState<DownloadJob | null>(null);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);

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
    if (
      job.state === 'DOWNLOADING' ||
      job.state === 'FINALIZING' ||
      job.state === 'QUEUED' ||
      job.state === 'PAUSED'
    ) {
      setJobToCancel(job);
    } else {
      // Completed, failed, or cancelled: remove directly from queue
      removeDownloadJob(job.id);
    }
  }, []);

  const handleClearEntireQueue = useCallback(() => {
    setShowClearAllDialog(true);
  }, []);

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
        {/* 2. COMPACT SEGMENTED FILTER BAR WITH COUNTS */}
        <View style={styles.filterPillsRow}>
          {[
            { key: 'all' as FilterType, label: 'All', count: jobs.length },
            { key: 'active' as FilterType, label: 'Active', count: activeCount },
            { key: 'paused' as FilterType, label: 'Paused', count: pausedCount },
            { key: 'done' as FilterType, label: 'Done', count: doneCount },
          ].map((item) => {
            const isSelected = activeFilter === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setActiveFilter(item.key)}
                android_ripple={{ color: colors.ripple }}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surfaceContainer,
                    borderColor: isSelected ? colors.primary : colors.surfaceBorder,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Filter by ${item.label}, ${item.count} items`}
              >
                <Text
                  style={[
                    typography.labelMedium,
                    {
                      color: isSelected ? colors.onPrimary : colors.textPrimary,
                      fontWeight: isSelected ? '700' : '600',
                    },
                  ]}
                >
                  {item.label}
                </Text>
                {item.count > 0 && (
                  <View
                    style={[
                      styles.countBadge,
                      {
                        backgroundColor: isSelected ? colors.onPrimary : colors.surfaceContainerHigh,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.micro,
                        {
                          color: isSelected ? colors.primary : colors.textSecondary,
                          fontWeight: '700',
                          fontSize: 10,
                        },
                      ]}
                    >
                      {item.count}
                    </Text>
                  </View>
                )}
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
              <Ionicons name="download-outline" size={26} color={colors.textMuted} />
            </View>
            <Text
              style={[
                typography.titleLarge,
                { color: colors.textPrimary, fontWeight: '700', marginTop: spacing.md, textAlign: 'center' },
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
                : 'Select another filter above or tap below to view your downloads.'}
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

            {jobs.length > 0 && filteredJobs.length === 0 && (
              <Pressable
                onPress={() => setActiveFilter('all')}
                android_ripple={{ color: colors.ripplePrimary }}
                style={[styles.emptyActionButton, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel="View all downloads"
              >
                <Ionicons name="list-outline" size={18} color={colors.onPrimary} />
                <Text style={[typography.labelMedium, { color: colors.onPrimary, fontWeight: '700', marginLeft: 4 }]}>
                  View All Downloads ({jobs.length})
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

      {/* Theme-Aware Cancel Job Dialog */}
      <ConfirmDialog
        visible={!!jobToCancel}
        title="Cancel Download?"
        message={`Remove "${jobToCancel?.media.title || 'this video'}" from the download queue?`}
        icon="close-circle-outline"
        confirmDestructive
        confirmText="Remove"
        cancelText="Keep"
        onCancel={() => setJobToCancel(null)}
        onConfirm={() => {
          if (jobToCancel) {
            removeDownloadJob(jobToCancel.id);
            setJobToCancel(null);
          }
        }}
      />

      {/* Theme-Aware Clear Entire Queue Dialog */}
      <ConfirmDialog
        visible={showClearAllDialog}
        title="Clear Entire Queue?"
        message="Cancel and remove all downloads from the queue?"
        icon="trash-outline"
        confirmDestructive
        confirmText="Clear All"
        cancelText="Cancel"
        onCancel={() => setShowClearAllDialog(false)}
        onConfirm={async () => {
          for (const j of jobs) {
            await removeDownloadJob(j.id);
          }
          setShowClearAllDialog(false);
        }}
      />

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
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  filterPill: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    gap: 4,
  },
  countBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
  progressMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  speedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
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
    paddingVertical: spacing.xl,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    minHeight: 44,
  },
});
