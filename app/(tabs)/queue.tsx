import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
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

export default function QueueScreen() {
  const { colors } = useTheme();
  const [jobs, setJobs] = useState<DownloadJob[]>([]);

  useEffect(() => {
    return subscribeQueue((updated) => setJobs(updated));
  }, []);

  const handleCancel = (job: DownloadJob) => {
    Alert.alert(
      'Cancel Download',
      'Are you sure you want to cancel this download? Any partial data will be safely removed.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancel Download',
          style: 'destructive',
          onPress: () => cancelDownload(job.id),
        },
      ]
    );
  };

  const renderJobItem = ({ item }: { item: DownloadJob }) => {
    const isDownloading = item.state === 'DOWNLOADING';
    const isPaused = item.state === 'PAUSED';
    const isCompleted = item.state === 'COMPLETED';
    const isFailed = item.state === 'FAILED';

    const progressFraction =
      item.totalBytes && item.totalBytes > 0
        ? Math.min(item.bytesDownloaded / item.totalBytes, 1)
        : undefined;

    return (
      <Card style={styles.jobCard}>
        <View style={styles.cardHeader}>
          <View style={styles.titleArea}>
            <Text style={[typography.h3, { color: colors.textPrimary }]} numberOfLines={2}>
              {item.media.title}
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              {item.media.author}
            </Text>
          </View>
          <Badge label={item.state} state={item.state} />
        </View>

        {/* Progress & Status */}
        <View style={styles.progressSection}>
          <ProgressBar progress={progressFraction} showPercentage={item.totalBytes !== undefined} />
          <View style={styles.bytesRow}>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              {formatBytes(item.bytesDownloaded)}
              {item.totalBytes ? ` / ${formatBytes(item.totalBytes)}` : ' (Streaming)'}
            </Text>
            <Text style={[typography.captionMedium, { color: colors.textMuted }]}>
              {item.statusMessage}
            </Text>
          </View>
        </View>

        {/* Error explanation if present */}
        {item.errorMessage && (
          <View style={[styles.errorBox, { backgroundColor: colors.dangerLight }]}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={[typography.caption, { color: colors.danger, marginLeft: spacing.xs, flex: 1 }]}>
              {item.errorMessage}
            </Text>
          </View>
        )}

        {/* Control Actions */}
        <View style={styles.cardActions}>
          {isDownloading && (
            <>
              <Button
                title="Pause"
                icon={<Ionicons name="pause" size={16} color={colors.textPrimary} />}
                onPress={() => pauseDownload(item.id)}
                variant="secondary"
                style={styles.actionBtn}
              />
              <Button
                title="Cancel"
                icon={<Ionicons name="close" size={16} color={colors.danger} />}
                onPress={() => handleCancel(item)}
                variant="ghost"
                textStyle={{ color: colors.danger }}
                style={styles.actionBtn}
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
              />
              <Button
                title="Cancel"
                icon={<Ionicons name="close" size={16} color={colors.danger} />}
                onPress={() => handleCancel(item)}
                variant="ghost"
                textStyle={{ color: colors.danger }}
                style={styles.actionBtn}
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
            />
          )}

          {isCompleted && item.finalFileUri && (
            <Button
              title="Share / Open Video"
              icon={<Ionicons name="share-social-outline" size={16} color={colors.textPrimary} />}
              onPress={() => shareSavedMedia(item.finalFileUri!)}
              variant="secondary"
              style={styles.fullActionBtn}
            />
          )}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={[typography.h1, { color: colors.textPrimary }]}>Download Queue</Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
            {jobs.length} active or recent {jobs.length === 1 ? 'task' : 'tasks'}
          </Text>
        </View>

        {jobs.some((j) => j.state === 'COMPLETED' || j.state === 'FAILED' || j.state === 'CANCELLED') && (
          <TouchableOpacity
            onPress={clearTerminalJobs}
            style={styles.clearBtn}
            accessibilityRole="button"
            accessibilityLabel="Clear finished tasks"
          >
            <Text style={[typography.captionMedium, { color: colors.primary }]}>Clear Finished</Text>
          </TouchableOpacity>
        )}
      </View>

      {jobs.length === 0 ? (
        <EmptyState
          iconName="file-tray-outline"
          title="Queue is empty"
          description="Downloads you start from the Home screen will appear here with live progress and controls."
        />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={renderJobItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  clearBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  jobCard: {
    marginBottom: spacing.sm,
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
  progressSection: {
    marginTop: spacing.md,
  },
  bytesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
    minHeight: 44,
  },
  fullActionBtn: {
    flex: 1,
    minHeight: 44,
  },
});
