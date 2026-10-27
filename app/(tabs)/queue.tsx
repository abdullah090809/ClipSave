import { memo, useCallback, useMemo } from 'react';
import { View, Text, SectionList, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { IconButton } from '../../src/components/IconButton';
import { TextButton } from '../../src/components/TextButton';
import { EmptyState } from '../../src/components/EmptyState';
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
  active: 'In progress',
  failed: 'Needs attention',
  done: 'Completed',
};
const SECTION_ORDER: JobBucket[] = ['active', 'failed', 'done'];

function Hairline() {
  const { colors } = useTheme();
  return <View style={[styles.hairline, { backgroundColor: colors.outlineVariant }]} />;
}

/**
 * Active rows read live byte progress through useJob, so a progress tick
 * re-renders only that row; the screen and the other rows stay untouched.
 */
const ActiveRow = memo(function ActiveRow({
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
  const tint = paused ? colors.warning : colors.primary;

  return (
    <View style={styles.row}>
      <View
        style={styles.rowMain}
        accessible
        accessibilityLabel={`${job.media.title}, ${jobStatusLabel(job)}, ${jobProgressDetail(job)}`}
      >
        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
          {job.media.title || 'TikTok video'}
        </Text>
        <Text style={[typography.bodySmall, { color: colors.textSecondary }]} numberOfLines={1}>
          <Text style={{ color: tint, fontWeight: '600' }}>{jobStatusLabel(job)}</Text>
          {'  ·  '}
          {jobProgressDetail(job)}
        </Text>
        <View style={[styles.track, { backgroundColor: colors.outlineVariant }]}>
          <View
            style={[
              styles.fill,
              { backgroundColor: tint, width: `${Math.round((fraction ?? 0.08) * 100)}%` },
              fraction === undefined && { opacity: 0.5 },
            ]}
          />
        </View>
      </View>
      {paused ? (
        <IconButton icon="play" label="Resume download" color={colors.primary} onPress={() => resumeDownload(job.id)} />
      ) : (
        <IconButton icon="pause" label="Pause download" onPress={() => pauseDownload(job.id)} />
      )}
      <IconButton icon="close" label="Cancel download" onPress={() => onCancel(job)} />
    </View>
  );
});

const FailedRow = memo(function FailedRow({ item }: { item: DownloadJob }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.media.title || 'TikTok video'}
        </Text>
        <Text style={[typography.bodySmall, { color: colors.danger }]} numberOfLines={2}>
          {jobStatusLabel(item)}
          {item.errorMessage ? ` · ${item.errorMessage}` : ''}
        </Text>
      </View>
      <TextButton
        title="Retry"
        onPress={() => retryDownload(item.id)}
        accessibilityLabel={`Retry download for ${item.media.title}`}
      />
    </View>
  );
});

const DoneRow = memo(function DoneRow({ item }: { item: DownloadJob }) {
  const { colors } = useTheme();
  const uri = item.finalFileUri;
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.media.title || 'Saved video'}
        </Text>
        <Text style={[typography.bodySmall, { color: colors.textSecondary }]} numberOfLines={1}>
          {formatBytes(item.bytesDownloaded)}
          {item.statusMessage ? ` · ${item.statusMessage}` : ''}
        </Text>
      </View>
      {uri ? (
        <IconButton
          icon="share-outline"
          label={`Share ${item.media.title}`}
          onPress={() => shareSavedMedia(uri)}
        />
      ) : null}
    </View>
  );
});

export default function QueueScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const jobs = useQueueStructure();

  const handleCancel = useCallback((job: DownloadJob) => {
    Alert.alert(
      'Cancel this download?',
      'The partial file will be removed. You can start it again from Home.',
      [
        { text: 'Keep downloading', style: 'cancel' },
        { text: 'Cancel download', style: 'destructive', onPress: () => cancelDownload(job.id) },
      ]
    );
  }, []);

  const sections = useMemo<Section[]>(() => {
    const buckets: Record<JobBucket, DownloadJob[]> = { active: [], failed: [], done: [] };
    for (const j of jobs) buckets[jobBucket(j)].push(j);
    return SECTION_ORDER.filter((k) => buckets[k].length > 0).map((k) => ({
      key: k,
      title: SECTION_TITLES[k],
      data: buckets[k],
    }));
  }, [jobs]);

  const activeCount = sections.find((s) => s.key === 'active')?.data.length ?? 0;

  const renderItem = useCallback(
    ({ item, section }: { item: DownloadJob; section: Section }) =>
      section.key === 'active' ? (
        <ActiveRow item={item} onCancel={handleCancel} />
      ) : section.key === 'failed' ? (
        <FailedRow item={item} />
      ) : (
        <DoneRow item={item} />
      ),
    [handleCancel]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => (
      <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
        <Text style={[typography.titleSmall, { color: colors.textSecondary }]}>
          {section.title} · {section.data.length}
        </Text>
        {section.key === 'done' ? (
          <TextButton title="Clear finished" onPress={clearTerminalJobs} tone="neutral" />
        ) : null}
      </View>
    ),
    [colors.background, colors.textSecondary]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[typography.titleLarge, { color: colors.textPrimary }]}>Queue</Text>
        {activeCount > 0 ? (
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            {activeCount} in progress
          </Text>
        ) : null}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ItemSeparatorComponent={Hairline}
        stickySectionHeadersEnabled={false}
        initialNumToRender={12}
        windowSize={7}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            iconName="swap-vertical-outline"
            title="No downloads yet"
            description="Paste a TikTok link on Home and confirm the preview. Active downloads show up here."
            actionTitle="Go to Home"
            onAction={() => router.navigate('/')}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 56,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listContent: { paddingBottom: spacing.xxxl },
  sectionHeader: {
    minHeight: 48,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    paddingVertical: spacing.sm,
    minHeight: 64,
  },
  rowMain: { flex: 1, paddingRight: spacing.sm },
  track: { height: 3, borderRadius: 2, marginTop: spacing.sm, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  hairline: { height: StyleSheet.hairlineWidth, marginLeft: spacing.lg },
});
