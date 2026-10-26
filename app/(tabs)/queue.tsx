import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
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

export default function QueueScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [jobs, setJobs] = useState<DownloadJob[]>([]);

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

  const hasTerminalJobs = jobs.some(
    (j) => j.state === 'COMPLETED' || j.state === 'FAILED' || j.state === 'CANCELLED'
  );

  const renderJobItem = ({ item }: { item: DownloadJob }) => {
    const isDownloading = item.state === 'DOWNLOADING';
    const isPaused = item.state === 'PAUSED';
    const isCompleted = item.state === 'COMPLETED';
    const isFailed = item.state === 'FAILED';
    const isFinalizing = item.state === 'FINALIZING';

    const progressFraction =
      item.totalBytes && item.totalBytes > 0
        ? Math.min(item.bytesDownloaded / item.totalBytes, 1)
        : undefined;

    return (
      <Card
        variant={isDownloading ? 'elevated' : 'outlined'}
        style={styles.jobCard}
      >
        {/* Header Row: Title and Status Badge */}
        <View style={styles.cardHeader}>
          <View style={styles.titleArea}>
            <Text style={[typography.titleMedium, { color: colors.textPrimary }]} numberOfLines={2}>
              {item.media.title || 'TikTok Video'}
            </Text>
            <View style={styles.creatorRow}>
              <Ionicons name="person-outline" size={13} color={colors.textMuted} />
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: 4 }]} numberOfLines={1}>
                {item.media.author || 'Creator'}
              </Text>
            </View>
          </View>
          <Badge label={item.state} state={item.state} />
        </View>

        {/* Active Progress Section (Downloading / Paused / Finalizing) */}
        {(isDownloading || isPaused || isFinalizing) && (
          <View style={styles.progressSection}>
            <ProgressBar
              progress={progressFraction}
              showPercentage={item.totalBytes !== undefined}
            />
            <View style={styles.bytesRow}>
              <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>
                {formatBytes(item.bytesDownloaded)}
                {item.totalBytes ? ` / ${formatBytes(item.totalBytes)}` : ' (Streaming)'}
              </Text>
              <Text style={[typography.bodySmall, { color: colors.primary }]}>
                {item.statusMessage}
              </Text>
            </View>
          </View>
        )}

        {/* Completed State Information */}
        {isCompleted && (
          <View
            style={[
              styles.completedInfoBox,
              {
                backgroundColor: colors.successLight,
                borderColor: colors.success,
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <View style={{ flex: 1, marginLeft: spacing.xs }}>
              <Text style={[typography.labelMedium, { color: colors.success }]}>
                {item.statusMessage || 'Download Complete'}
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 1 }]}>
                {formatBytes(item.bytesDownloaded)} • Saved to device
              </Text>
            </View>
          </View>
        )}

        {/* Error Explanation if Failed */}
        {isFailed && item.errorMessage && (
          <View
            style={[
              styles.errorBox,
              {
                backgroundColor: colors.dangerLight,
                borderColor: colors.danger,
              },
            ]}
            accessible={true}
            accessibilityRole="alert"
          >
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={[typography.bodySmall, { color: colors.danger, marginLeft: spacing.xs, flex: 1 }]}>
              {item.errorMessage}
            </Text>
          </View>
        )}

        {/* Action Controls */}
        <View style={styles.cardActions}>
          {isDownloading && (
            <>
              <Button
                title="Pause"
                icon={<Ionicons name="pause" size={16} color={colors.textPrimary} />}
                onPress={() => pauseDownload(item.id)}
                variant="secondary"
                style={styles.actionBtn}
                accessibilityLabel="Pause downloading video"
              />
              <Button
                title="Cancel"
                icon={<Ionicons name="close" size={16} color={colors.danger} />}
                onPress={() => handleCancel(item)}
                variant="ghost"
                textStyle={{ color: colors.danger }}
                style={styles.actionBtn}
                accessibilityLabel="Cancel downloading video"
              />
            </>
          )}

          {isPaused && (
            <>
              <Button
                title="Resume"
                icon={<Ionicons name="play" size={16} color="#FFFFFF" />}
                onPress={() => resumeDownload(item.id)}
                variant="primary"
                style={styles.actionBtn}
                accessibilityLabel="Resume paused download"
              />
              <Button
                title="Cancel"
                icon={<Ionicons name="close" size={16} color={colors.danger} />}
                onPress={() => handleCancel(item)}
                variant="ghost"
                textStyle={{ color: colors.danger }}
                style={styles.actionBtn}
                accessibilityLabel="Cancel paused download"
              />
            </>
          )}

          {isFailed && (
            <Button
              title="Retry Download"
              icon={<Ionicons name="refresh" size={16} color="#FFFFFF" />}
              onPress={() => retryDownload(item.id)}
              variant="primary"
              style={styles.fullActionBtn}
              accessibilityLabel="Retry failed download"
            />
          )}

          {isCompleted && item.finalFileUri && (
            <View style={{ width: '100%', gap: spacing.xs }}>
              {item.statusMessage === 'Saved to App Storage' && (
                <Text style={[typography.bodySmall, { color: colors.textMuted, textAlign: 'center', marginBottom: 2 }]}>
                  In Expo Go, tap below to send this video to your Samsung Gallery or Photos:
                </Text>
              )}
              <Button
                title="Send to Gallery / Share"
                icon={<Ionicons name="share-social-outline" size={18} color="#FFFFFF" />}
                onPress={() => shareSavedMedia(item.finalFileUri!)}
                variant="primary"
                style={styles.fullActionBtn}
                accessibilityLabel="Send downloaded video to gallery or share"
              />
            </View>
          )}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScreenHeader
        title="Download Queue"
        subtitle={`${jobs.length} ${jobs.length === 1 ? 'task' : 'tasks'} in queue`}
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

      {jobs.length === 0 ? (
        <EmptyState
          iconName="file-tray-outline"
          title="Queue is Empty"
          description="Downloads you start from the Home screen will appear here with real-time streaming progress, pause/resume, and controls."
          actionTitle="Start a Download"
          actionIcon="arrow-down-circle"
          onAction={() => router.push('/(tabs)')}
        />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={renderJobItem}
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
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  jobCard: {
    marginBottom: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  titleArea: {
    flex: 1,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  progressSection: {
    marginTop: spacing.md,
  },
  bytesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs + 2,
  },
  completedInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.md,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.md,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
    minHeight: spacing.touchTargetMin,
  },
  fullActionBtn: {
    flex: 1,
    minHeight: spacing.touchTargetMin,
  },
});
