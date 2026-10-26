import { useState, useEffect } from 'react';
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
import { ScreenHeader } from '../../src/components/ScreenHeader';
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

export default function QueueScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [activeFilter, setActiveFilter] = useState<QueueFilter>('ALL');

  useEffect(() => {
    return subscribeQueue((updated) => setJobs(updated));
  }, []);

  const handleCancel = (job: DownloadJob) => {
    Alert.alert(
      'Cancel Download',
      'Are you sure you want to cancel this download? Any partial temporary data will be safely removed.',
      [
        { text: 'Keep Downloading', style: 'cancel' },
        {
          text: 'Cancel Download',
          style: 'destructive',
          onPress: () => cancelDownload(job.id),
        },
      ]
    );
  };

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

  const renderActiveJob = (item: DownloadJob) => {
    const isPaused = item.state === 'PAUSED';
    const progressFraction =
      item.totalBytes && item.totalBytes > 0
        ? Math.min(item.bytesDownloaded / item.totalBytes, 1)
        : undefined;

    return (
      <View
        key={item.id}
        style={[
          styles.activeStreamCard,
          {
            backgroundColor: colors.surfaceContainerLowest || colors.surface,
            borderColor: isPaused ? colors.warning : colors.primary,
          },
          Platform.OS === 'android' ? elevation.level2 : {},
        ]}
      >
        <View style={styles.activeCardHeader}>
          <View style={styles.activeTitleCol}>
            <View style={styles.statusPillRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isPaused ? colors.warning : colors.primary },
                ]}
              />
              <Text
                style={[
                  typography.labelMedium,
                  { color: isPaused ? colors.warning : colors.primary },
                ]}
              >
                {isPaused ? 'PAUSED' : item.state === 'FINALIZING' ? 'FINALIZING' : 'DOWNLOADING'}
              </Text>
            </View>
            <Text style={[typography.titleMedium, { color: colors.textPrimary, marginTop: 4 }]} numberOfLines={2}>
              {item.media.title || 'TikTok Video'}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
              {item.media.author || 'Creator'}
            </Text>
          </View>

          {/* Quick Circular Action Buttons */}
          <View style={styles.activeActionControls}>
            {isPaused ? (
              <Pressable
                onPress={() => resumeDownload(item.id)}
                android_ripple={{ color: colors.ripple, borderless: true, radius: 24 }}
                style={[styles.circleActionBtn, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Resume download"
              >
                <Ionicons name="play" size={18} color="#FFFFFF" />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => pauseDownload(item.id)}
                android_ripple={{ color: colors.ripple, borderless: true, radius: 24 }}
                style={[
                  styles.circleActionBtn,
                  { backgroundColor: colors.surfaceContainerHigh || colors.surfaceElevated },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Pause download"
              >
                <Ionicons name="pause" size={18} color={colors.textPrimary} />
              </Pressable>
            )}

            <Pressable
              onPress={() => handleCancel(item)}
              android_ripple={{ color: colors.ripple, borderless: true, radius: 24 }}
              style={[
                styles.circleActionBtn,
                { backgroundColor: colors.dangerLight },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Cancel download"
            >
              <Ionicons name="close" size={18} color={colors.danger} />
            </Pressable>
          </View>
        </View>

        {/* Live Progress Bar */}
        <View style={styles.activeProgressBox}>
          <ProgressBar
            progress={progressFraction}
            showPercentage={item.totalBytes !== undefined}
          />
          <View style={styles.activeBytesRow}>
            <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>
              {formatBytes(item.bytesDownloaded)}
              {item.totalBytes ? ` / ${formatBytes(item.totalBytes)}` : ' (Streaming)'}
            </Text>
            <Text style={[typography.labelMedium, { color: isPaused ? colors.warning : colors.primary }]}>
              {item.statusMessage}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderCompletedJob = (item: DownloadJob) => {
    return (
      <View
        key={item.id}
        style={[
          styles.completedRow,
          {
            backgroundColor: colors.surfaceContainerLowest || colors.surface,
            borderColor: colors.outlineVariant || colors.surfaceBorder,
          },
        ]}
      >
        <View style={[styles.completedIconWrapper, { backgroundColor: colors.successLight }]}>
          <Ionicons name="checkmark" size={20} color={colors.success} />
        </View>

        <View style={styles.completedTextCol}>
          <Text style={[typography.titleSmall, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.media.title || 'TikTok Video'}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 1 }]}>
            {formatBytes(item.bytesDownloaded)} • {item.media.author || 'Saved to Storage'}
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
            <Ionicons name="share-social-outline" size={15} color={colors.primary} />
            <Text style={[typography.labelMedium, { color: colors.primary, marginLeft: 4 }]}>
              Share
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  const renderFailedJob = (item: DownloadJob) => {
    return (
      <View
        key={item.id}
        style={[
          styles.failedRow,
          {
            backgroundColor: colors.dangerLight,
            borderColor: colors.danger,
          },
        ]}
      >
        <Ionicons name="alert-circle" size={22} color={colors.danger} style={{ marginTop: 2 }} />
        <View style={styles.failedTextCol}>
          <Text style={[typography.titleSmall, { color: colors.danger }]} numberOfLines={1}>
            {item.media.title || 'Download Failed'}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.danger, marginTop: 2 }]}>
            {item.errorMessage || 'Server or network error.'}
          </Text>
        </View>

        <Button
          title="Retry"
          icon={<Ionicons name="refresh" size={14} color="#FFFFFF" />}
          onPress={() => retryDownload(item.id)}
          variant="danger"
          size="sm"
          style={styles.retryBtn}
          accessibilityLabel={`Retry download for ${item.media.title}`}
        />
      </View>
    );
  };

  const renderItem = ({ item }: { item: DownloadJob }) => {
    if (
      item.state === 'DOWNLOADING' ||
      item.state === 'PAUSED' ||
      item.state === 'FINALIZING' ||
      item.state === 'QUEUED'
    ) {
      return renderActiveJob(item);
    }
    if (item.state === 'COMPLETED') {
      return renderCompletedJob(item);
    }
    return renderFailedJob(item);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScreenHeader
        title="Download Queue"
        subtitle={`${jobs.length} total ${jobs.length === 1 ? 'task' : 'tasks'}`}
        rightAction={
          hasTerminalJobs
            ? {
                label: 'Clear Finished',
                icon: 'trash-outline',
                onPress: clearTerminalJobs,
                accessibilityLabel: 'Clear all finished download tasks from queue',
              }
            : undefined
        }
      />

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
                { color: activeFilter === 'ALL' ? colors.primary : colors.textSecondary },
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
                { color: activeFilter === 'ACTIVE' ? colors.primary : colors.textSecondary },
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
                { color: activeFilter === 'COMPLETED' ? colors.primary : colors.textSecondary },
              ]}
            >
              Completed ({completedCount})
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
                  { color: activeFilter === 'FAILED' ? colors.danger : colors.textSecondary },
                ]}
              >
                Failed ({failedCount})
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {jobs.length === 0 ? (
        <EmptyState
          iconName="file-tray-outline"
          title="Queue is Empty"
          description="Downloads you start from the Home screen appear here with real-time streaming progress, pause/resume, and controls."
          actionTitle="Download a Video"
          actionIcon="arrow-down-circle"
          onAction={() => router.push('/(tabs)')}
        />
      ) : filteredJobs.length === 0 ? (
        <View style={styles.filteredEmpty}>
          <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>No items match this filter</Text>
          <Button
            title="Show All Downloads"
            onPress={() => setActiveFilter('ALL')}
            variant="secondary"
            size="sm"
            style={{ marginTop: spacing.md }}
          />
        </View>
      ) : (
        <FlatList
          data={filteredJobs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeFilterPill: {
    borderWidth: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  activeStreamCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    padding: spacing.lg,
    marginBottom: spacing.xs,
  },
  activeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  activeTitleCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  statusPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  activeActionControls: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  circleActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeProgressBox: {
    marginTop: spacing.md,
  },
  activeBytesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs + 2,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  completedIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  completedTextCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  sharePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    minHeight: 38,
  },
  failedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  failedTextCol: {
    flex: 1,
  },
  retryBtn: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
  },
  filteredEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
});
