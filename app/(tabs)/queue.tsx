import { useState, useEffect, memo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius, elevation } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { Button } from '../../src/components/Button';
import { ProgressBar } from '../../src/components/ProgressBar';
import { EmptyState } from '../../src/components/EmptyState';
import {
  subscribeQueue,
  clearTerminalJobs,
} from '../../src/storage/queueStore';
import {
  pauseDownload,
  resumeDownload,
  cancelDownload,
  retryDownload,
} from '../../src/services/downloadEngine';
import { shareSavedMedia } from '../../src/services/mediaManager';
import { formatBytes } from '../../src/utils/formatters';
import { DownloadJob } from '../../src/types';

type QueueFilter = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'FAILED';

// Memoized Active Download Row
const ActiveJobRow = memo(({
  item,
  onCancel,
}: {
  item: DownloadJob;
  onCancel: (job: DownloadJob) => void;
}) => {
  const { colors } = useTheme();
  const isPaused = item.state === 'PAUSED';
  const progressFraction =
    item.totalBytes && item.totalBytes > 0
      ? Math.min(item.bytesDownloaded / item.totalBytes, 1)
      : undefined;

  return (
    <View
      style={[
        styles.activeRowCard,
        {
          backgroundColor: colors.surfaceContainerLow || colors.surface,
          borderColor: isPaused ? colors.warning : colors.primary,
        },
        Platform.OS === 'android' ? elevation.level1 : {},
      ]}
    >
      <View style={styles.activeRowHeader}>
        <View style={styles.activeInfoCol}>
          <View style={styles.activeStatusTag}>
            <View
              style={[
                styles.pulseDot,
                { backgroundColor: isPaused ? colors.warning : colors.primary },
              ]}
            />
            <Text
              style={[
                typography.labelMedium,
                { color: isPaused ? colors.warning : colors.primary, fontWeight: '700' },
              ]}
            >
              {isPaused ? 'PAUSED' : item.state === 'FINALIZING' ? 'SAVING...' : 'DOWNLOADING'}
            </Text>
          </View>
          <Text style={[typography.titleSmall, { color: colors.textPrimary, marginTop: 2 }]} numberOfLines={1}>
            {item.media.title || 'TikTok Video'}
          </Text>
          <Text style={[typography.micro, { color: colors.textSecondary }]}>
            {formatBytes(item.bytesDownloaded)}
            {item.totalBytes ? ` / ${formatBytes(item.totalBytes)}` : ' (Streaming)'}
          </Text>
        </View>

        {/* Circular Action Buttons */}
        <View style={styles.activeActions}>
          {isPaused ? (
            <Pressable
              onPress={() => resumeDownload(item.id)}
              android_ripple={{ color: colors.ripple, borderless: true, radius: 22 }}
              style={[styles.actionCircleBtn, { backgroundColor: colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Resume download"
            >
              <Ionicons name="play" size={16} color="#FFFFFF" />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => pauseDownload(item.id)}
              android_ripple={{ color: colors.ripple, borderless: true, radius: 22 }}
              style={[
                styles.actionCircleBtn,
                { backgroundColor: colors.surfaceContainerHigh || colors.surfaceElevated },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Pause download"
            >
              <Ionicons name="pause" size={16} color={colors.textPrimary} />
            </Pressable>
          )}

          <Pressable
            onPress={() => onCancel(item)}
            android_ripple={{ color: colors.ripple, borderless: true, radius: 22 }}
            style={[styles.actionCircleBtn, { backgroundColor: colors.dangerLight }]}
            accessibilityRole="button"
            accessibilityLabel="Cancel download"
          >
            <Ionicons name="close" size={16} color={colors.danger} />
          </Pressable>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={{ marginTop: 8 }}>
        <ProgressBar
          progress={progressFraction}
          showPercentage={item.totalBytes !== undefined}
        />
      </View>
    </View>
  );
});
ActiveJobRow.displayName = 'ActiveJobRow';

// Memoized Completed Download Row
const CompletedJobRow = memo(({ item }: { item: DownloadJob }) => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.completedRow,
        {
          backgroundColor: colors.surfaceContainerLowest || colors.surface,
          borderColor: colors.outlineVariant || colors.surfaceBorder,
        },
      ]}
    >
      <View style={[styles.completedIconWrapper, { backgroundColor: colors.successLight }]}>
        <Ionicons name="checkmark" size={18} color={colors.success} />
      </View>

      <View style={styles.completedInfoCol}>
        <Text style={[typography.titleSmall, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.media.title || 'Saved Video'}
        </Text>
        <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
          {formatBytes(item.bytesDownloaded)} • {item.media.author || 'Downloaded'}
        </Text>
      </View>

      {item.finalFileUri && (
        <Pressable
          onPress={() => shareSavedMedia(item.finalFileUri!)}
          android_ripple={{ color: colors.ripple, borderless: false }}
          style={[
            styles.sharePillBtn,
            { backgroundColor: colors.primaryContainer || colors.primaryLight },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Share or send ${item.media.title} to gallery`}
        >
          <Ionicons name="share-social-outline" size={14} color={colors.primary} />
          <Text style={[typography.labelMedium, { color: colors.primary, marginLeft: 4 }]}>
            Share
          </Text>
        </Pressable>
      )}
    </View>
  );
});
CompletedJobRow.displayName = 'CompletedJobRow';

// Memoized Failed Download Row
const FailedJobRow = memo(({ item }: { item: DownloadJob }) => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.failedRow,
        {
          backgroundColor: colors.dangerLight,
          borderColor: colors.danger,
        },
      ]}
    >
      <Ionicons name="alert-circle" size={20} color={colors.danger} style={{ marginTop: 1 }} />
      <View style={styles.failedInfoCol}>
        <Text style={[typography.titleSmall, { color: colors.danger }]} numberOfLines={1}>
          {item.media.title || 'Download Failed'}
        </Text>
        <Text style={[typography.micro, { color: colors.danger, marginTop: 1 }]}>
          {item.errorMessage || 'Network or media server error.'}
        </Text>
      </View>

      <Button
        title="Retry"
        icon={<Ionicons name="refresh" size={13} color="#FFFFFF" />}
        onPress={() => retryDownload(item.id)}
        variant="danger"
        size="sm"
        style={styles.retryBtn}
        accessibilityLabel={`Retry download for ${item.media.title}`}
      />
    </View>
  );
});
FailedJobRow.displayName = 'FailedJobRow';

export default function QueueScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [activeFilter, setActiveFilter] = useState<QueueFilter>('ALL');

  useEffect(() => {
    return subscribeQueue((updated) => setJobs(updated));
  }, []);

  const handleCancel = useCallback((job: DownloadJob) => {
    Alert.alert(
      'Cancel Download',
      'Are you sure you want to cancel this download? Any partial temporary stream files will be safely cleared.',
      [
        { text: 'Keep Downloading', style: 'cancel' },
        {
          text: 'Cancel Download',
          style: 'destructive',
          onPress: () => cancelDownload(job.id),
        },
      ]
    );
  }, []);

  const activeCount = jobs.filter(
    (j) => j.state === 'DOWNLOADING' || j.state === 'FINALIZING' || j.state === 'PAUSED' || j.state === 'QUEUED'
  ).length;
  const completedCount = jobs.filter((j) => j.state === 'COMPLETED').length;
  const failedCount = jobs.filter((j) => j.state === 'FAILED' || j.state === 'CANCELLED').length;

  const filteredJobs = jobs.filter((j) => {
    switch (activeFilter) {
      case 'ACTIVE':
        return j.state === 'DOWNLOADING' || j.state === 'FINALIZING' || j.state === 'PAUSED' || j.state === 'QUEUED';
      case 'COMPLETED':
        return j.state === 'COMPLETED';
      case 'FAILED':
        return j.state === 'FAILED' || j.state === 'CANCELLED';
      case 'ALL':
      default:
        return true;
    }
  });

  const hasTerminalJobs = jobs.some(
    (j) => j.state === 'COMPLETED' || j.state === 'FAILED' || j.state === 'CANCELLED'
  );

  const renderQueueItem = useCallback(
    ({ item }: { item: DownloadJob }) => {
      if (
        item.state === 'DOWNLOADING' ||
        item.state === 'PAUSED' ||
        item.state === 'FINALIZING' ||
        item.state === 'QUEUED'
      ) {
        return <ActiveJobRow item={item} onCancel={handleCancel} />;
      }
      if (item.state === 'COMPLETED') {
        return <CompletedJobRow item={item} />;
      }
      return <FailedJobRow item={item} />;
    },
    [handleCancel]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Download Manager Header */}
      <View style={styles.headerToolbar}>
        <View>
          <Text style={[typography.headlineMedium, { color: colors.textPrimary, letterSpacing: -0.3 }]}>
            Downloads
          </Text>
          <Text style={[typography.micro, { color: colors.textMuted }]}>
            {activeCount > 0 ? `${activeCount} active stream${activeCount === 1 ? '' : 's'}` : 'All downloads idle'}
            {completedCount > 0 ? ` • ${completedCount} completed` : ''}
          </Text>
        </View>

        {hasTerminalJobs && (
          <Pressable
            onPress={clearTerminalJobs}
            android_ripple={{ color: colors.ripple, borderless: false }}
            style={[styles.clearBtn, { backgroundColor: colors.surfaceContainerLow || colors.surfaceElevated }]}
            accessibilityRole="button"
            accessibilityLabel="Clear finished downloads"
          >
            <Ionicons name="trash-outline" size={14} color={colors.textSecondary} />
            <Text style={[typography.labelMedium, { color: colors.textSecondary, marginLeft: 4 }]}>
              Clear Finished
            </Text>
          </Pressable>
        )}
      </View>

      {/* Segmented Filter Pills */}
      {jobs.length > 0 && (
        <View style={styles.filterBar}>
          <Pressable
            onPress={() => setActiveFilter('ALL')}
            style={[
              styles.filterPill,
              activeFilter === 'ALL' && [
                styles.activeFilterPill,
                { backgroundColor: colors.primaryContainer || colors.primaryLight, borderColor: colors.primary },
              ],
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Show all downloads, count ${jobs.length}`}
          >
            <Text
              style={[
                typography.labelMedium,
                { color: activeFilter === 'ALL' ? colors.primary : colors.textMuted },
              ]}
            >
              All ({jobs.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveFilter('ACTIVE')}
            style={[
              styles.filterPill,
              activeFilter === 'ACTIVE' && [
                styles.activeFilterPill,
                { backgroundColor: colors.primaryContainer || colors.primaryLight, borderColor: colors.primary },
              ],
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Show active downloads, count ${activeCount}`}
          >
            <Text
              style={[
                typography.labelMedium,
                { color: activeFilter === 'ACTIVE' ? colors.primary : colors.textMuted },
              ]}
            >
              Active ({activeCount})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveFilter('COMPLETED')}
            style={[
              styles.filterPill,
              activeFilter === 'COMPLETED' && [
                styles.activeFilterPill,
                { backgroundColor: colors.primaryContainer || colors.primaryLight, borderColor: colors.primary },
              ],
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Show completed downloads, count ${completedCount}`}
          >
            <Text
              style={[
                typography.labelMedium,
                { color: activeFilter === 'COMPLETED' ? colors.primary : colors.textMuted },
              ]}
            >
              Done ({completedCount})
            </Text>
          </Pressable>

          {failedCount > 0 && (
            <Pressable
              onPress={() => setActiveFilter('FAILED')}
              style={[
                styles.filterPill,
                activeFilter === 'FAILED' && [
                  styles.activeFilterPill,
                  { backgroundColor: colors.dangerLight, borderColor: colors.danger },
                ],
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Show failed downloads, count ${failedCount}`}
            >
              <Text
                style={[
                  typography.labelMedium,
                  { color: activeFilter === 'FAILED' ? colors.danger : colors.textMuted },
                ]}
              >
                Failed ({failedCount})
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Virtualized Queue List */}
      <FlatList
        data={filteredJobs}
        keyExtractor={(item) => item.id}
        renderItem={renderQueueItem}
        contentContainerStyle={styles.listContent}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={
          <EmptyState
            iconName="file-tray-outline"
            title={
              activeFilter === 'ALL'
                ? 'Queue is empty'
                : `No ${activeFilter.toLowerCase()} downloads`
            }
            description={
              activeFilter === 'ALL'
                ? 'When you paste a link and confirm download, tasks appear here.'
                : `There are currently no items matching the ${activeFilter.toLowerCase()} filter.`
            }
            actionTitle={activeFilter === 'ALL' ? 'Download a Video' : undefined}
            onAction={activeFilter === 'ALL' ? () => router.push('/') : undefined}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerToolbar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeFilterPill: {
    borderWidth: 1,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
  },
  activeRowCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    marginBottom: spacing.sm,
  },
  activeRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeInfoCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  activeStatusTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  activeActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.xs + 2,
  },
  completedIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  completedInfoCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  sharePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 32,
    borderRadius: borderRadius.full,
  },
  failedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.xs + 2,
  },
  failedInfoCol: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  retryBtn: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: borderRadius.sm,
  },
});
