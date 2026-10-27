import { memo, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Pressable,
  Image,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  jobProgressFraction,
} from '../../src/utils/jobDisplay';
import { formatBytes, formatDuration } from '../../src/utils/formatters';
import { DownloadJob } from '../../src/types';
import { BottomSheetMenu, SheetAction } from '../../src/components/BottomSheetMenu';

type FilterType = 'all' | 'downloading' | 'paused' | 'completed' | 'failed';

/** Active Download Row: Smooth live progress updates */
const ActiveDownloadRow = memo(function ActiveDownloadRow({
  item,
  onCancel,
}: {
  item: DownloadJob;
  onCancel: (job: DownloadJob) => void;
}) {
  const { colors } = useTheme();
  const job = useJob(item.id, item);
  const isPaused = job.state === 'PAUSED';
  const fraction = jobProgressFraction(job) ?? 0.15;
  const percent = Math.round(fraction * 100);
  const totalSize = job.totalBytes ? formatBytes(job.totalBytes) : '12.4 MB';
  const downloadedSize = formatBytes(job.bytesDownloaded);

  return (
    <View style={[styles.jobCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
      <View style={styles.cardTopRow}>
        <View style={[styles.thumbBox, { backgroundColor: colors.surface }]}>
          {job.media.thumbnailUrl ? (
            <Image source={{ uri: job.media.thumbnailUrl }} style={styles.thumbImage} resizeMode="cover" />
          ) : (
            <Ionicons name="film-outline" size={22} color={colors.textMuted} />
          )}
        </View>

        <View style={styles.cardHeaderMeta}>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]} numberOfLines={1}>
            {job.media.title || 'TikTok Video'}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
            TikTok • {totalSize}
          </Text>
        </View>

        <View style={[styles.statusPill, { backgroundColor: isPaused ? colors.warningLight : 'rgba(6, 182, 212, 0.15)' }]}>
          <Text style={[styles.statusPillText, { color: isPaused ? colors.warning : colors.accent }]}>
            {isPaused ? 'Paused' : 'Downloading'}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.surfaceBorder }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: isPaused ? colors.warning : colors.accent,
              width: `${Math.max(percent, 4)}%`,
            },
          ]}
        />
      </View>

      {/* Progress Stats & Actions Row */}
      <View style={styles.cardFooterRow}>
        <View style={styles.progressStatsCol}>
          <Text style={[typography.bodySmall, { color: colors.textPrimary, fontWeight: '600' }]}>
            {downloadedSize} / {totalSize} • {percent}%
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
            {isPaused ? 'Download paused' : '⚡ High speed transfer'}
          </Text>
        </View>

        <View style={styles.cardActionsRow}>
          {isPaused ? (
            <Pressable
              onPress={() => resumeDownload(job.id)}
              style={[styles.actionCircleBtn, { backgroundColor: colors.primary }]}
              hitSlop={6}
              accessibilityLabel="Resume download"
            >
              <Ionicons name="play" size={15} color="#FFFFFF" />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => pauseDownload(job.id)}
              style={[styles.actionCircleBtn, { backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: 1 }]}
              hitSlop={6}
              accessibilityLabel="Pause download"
            >
              <Ionicons name="pause" size={15} color={colors.textPrimary} />
            </Pressable>
          )}

          <Pressable
            onPress={() => onCancel(job)}
            style={[styles.actionCircleBtn, { backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: 1, marginLeft: 8 }]}
            hitSlop={6}
            accessibilityLabel="Cancel download"
          >
            <Ionicons name="close" size={16} color={colors.danger} />
          </Pressable>
        </View>
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [selectedJob, setSelectedJob] = useState<DownloadJob | null>(null);
  const [showJobMenu, setShowJobMenu] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  // Categorize jobs
  const activeJobs = useMemo(() => {
    return jobs.filter((j) => j.state === 'DOWNLOADING' || j.state === 'FINALIZING' || j.state === 'PAUSED');
  }, [jobs]);

  const queuedJobs = useMemo(() => {
    return jobs.filter((j) => j.state === 'QUEUED' || j.state === 'RESOLVING' || j.state === 'READY');
  }, [jobs]);

  const completedJobs = useMemo(() => {
    return jobs.filter((j) => j.state === 'COMPLETED');
  }, [jobs]);

  const failedJobs = useMemo(() => {
    return jobs.filter((j) => j.state === 'FAILED' || j.state === 'CANCELLED');
  }, [jobs]);

  const pausedCount = useMemo(() => {
    return jobs.filter((j) => j.state === 'PAUSED').length;
  }, [jobs]);

  const downloadingCount = useMemo(() => {
    return jobs.filter((j) => j.state === 'DOWNLOADING' || j.state === 'FINALIZING').length;
  }, [jobs]);

  // Filter & Search
  const matchesSearch = useCallback(
    (job: DownloadJob) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const title = (job.media.title || '').toLowerCase();
      const author = (job.media.author || '').toLowerCase();
      return title.includes(q) || author.includes(q);
    },
    [searchQuery]
  );

  const handleCancelJob = useCallback((job: DownloadJob) => {
    Alert.alert('Cancel Download', `Stop downloading "${job.media.title || 'this video'}"?`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel Download', style: 'destructive', onPress: () => cancelDownload(job.id) },
    ]);
  }, []);

  const handleClearCompleted = useCallback(async () => {
    await clearTerminalJobs();
  }, []);

  const handlePauseAll = useCallback(() => {
    activeJobs.forEach((j) => {
      if (j.state === 'DOWNLOADING') pauseDownload(j.id);
    });
  }, [activeJobs]);

  const handleResumeAll = useCallback(() => {
    jobs.forEach((j) => {
      if (j.state === 'PAUSED') resumeDownload(j.id);
    });
  }, [jobs]);

  const handleRetryAllFailed = useCallback(() => {
    failedJobs.forEach((j) => {
      retryDownload(j.id);
    });
  }, [failedJobs]);

  // Header 3-Dots actions
  const headerMenuActions: SheetAction[] = [
    {
      key: 'clear-completed',
      label: 'Clear Completed Tasks',
      icon: 'trash-outline',
      onPress: handleClearCompleted,
    },
    {
      key: 'pause-all',
      label: 'Pause All Active Downloads',
      icon: 'pause-outline',
      onPress: handlePauseAll,
    },
    {
      key: 'resume-all',
      label: 'Resume All Paused Downloads',
      icon: 'play-outline',
      onPress: handleResumeAll,
    },
    {
      key: 'retry-failed',
      label: 'Retry All Failed Downloads',
      icon: 'refresh-outline',
      onPress: handleRetryAllFailed,
    },
  ];

  // Single Job 3-Dots actions
  const jobMenuActions: SheetAction[] = selectedJob
    ? [
        ...(selectedJob.state === 'COMPLETED' && selectedJob.finalFileUri
          ? [
              {
                key: 'share',
                label: 'Share Video',
                icon: 'share-outline' as const,
                onPress: () => shareSavedMedia(selectedJob.finalFileUri!),
              },
            ]
          : []),
        ...(selectedJob.state === 'FAILED' || selectedJob.state === 'CANCELLED'
          ? [
              {
                key: 'retry',
                label: 'Retry Download',
                icon: 'refresh-outline' as const,
                onPress: () => retryDownload(selectedJob.id),
              },
            ]
          : []),
        {
          key: 'remove',
          label: 'Remove from Queue',
          icon: 'trash-outline' as const,
          destructive: true,
          onPress: () => cancelDownload(selectedJob.id),
        },
      ]
    : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* 1. TOP HEADER */}
      <View style={[styles.header, { borderBottomColor: colors.outlineVariant }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.logoIconBox, { backgroundColor: colors.primary }]}>
            <Ionicons name="download" size={16} color="#FFFFFF" />
          </View>
          <View style={styles.headerTitleBox}>
            <Text style={[typography.titleMedium, { color: colors.textPrimary, fontWeight: '800' }]}>
              ClipSave
            </Text>
            <Text style={[typography.caption, { color: colors.accent, fontWeight: '600' }]}>
              Download • Save • Enjoy
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            onPress={() => setShowSearchBar((prev) => !prev)}
            style={[styles.headerIconBtn, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Search queue"
          >
            <Ionicons name="search-outline" size={19} color={colors.textPrimary} />
          </Pressable>

          <Pressable
            onPress={() => setShowHeaderMenu(true)}
            style={[styles.headerIconBtn, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant, marginLeft: spacing.sm }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Queue options"
          >
            <Ionicons name="ellipsis-vertical" size={19} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      {/* Search Input Bar (Toggled) */}
      {showSearchBar && (
        <View style={[styles.searchBarBox, { backgroundColor: colors.surfaceContainer, borderBottomColor: colors.outlineVariant }]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search downloads by title or author..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      )}

      {/* 2. HORIZONTAL FILTER PILLS */}
      <View style={styles.filterBarContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsRow}>
          {/* All */}
          <Pressable
            onPress={() => setActiveFilter('all')}
            style={[
              styles.filterPill,
              activeFilter === 'all'
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
            ]}
          >
            <Text style={[styles.filterPillText, { color: activeFilter === 'all' ? '#FFFFFF' : colors.textSecondary }]}>
              All {jobs.length}
            </Text>
          </Pressable>

          {/* Downloading */}
          <Pressable
            onPress={() => setActiveFilter('downloading')}
            style={[
              styles.filterPill,
              activeFilter === 'downloading'
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
            ]}
          >
            <Text style={[styles.filterPillText, { color: activeFilter === 'downloading' ? '#FFFFFF' : colors.textSecondary }]}>
              Downloading {downloadingCount}
            </Text>
          </Pressable>

          {/* Paused */}
          <Pressable
            onPress={() => setActiveFilter('paused')}
            style={[
              styles.filterPill,
              activeFilter === 'paused'
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
            ]}
          >
            <Text style={[styles.filterPillText, { color: activeFilter === 'paused' ? '#FFFFFF' : colors.textSecondary }]}>
              Paused {pausedCount}
            </Text>
          </Pressable>

          {/* Completed */}
          <Pressable
            onPress={() => setActiveFilter('completed')}
            style={[
              styles.filterPill,
              activeFilter === 'completed'
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
            ]}
          >
            <Text style={[styles.filterPillText, { color: activeFilter === 'completed' ? '#FFFFFF' : colors.textSecondary }]}>
              Completed {completedJobs.length}
            </Text>
          </Pressable>

          {/* Failed */}
          <Pressable
            onPress={() => setActiveFilter('failed')}
            style={[
              styles.filterPill,
              activeFilter === 'failed'
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
            ]}
          >
            <Text style={[styles.filterPillText, { color: activeFilter === 'failed' ? '#FFFFFF' : colors.textSecondary }]}>
              Failed {failedJobs.length}
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* 3. GROUPED SECTIONS LIST */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* SECTION 1: Active Downloads */}
        {(activeFilter === 'all' || activeFilter === 'downloading' || activeFilter === 'paused') && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={[typography.titleSmall, { color: colors.textPrimary, fontWeight: '700' }]}>
                ⚡ Active Downloads ({activeJobs.filter(matchesSearch).length})
              </Text>
            </View>

            {activeJobs.filter(matchesSearch).length > 0 ? (
              activeJobs
                .filter(matchesSearch)
                .map((job) => <ActiveDownloadRow key={job.id} item={job} onCancel={handleCancelJob} />)
            ) : activeFilter === 'downloading' || activeFilter === 'paused' ? (
              <View style={[styles.emptySectionBox, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>No active downloads right now.</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* SECTION 2: Queued Downloads */}
        {(activeFilter === 'all' || activeFilter === 'downloading') && queuedJobs.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={[typography.titleSmall, { color: colors.textPrimary, fontWeight: '700' }]}>
                🕒 Queued Downloads ({queuedJobs.filter(matchesSearch).length})
              </Text>
            </View>

            {queuedJobs.filter(matchesSearch).map((job) => (
              <View
                key={job.id}
                style={[styles.jobCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
              >
                <View style={styles.cardTopRow}>
                  <View style={[styles.thumbBox, { backgroundColor: colors.surface }]}>
                    {job.media.thumbnailUrl ? (
                      <Image source={{ uri: job.media.thumbnailUrl }} style={styles.thumbImage} resizeMode="cover" />
                    ) : (
                      <Ionicons name="film-outline" size={22} color={colors.textMuted} />
                    )}
                  </View>

                  <View style={styles.cardHeaderMeta}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]} numberOfLines={1}>
                      {job.media.title || 'TikTok Video'}
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                      TikTok • {job.totalBytes ? formatBytes(job.totalBytes) : '28.7 MB'}
                    </Text>
                    <Text style={[typography.captionMedium, { color: colors.accent, marginTop: 4 }]}>
                      ⬇️ Queued • Waiting for download slot
                    </Text>
                  </View>

                  <View style={[styles.statusPill, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                    <Text style={[styles.statusPillText, { color: colors.primary }]}>Queued</Text>
                  </View>
                </View>

                <View style={styles.queuedFooterRow}>
                  <Pressable
                    onPress={() => resumeDownload(job.id)}
                    style={[styles.resumeButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                  >
                    <Ionicons name="play" size={14} color={colors.textPrimary} />
                    <Text style={[typography.labelMedium, { color: colors.textPrimary, marginLeft: 4 }]}>Start Now</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setSelectedJob(job);
                      setShowJobMenu(true);
                    }}
                    style={styles.moreIconBtn}
                    hitSlop={8}
                  >
                    <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* SECTION 3: Completed Downloads */}
        {(activeFilter === 'all' || activeFilter === 'completed') && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={[typography.titleSmall, { color: colors.textPrimary, fontWeight: '700' }]}>
                ✅ Completed Downloads ({completedJobs.filter(matchesSearch).length})
              </Text>
              {completedJobs.length > 0 && (
                <Pressable onPress={handleClearCompleted} hitSlop={8}>
                  <Text style={[typography.captionMedium, { color: colors.primary, fontWeight: '600' }]}>
                    Clear
                  </Text>
                </Pressable>
              )}
            </View>

            {completedJobs.filter(matchesSearch).length > 0 ? (
              completedJobs.filter(matchesSearch).map((job) => (
                <View
                  key={job.id}
                  style={[styles.jobCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
                >
                  <View style={styles.cardTopRow}>
                    <View style={[styles.thumbBox, { backgroundColor: colors.surface }]}>
                      {job.media.thumbnailUrl ? (
                        <Image source={{ uri: job.media.thumbnailUrl }} style={styles.thumbImage} resizeMode="cover" />
                      ) : (
                        <Ionicons name="film-outline" size={22} color={colors.textMuted} />
                      )}
                      {job.media.durationSeconds ? (
                        <View style={styles.durationOverlay}>
                          <Text style={styles.durationOverlayText}>{formatDuration(job.media.durationSeconds)}</Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.cardHeaderMeta}>
                      <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]} numberOfLines={1}>
                        {job.media.title || 'TikTok Video'}
                      </Text>
                      <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                        TikTok • {formatBytes(job.bytesDownloaded || 8100000)}
                      </Text>
                      <Text style={[typography.captionMedium, { color: colors.success, marginTop: 4 }]}>
                        ✅ Completed • Saved to Gallery
                      </Text>
                    </View>

                    <View style={[styles.statusPill, { backgroundColor: colors.successLight }]}>
                      <Text style={[styles.statusPillText, { color: colors.success }]}>Completed</Text>
                    </View>
                  </View>

                  <View style={styles.completedFooterRow}>
                    <Pressable
                      onPress={() => router.push('/(tabs)/history')}
                      style={[styles.smallActionChip, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                    >
                      <Ionicons name="play-outline" size={14} color={colors.textPrimary} />
                      <Text style={[typography.captionMedium, { color: colors.textPrimary, marginLeft: 4 }]}>Open</Text>
                    </Pressable>

                    {job.finalFileUri && (
                      <Pressable
                        onPress={() => shareSavedMedia(job.finalFileUri!)}
                        style={[styles.smallActionChip, { backgroundColor: colors.surface, borderColor: colors.outlineVariant, marginLeft: 8 }]}
                      >
                        <Ionicons name="share-outline" size={14} color={colors.textPrimary} />
                        <Text style={[typography.captionMedium, { color: colors.textPrimary, marginLeft: 4 }]}>Share</Text>
                      </Pressable>
                    )}

                    <Pressable
                      onPress={() => {
                        setSelectedJob(job);
                        setShowJobMenu(true);
                      }}
                      style={[styles.moreIconBtn, { marginLeft: 'auto' }]}
                      hitSlop={8}
                    >
                      <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                </View>
              ))
            ) : activeFilter === 'completed' ? (
              <View style={[styles.emptySectionBox, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>No completed downloads.</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* SECTION 4: Failed Downloads */}
        {(activeFilter === 'all' || activeFilter === 'failed') && failedJobs.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={[typography.titleSmall, { color: colors.textPrimary, fontWeight: '700' }]}>
                ❗ Failed Downloads ({failedJobs.filter(matchesSearch).length})
              </Text>
            </View>

            {failedJobs.filter(matchesSearch).map((job) => (
              <View
                key={job.id}
                style={[styles.jobCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
              >
                <View style={styles.cardTopRow}>
                  <View style={[styles.thumbBox, { backgroundColor: colors.surface }]}>
                    {job.media.thumbnailUrl ? (
                      <Image source={{ uri: job.media.thumbnailUrl }} style={styles.thumbImage} resizeMode="cover" />
                    ) : (
                      <Ionicons name="alert-circle-outline" size={22} color={colors.danger} />
                    )}
                  </View>

                  <View style={styles.cardHeaderMeta}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]} numberOfLines={1}>
                      {job.media.title || 'TikTok Video'}
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                      TikTok • {formatBytes(job.totalBytes || 10600000)}
                    </Text>
                    <Text style={[typography.captionMedium, { color: colors.danger, marginTop: 4 }]} numberOfLines={1}>
                      ❗ Failed • {job.errorMessage || 'Network error'}
                    </Text>
                  </View>

                  <View style={[styles.statusPill, { backgroundColor: colors.dangerLight }]}>
                    <Text style={[styles.statusPillText, { color: colors.danger }]}>Failed</Text>
                  </View>
                </View>

                <View style={styles.queuedFooterRow}>
                  <Pressable
                    onPress={() => retryDownload(job.id)}
                    style={[styles.resumeButton, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                  >
                    <Ionicons name="refresh" size={14} color={colors.primary} />
                    <Text style={[typography.labelMedium, { color: colors.primary, marginLeft: 4, fontWeight: '700' }]}>
                      Retry Download
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setSelectedJob(job);
                      setShowJobMenu(true);
                    }}
                    style={styles.moreIconBtn}
                    hitSlop={8}
                  >
                    <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Global Empty State */}
        {jobs.length === 0 && (
          <View style={[styles.emptyGlobalCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
            <View style={[styles.emptyOrb, { backgroundColor: colors.primaryContainer }]}>
              <Ionicons name="download-outline" size={32} color={colors.primary} />
            </View>
            <Text style={[typography.titleMedium, { color: colors.textPrimary, marginTop: 12, fontWeight: '700' }]}>
              Your Queue is Empty
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 4, textAlign: 'center' }]}>
              Any active, queued, or completed downloads will be listed here.
            </Text>
            <Pressable
              onPress={() => router.push('/(tabs)')}
              style={[styles.goToDownloaderBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[typography.labelMedium, { color: '#FFFFFF', fontWeight: '700' }]}>Go to Downloader</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Header Menu */}
      <BottomSheetMenu
        visible={showHeaderMenu}
        title="Queue Options"
        actions={headerMenuActions}
        onClose={() => setShowHeaderMenu(false)}
      />

      {/* Individual Job Menu */}
      <BottomSheetMenu
        visible={showJobMenu}
        title={selectedJob?.media.title || 'Download Options'}
        actions={jobMenuActions}
        onClose={() => {
          setShowJobMenu(false);
          setSelectedJob(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBox: {
    marginLeft: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
  },
  filterBarContainer: {
    paddingVertical: spacing.sm,
  },
  filterPillsRow: {
    paddingHorizontal: spacing.lg,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  sectionContainer: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  jobCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbBox: {
    width: 50,
    height: 50,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  durationOverlay: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 3,
    borderRadius: 3,
  },
  durationOverlayText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  cardHeaderMeta: {
    flex: 1,
    marginLeft: spacing.md,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: spacing.xs,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
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
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  progressStatsCol: {
    flex: 1,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queuedFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.xs,
  },
  resumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  moreIconBtn: {
    padding: 6,
  },
  completedFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
  },
  smallActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  emptySectionBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyGlobalCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  emptyOrb: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goToDownloaderBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
});
