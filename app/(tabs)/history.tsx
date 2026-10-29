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
import { spacing, layout, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { BottomSheetMenu, SheetAction } from '../../src/components/BottomSheetMenu';
import {
  getHistory,
  deleteHistoryEntryAndFile,
  clearHistoryAndFiles,
} from '../../src/storage/historyStore';
import {
  shareSavedMedia,
  playVideo,
  saveOrExportToGallery,
  showFileLocationInfo,
} from '../../src/services/mediaManager';
import { formatBytes, formatDuration } from '../../src/utils/formatters';
import { HistoryItem } from '../../src/types';
import { TabHeader } from '../../src/components/TabHeader';

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
  const [showTopMenu, setShowTopMenu] = useState(false);

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

  // Filtered and sorted list
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

  const handleOpenVideo = useCallback((item: HistoryItem) => {
    playVideo(item.fileUri);
  }, []);

  const handleShareVideo = useCallback((item: HistoryItem) => {
    shareSavedMedia(item.fileUri);
  }, []);

  const handleCopyLink = useCallback(async (item: HistoryItem) => {
    if (item.sourceUrl) {
      await Clipboard.setStringAsync(item.sourceUrl);
      Alert.alert('Link Copied', 'Original TikTok link copied to clipboard.');
    } else {
      Alert.alert('No URL', 'Source link is unavailable for this item.');
    }
  }, []);

  const handleDeleteFile = useCallback(
    (item: HistoryItem) => {
      Alert.alert(
        'Delete from Device?',
        `Permanently delete "${item.title || 'this video'}" and its file from storage?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await deleteHistoryEntryAndFile(item.id);
              loadHistory();
            },
          },
        ]
      );
    },
    [loadHistory]
  );

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Clear All History?',
      'Permanently delete all downloaded videos and history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearHistoryAndFiles();
            loadHistory();
          },
        },
      ]
    );
  }, [loadHistory]);

  const topMenuActions: SheetAction[] = [
    {
      key: 'sort-newest',
      label: 'Sort: Newest First',
      icon: 'time-outline',
      onPress: () => setSortOption('newest'),
    },
    {
      key: 'sort-size',
      label: 'Sort: Largest Size',
      icon: 'server-outline',
      onPress: () => setSortOption('size'),
    },
    {
      key: 'clear-all',
      label: 'Clear All History',
      icon: 'trash-outline',
      destructive: true,
      onPress: handleClearAll,
    },
  ];

  const filterMenuActions: SheetAction[] = [
    {
      key: 'newest',
      label: 'Newest First',
      icon: sortOption === 'newest' ? 'checkmark-circle' : 'time-outline',
      onPress: () => setSortOption('newest'),
    },
    {
      key: 'oldest',
      label: 'Oldest First',
      icon: sortOption === 'oldest' ? 'checkmark-circle' : 'calendar-outline',
      onPress: () => setSortOption('oldest'),
    },
    {
      key: 'size',
      label: 'Largest File Size',
      icon: sortOption === 'size' ? 'checkmark-circle' : 'file-tray-full-outline',
      onPress: () => setSortOption('size'),
    },
  ];

  const itemMenuActions: SheetAction[] = selectedItem
    ? [
        {
          key: 'play',
          label: 'Play Video',
          icon: 'play-circle-outline',
          onPress: () => handleOpenVideo(selectedItem),
        },
        {
          key: 'save-gallery',
          label: 'Save to Gallery / Device',
          icon: 'download-outline',
          onPress: () => saveOrExportToGallery(selectedItem.fileUri),
        },
        {
          key: 'location',
          label: 'View File Location & Info',
          icon: 'folder-open-outline',
          onPress: () => showFileLocationInfo(selectedItem.fileUri, selectedItem.title, true),
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
              pathname: '/',
              params: { prefill: selectedItem.sourceUrl, ts: String(Date.now()) },
            });
          },
        },
        {
          key: 'delete',
          label: 'Delete Permanently',
          icon: 'trash-outline',
          destructive: true,
          onPress: () => handleDeleteFile(selectedItem),
        },
      ]
    : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* 1. COMPACT TOP HEADER WITH LOGO + "HISTORY" + 3-DOTS OVERFLOW */}
      <TabHeader
        title="History"
        onOverflowPress={() => setShowTopMenu(true)}
        overflowLabel="History options"
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + layout.section + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 2. SEARCH INPUT AND FILTER BUTTON ROW */}
        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
              },
            ]}
          >
            <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
            <TextInput
              style={[
                styles.searchInput,
                typography.body,
                { color: colors.textPrimary },
              ]}
              placeholder="Search videos..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Search saved videos"
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery('')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear search query"
              >
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Filter Chip Button */}
          <Pressable
            onPress={() => setShowFilterMenu(true)}
            android_ripple={{ color: colors.ripple }}
            style={[
              styles.filterButton,
              {
                backgroundColor: colors.surfaceContainer,
                borderColor: colors.outlineVariant,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Filter and sort saved videos"
          >
            <Ionicons name="filter-outline" size={16} color={colors.textPrimary} />
            <Text style={[typography.labelMedium, { color: colors.textPrimary, marginLeft: 4 }]}>
              Filter
            </Text>
          </Pressable>
        </View>

        {/* 3. SAVED VIDEO LIST OR CLEAN EMPTY STATE */}
        {filteredList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: colors.surfaceContainer, borderColor: colors.surfaceBorder },
              ]}
            >
              <Ionicons name="film-outline" size={36} color={colors.textMuted} />
            </View>
            <Text
              style={[
                typography.titleLarge,
                { color: colors.textPrimary, fontWeight: '700', marginTop: spacing.md },
              ]}
            >
              {history.length === 0 ? 'No Saved Videos Yet' : 'No Matching Videos'}
            </Text>
            <Text
              style={[
                typography.bodyMedium,
                { color: colors.textSecondary, textAlign: 'center', marginTop: 4, paddingHorizontal: spacing.lg },
              ]}
            >
              {history.length === 0
                ? 'Videos you download will appear here automatically.'
                : 'Try adjusting your search terms or filter selection.'}
            </Text>

            {history.length === 0 && (
              <Pressable
                onPress={() => router.navigate('/')}
                android_ripple={{ color: colors.ripplePrimary }}
                style={[styles.emptyActionButton, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Go to Home to download a video"
              >
                <Ionicons name="download-outline" size={18} color={colors.onPrimary} />
                <Text style={[typography.labelMedium, { color: colors.onPrimary, fontWeight: '700' }]}>
                  Download Videos
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          filteredList.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => handleOpenVideo(item)}
              android_ripple={{ color: colors.ripple }}
              style={[
                styles.historyCard,
                {
                  backgroundColor: colors.surfaceContainer,
                  borderColor: colors.surfaceBorder,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Saved video: ${item.title || (item.platform === 'youtube' ? 'YouTube video' : item.platform === 'instagram' ? 'Instagram video' : item.platform === 'facebook' ? 'Facebook video' : 'TikTok video')}`}
            >
              {/* Thumbnail with duration badge and play icon overlay */}
              <View style={styles.thumbnailWrapper}>
                {item.thumbnailUrl ? (
                  <Image
                    source={{ uri: item.thumbnailUrl }}
                    style={styles.thumbnailImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.thumbnailPlaceholder, { backgroundColor: colors.surfaceContainerHigh }]}>
                    <Ionicons
                      name={item.format === 'mp3' || item.format === 'm4a' ? 'musical-notes' : 'film-outline'}
                      size={24}
                      color={colors.primary}
                    />
                  </View>
                )}
                <View style={styles.playOverlay}>
                  <Ionicons
                    name={item.format === 'mp3' || item.format === 'm4a' ? 'musical-notes' : 'play'}
                    size={12}
                    color="#FFFFFF"
                  />
                </View>
                {item.durationSeconds ? (
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>
                      {formatDuration(item.durationSeconds)}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Title & Metadata */}
              <View style={styles.metaCol}>
                <View style={styles.historyPlatformRow}>
                  {item.platform === 'youtube' || item.sourceUrl?.includes('youtu') ? (
                    <View style={[styles.platformChipSmall, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: '#EF4444' }]}>
                      <Ionicons name="logo-youtube" size={10} color="#EF4444" />
                      <Text style={[typography.micro, { color: '#EF4444', fontSize: 9, marginLeft: 2 }]}>YouTube</Text>
                    </View>
                  ) : item.platform === 'instagram' || item.sourceUrl?.includes('instagram.com') || item.sourceUrl?.includes('instagr.am') ? (
                    <View style={[styles.platformChipSmall, { backgroundColor: 'rgba(225, 48, 108, 0.12)', borderColor: '#E1306C' }]}>
                      <Ionicons name="logo-instagram" size={10} color="#E1306C" />
                      <Text style={[typography.micro, { color: '#E1306C', fontSize: 9, marginLeft: 2 }]}>Instagram</Text>
                    </View>
                  ) : item.platform === 'facebook' || item.sourceUrl?.includes('facebook.com') || item.sourceUrl?.includes('fb.watch') || item.sourceUrl?.includes('fb.com') ? (
                    <View style={[styles.platformChipSmall, { backgroundColor: 'rgba(24, 119, 242, 0.12)', borderColor: '#1877F2' }]}>
                      <Ionicons name="logo-facebook" size={10} color="#1877F2" />
                      <Text style={[typography.micro, { color: '#1877F2', fontSize: 9, marginLeft: 2 }]}>Facebook</Text>
                    </View>
                  ) : (
                    <View style={[styles.platformChipSmall, { backgroundColor: 'rgba(6, 182, 212, 0.12)', borderColor: '#06B6D4' }]}>
                      <Ionicons name="musical-notes" size={10} color="#06B6D4" />
                      <Text style={[typography.micro, { color: '#06B6D4', fontSize: 9, marginLeft: 2 }]}>TikTok</Text>
                    </View>
                  )}
                  {item.format === 'mp3' || item.format === 'm4a' ? (
                    <View style={[styles.platformChipSmall, { backgroundColor: 'rgba(168, 85, 247, 0.12)', borderColor: '#A855F7' }]}>
                      <Text style={[typography.micro, { color: '#A855F7', fontSize: 9 }]}>MP3 Audio</Text>
                    </View>
                  ) : item.quality ? (
                    <View style={[styles.platformChipSmall, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}>
                      <Text style={[typography.micro, { color: colors.textSecondary, fontSize: 9 }]}>{item.quality}</Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]}
                  numberOfLines={2}
                >
                  {item.title || 'Untitled Media'}
                </Text>
                <Text
                  style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}
                  numberOfLines={1}
                >
                  @{item.author || 'creator'}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                  {item.fileSizeBytes ? `${formatBytes(item.fileSizeBytes)} • ` : ''}
                  {item.savedAt ? new Date(item.savedAt).toLocaleDateString() : 'Saved'}
                </Text>
              </View>

              {/* 3-Dots Action Menu */}
              <Pressable
                onPress={() => {
                  setSelectedItem(item);
                  setShowItemMenu(true);
                }}
                style={styles.dotsButton}
                accessibilityRole="button"
                accessibilityLabel="Video options"
                hitSlop={8}
              >
                <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
              </Pressable>
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* Top Header Overflow Menu */}
      <BottomSheetMenu
        visible={showTopMenu}
        onClose={() => setShowTopMenu(false)}
        title="History Options"
        actions={topMenuActions}
      />

      {/* Filter and Sort Menu */}
      <BottomSheetMenu
        visible={showFilterMenu}
        onClose={() => setShowFilterMenu(false)}
        title="Sort Videos By"
        actions={filterMenuActions}
      />

      {/* Item Action Sheet */}
      <BottomSheetMenu
        visible={showItemMenu}
        onClose={() => setShowItemMenu(false)}
        title={selectedItem?.title || 'Video Options'}
        actions={itemMenuActions}
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    minHeight: 46,
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
    height: 42,
    paddingVertical: 0,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    minHeight: 46,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
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
  historyPlatformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  platformChipSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  dotsButton: {
    padding: spacing.xs,
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
