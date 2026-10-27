import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  TextInput,
  Pressable,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { BottomSheetMenu, SheetAction } from '../../src/components/BottomSheetMenu';
import {
  getHistory,
  removeHistoryEntryOnly,
  deleteHistoryEntryAndFile,
} from '../../src/storage/historyStore';
import { shareSavedMedia } from '../../src/services/mediaManager';
import { formatBytes, formatDuration } from '../../src/utils/formatters';
import { HistoryItem } from '../../src/types';

type SortOption = 'newest' | 'oldest' | 'size';

export default function HistoryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [showItemMenu, setShowItemMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const list = await getHistory(false);
      setHistory(list);
    } catch {
      // ignore
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  // Filtered and Sorted list
  const filteredList = useMemo(() => {
    let result = [...history];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (it) =>
          (it.title || '').toLowerCase().includes(q) ||
          (it.author || '').toLowerCase().includes(q)
      );
    }

    const getTimestamp = (it: HistoryItem) => new Date(it.savedAt).getTime() || 0;

    if (sortOption === 'newest') {
      result.sort((a, b) => getTimestamp(b) - getTimestamp(a));
    } else if (sortOption === 'oldest') {
      result.sort((a, b) => getTimestamp(a) - getTimestamp(b));
    } else if (sortOption === 'size') {
      result.sort((a, b) => (b.fileSizeBytes || 0) - (a.fileSizeBytes || 0));
    }

    return result;
  }, [history, searchQuery, sortOption]);

  // Statistics
  const totalSaved = history.length;
  const totalSizeBytes = useMemo(
    () => history.reduce((sum, it) => sum + (it.fileSizeBytes || 0), 0),
    [history]
  );
  const storageUsedFormatted = formatBytes(totalSizeBytes);
  // Estimate video count vs image slideshow count
  const videoCount = history.filter((it) => it.durationSeconds && it.durationSeconds > 0).length || totalSaved;
  const imageCount = Math.max(0, totalSaved - videoCount);

  // Group into Today, Yesterday, Older
  const groupedSections = useMemo(() => {
    const today: HistoryItem[] = [];
    const yesterday: HistoryItem[] = [];
    const older: HistoryItem[] = [];

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayMidnight = todayMidnight - 86400000;

    filteredList.forEach((item) => {
      const t = new Date(item.savedAt).getTime() || 0;
      if (t >= todayMidnight) {
        today.push(item);
      } else if (t >= yesterdayMidnight) {
        yesterday.push(item);
      } else {
        older.push(item);
      }
    });

    return [
      { key: 'today', title: `Today (${today.length} videos)`, data: today },
      { key: 'yesterday', title: `Yesterday (${yesterday.length} videos)`, data: yesterday },
      { key: 'older', title: `Older (${older.length} videos)`, data: older },
    ].filter((sec) => sec.data.length > 0);
  }, [filteredList]);

  // Actions
  const handleOpenVideo = useCallback((item: HistoryItem) => {
    // Open through system player / share
    shareSavedMedia(item.fileUri);
  }, []);

  const handleShareVideo = useCallback((item: HistoryItem) => {
    shareSavedMedia(item.fileUri);
  }, []);

  const handleCopyLink = useCallback(async (item: HistoryItem) => {
    if (item.sourceUrl) {
      await Clipboard.setStringAsync(item.sourceUrl);
      Alert.alert('Link Copied', 'TikTok video URL copied to clipboard.');
    } else {
      Alert.alert('No URL', 'Source URL is unavailable for this item.');
    }
  }, []);

  const handleRemoveEntryOnly = useCallback(async (item: HistoryItem) => {
    await removeHistoryEntryOnly(item.id);
    loadHistory();
  }, [loadHistory]);

  const handleDeleteFile = useCallback((item: HistoryItem) => {
    Alert.alert(
      'Delete from Device?',
      `Permanently delete "${item.title || 'this video'}" and its file from storage?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            await deleteHistoryEntryAndFile(item.id);
            loadHistory();
          },
        },
      ]
    );
  }, [loadHistory]);

  const itemMenuActions: SheetAction[] = selectedItem
    ? [
        {
          key: 'open',
          label: 'Play / Open Video',
          icon: 'play-circle-outline',
          onPress: () => handleOpenVideo(selectedItem),
        },
        {
          key: 'share',
          label: 'Share Video',
          icon: 'share-outline',
          onPress: () => handleShareVideo(selectedItem),
        },
        {
          key: 'copy',
          label: 'Copy TikTok Link',
          icon: 'copy-outline',
          onPress: () => handleCopyLink(selectedItem),
        },
        {
          key: 'redownload',
          label: 'Redownload in Downloader',
          icon: 'arrow-down-circle-outline',
          onPress: () => {
            router.push({
              pathname: '/(tabs)',
              params: { prefill: selectedItem.sourceUrl, ts: String(Date.now()) },
            });
          },
        },
        {
          key: 'remove-entry',
          label: 'Remove from History (Keep File)',
          icon: 'list-outline',
          onPress: () => handleRemoveEntryOnly(selectedItem),
        },
        {
          key: 'delete-all',
          label: 'Delete Permanently from Device',
          icon: 'trash-outline',
          destructive: true,
          onPress: () => handleDeleteFile(selectedItem),
        },
      ]
    : [];

  const filterMenuActions: SheetAction[] = [
    {
      key: 'newest',
      label: 'Sort: Newest First',
      icon: 'arrow-down-outline',
      onPress: () => setSortOption('newest'),
    },
    {
      key: 'oldest',
      label: 'Sort: Oldest First',
      icon: 'arrow-up-outline',
      onPress: () => setSortOption('oldest'),
    },
    {
      key: 'size',
      label: 'Sort: File Size',
      icon: 'layers-outline',
      onPress: () => setSortOption('size'),
    },
  ];

  const headerMenuActions: SheetAction[] = [
    {
      key: 'refresh',
      label: 'Refresh Library',
      icon: 'refresh-outline',
      onPress: loadHistory,
    },
    {
      key: 'settings',
      label: 'Storage & Cleanup Settings',
      icon: 'settings-outline',
      onPress: () => router.push('/(tabs)/settings'),
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* 1. TOP HEADER */}
      <View style={[styles.header, { borderBottomColor: colors.outlineVariant }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.logoIconBox, { backgroundColor: colors.primary }]}>
            <Ionicons name="film" size={16} color="#FFFFFF" />
          </View>
          <View style={styles.headerTitleBox}>
            <Text style={[typography.titleMedium, { color: colors.textPrimary, fontWeight: '800' }]}>
              ClipSave
            </Text>
            <Text style={[typography.caption, { color: colors.accent, fontWeight: '600' }]}>
              Your saved videos
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            onPress={() => setShowFilterMenu(true)}
            style={[styles.headerIconBtn, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Filter videos"
          >
            <Ionicons name="filter-outline" size={19} color={colors.textPrimary} />
          </Pressable>

          <Pressable
            onPress={() => setShowHeaderMenu(true)}
            style={[styles.headerIconBtn, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant, marginLeft: spacing.sm }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="More options"
          >
            <Ionicons name="ellipsis-vertical" size={19} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. SEARCH & FILTER BAR */}
        <View style={styles.searchFilterRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Search videos..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          <Pressable
            onPress={() => setShowFilterMenu(true)}
            style={[styles.filterBtn, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
            accessibilityRole="button"
          >
            <Text style={[typography.labelMedium, { color: colors.textPrimary, fontWeight: '700' }]}>Filter</Text>
            <Ionicons name="chevron-down" size={14} color={colors.textPrimary} style={{ marginLeft: 4 }} />
          </Pressable>
        </View>

        {/* 3. STATS DASHBOARD CARD (4 METRIC BOXES) */}
        <View style={[styles.dashboardCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
          {/* Box 1: Total Saved (Highlighted) */}
          <View style={[styles.statBox, styles.statBoxPrimary, { backgroundColor: colors.primaryContainer, borderColor: colors.primary }]}>
            <Text style={[styles.statNumber, { color: colors.primary }]}>{totalSaved}</Text>
            <Text style={[styles.statLabel, { color: colors.primary }]}>Total Saved</Text>
          </View>

          {/* Box 2: Videos */}
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.statNumber, { color: colors.textPrimary }]}>{videoCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Videos</Text>
          </View>

          {/* Box 3: Images */}
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.statNumber, { color: colors.textPrimary }]}>{imageCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Images</Text>
          </View>

          {/* Box 4: Storage Used */}
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.statNumber, { color: colors.accent }]}>{storageUsedFormatted}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Storage Used</Text>
          </View>
        </View>

        {/* 4. GROUPED TIME SECTIONS */}
        {groupedSections.length > 0 ? (
          groupedSections.map((section) => (
            <View key={section.key} style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[typography.titleSmall, { color: colors.textPrimary, fontWeight: '700' }]}>
                  {section.title}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </View>

              <View style={styles.sectionList}>
                {section.data.map((item) => (
                  <View
                    key={item.id}
                    style={[styles.videoRowCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
                  >
                    <View style={[styles.videoThumbBox, { backgroundColor: colors.surface }]}>
                      {item.thumbnailUrl ? (
                        <Image source={{ uri: item.thumbnailUrl }} style={styles.videoThumb} resizeMode="cover" />
                      ) : (
                        <Ionicons name="film-outline" size={22} color={colors.textMuted} />
                      )}
                      <View style={styles.playOverlay}>
                        <Ionicons name="play" size={14} color="#FFFFFF" />
                      </View>
                      {item.durationSeconds ? (
                        <View style={styles.durationOverlayBadge}>
                          <Text style={styles.durationOverlayText}>{formatDuration(item.durationSeconds)}</Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.videoMetaCol}>
                      <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]} numberOfLines={2}>
                        {item.title || 'TikTok Video'}
                      </Text>
                      <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                        TikTok • {formatBytes(item.fileSizeBytes)}
                        {item.durationSeconds ? ` • ${formatDuration(item.durationSeconds)}` : ''}
                      </Text>
                      <Text style={[typography.captionMedium, { color: colors.accent, marginTop: 3 }]}>
                        📅 {new Date(item.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>

                    <View style={styles.videoActionsRow}>
                      <Pressable
                        onPress={() => handleOpenVideo(item)}
                        style={[styles.openPillBtn, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                        accessibilityRole="button"
                        accessibilityLabel="Open video"
                      >
                        <Text style={[typography.captionMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                          Open
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          setSelectedItem(item);
                          setShowItemMenu(true);
                        }}
                        style={styles.moreBtn}
                        hitSlop={8}
                        accessibilityLabel="More options"
                      >
                        <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))
        ) : (
          <View style={[styles.emptyContainer, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
            <View style={[styles.emptyOrb, { backgroundColor: colors.primaryContainer }]}>
              <Ionicons name="film-outline" size={32} color={colors.primary} />
            </View>
            <Text style={[typography.titleMedium, { color: colors.textPrimary, marginTop: 12, fontWeight: '700' }]}>
              {searchQuery ? 'No Videos Found' : 'No Saved Videos Yet'}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 4, textAlign: 'center' }]}>
              {searchQuery
                ? 'Try a different search keyword.'
                : 'Videos you download will appear here automatically.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Item Actions Bottom Sheet */}
      <BottomSheetMenu
        visible={showItemMenu}
        title={selectedItem?.title || 'Video Options'}
        actions={itemMenuActions}
        onClose={() => {
          setShowItemMenu(false);
          setSelectedItem(null);
        }}
      />

      {/* Filter Bottom Sheet */}
      <BottomSheetMenu
        visible={showFilterMenu}
        title="Sort & Filter Library"
        actions={filterMenuActions}
        onClose={() => setShowFilterMenu(false)}
      />

      {/* Header Menu Bottom Sheet */}
      <BottomSheetMenu
        visible={showHeaderMenu}
        title="Library Settings"
        actions={headerMenuActions}
        onClose={() => setShowHeaderMenu(false)}
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
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  // Dashboard Card
  dashboardCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    gap: 8,
    marginBottom: spacing.lg,
  },
  statBox: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBoxPrimary: {
    borderWidth: 1.5,
  },
  statNumber: {
    fontSize: 15,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  // Sections
  sectionBlock: {
    marginBottom: spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionList: {
    gap: 10,
  },
  videoRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.md,
  },
  videoThumbBox: {
    width: 60,
    height: 60,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  videoThumb: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationOverlayBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  durationOverlayText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  videoMetaCol: {
    flex: 1,
    marginLeft: spacing.md,
  },
  videoActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  openPillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  moreBtn: {
    padding: 6,
    marginLeft: 4,
  },
  emptyContainer: {
    borderRadius: 16,
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
});
