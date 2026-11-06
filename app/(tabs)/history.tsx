import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
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
} from '../../src/services/mediaManager';
import { formatBytes, formatDuration } from '../../src/utils/formatters';
import { HistoryItem } from '../../src/types';
import { TabHeader } from '../../src/components/TabHeader';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';

type SortOption = 'newest' | 'oldest' | 'size';

export default function HistoryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [showItemMenu, setShowItemMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showTopMenu, setShowTopMenu] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<HistoryItem | null>(null);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [infoDialog, setInfoDialog] = useState<{
    title: string;
    message: string;
    icon?: keyof typeof Ionicons.glyphMap;
    iconColor?: string;
  } | null>(null);

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
      setInfoDialog({
        title: 'Link Copied',
        message: 'Original video link was copied to your clipboard.',
        icon: 'checkmark-circle-outline',
      });
    } else {
      setInfoDialog({
        title: 'No URL Available',
        message: 'Source link is unavailable for this saved item.',
        icon: 'alert-circle-outline',
      });
    }
  }, []);

  const handleDeleteFile = useCallback(
    (item: HistoryItem) => {
      setItemToDelete(item);
    },
    []
  );

  const handleClearAll = useCallback(() => {
    setShowClearAllDialog(true);
  }, []);

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
          key: 'share',
          label: 'Share Video',
          icon: 'share-outline',
          onPress: () => handleShareVideo(selectedItem),
        },
        {
          key: 'copy',
          label: 'Copy Link',
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
                borderColor: isSearchFocused ? colors.primary : colors.inputBorder,
              },
            ]}
          >
            <Ionicons
              name="search-outline"
              size={18}
              color={isSearchFocused ? colors.primary : colors.textSecondary}
            />
            <TextInput
              style={[
                styles.searchInput,
                typography.body,
                { color: colors.textPrimary },
              ]}
              placeholder="Search saved videos..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Search saved videos"
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery('')}
                hitSlop={10}
                style={styles.clearSearchBtn}
                accessibilityRole="button"
                accessibilityLabel="Clear search query"
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Sort / Filter Chip Button with active state display */}
          <Pressable
            onPress={() => setShowFilterMenu(true)}
            android_ripple={{ color: colors.ripple }}
            style={[
              styles.filterButton,
              {
                backgroundColor: colors.surfaceContainer,
                borderColor: colors.surfaceBorder,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Filter and sort saved videos, current sort: ${sortOption}`}
          >
            <Ionicons name="swap-vertical" size={15} color={colors.primary} />
            <Text style={[typography.labelMedium, { color: colors.textPrimary, marginLeft: 4, fontWeight: '600' }]}>
              {sortOption === 'newest' ? 'Newest' : sortOption === 'oldest' ? 'Oldest' : 'Size'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} style={{ marginLeft: 2 }} />
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
              <Ionicons name="film-outline" size={26} color={colors.textMuted} />
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
                ? 'Videos and audio you download will appear here automatically.'
                : 'Try adjusting your search terms or filter selection.'}
            </Text>

            {history.length === 0 ? (
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
            ) : (
              <Pressable
                onPress={() => setSearchQuery('')}
                android_ripple={{ color: colors.ripple }}
                style={[styles.emptyActionButton, { backgroundColor: colors.surfaceContainerHigh }]}
                accessibilityRole="button"
                accessibilityLabel="Clear search filter"
              >
                <Ionicons name="refresh-outline" size={16} color={colors.textPrimary} />
                <Text style={[typography.labelMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                  Reset Filter
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
              <View style={[styles.thumbnailWrapper, { backgroundColor: colors.surfaceContainerHighest }]}>
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
                      <Text style={[typography.micro, { color: '#EF4444', fontSize: 9, marginLeft: 2, fontWeight: '700' }]}>YouTube</Text>
                    </View>
                  ) : item.platform === 'instagram' || item.sourceUrl?.includes('instagram.com') || item.sourceUrl?.includes('instagr.am') ? (
                    <View style={[styles.platformChipSmall, { backgroundColor: 'rgba(225, 48, 108, 0.12)', borderColor: '#E1306C' }]}>
                      <Ionicons name="logo-instagram" size={10} color="#E1306C" />
                      <Text style={[typography.micro, { color: '#E1306C', fontSize: 9, marginLeft: 2, fontWeight: '700' }]}>Instagram</Text>
                    </View>
                  ) : item.platform === 'facebook' || item.sourceUrl?.includes('facebook.com') || item.sourceUrl?.includes('fb.watch') || item.sourceUrl?.includes('fb.com') ? (
                    <View style={[styles.platformChipSmall, { backgroundColor: 'rgba(24, 119, 242, 0.12)', borderColor: '#1877F2' }]}>
                      <Ionicons name="logo-facebook" size={10} color="#1877F2" />
                      <Text style={[typography.micro, { color: '#1877F2', fontSize: 9, marginLeft: 2, fontWeight: '700' }]}>Facebook</Text>
                    </View>
                  ) : (
                    <View style={[styles.platformChipSmall, { backgroundColor: 'rgba(6, 182, 212, 0.12)', borderColor: '#06B6D4' }]}>
                      <Ionicons name="musical-notes" size={10} color="#06B6D4" />
                      <Text style={[typography.micro, { color: '#06B6D4', fontSize: 9, marginLeft: 2, fontWeight: '700' }]}>TikTok</Text>
                    </View>
                  )}
                  {item.format === 'mp3' || item.format === 'm4a' ? (
                    <View style={[styles.platformChipSmall, { backgroundColor: 'rgba(168, 85, 247, 0.12)', borderColor: '#A855F7' }]}>
                      <Text style={[typography.micro, { color: '#A855F7', fontSize: 9, fontWeight: '700' }]}>MP3 Audio</Text>
                    </View>
                  ) : item.quality ? (
                    <View style={[styles.platformChipSmall, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}>
                      <Text style={[typography.micro, { color: colors.textSecondary, fontSize: 9, fontWeight: '600' }]}>{item.quality}</Text>
                    </View>
                  ) : null}

                  {item.fileExists === false && (
                    <View style={[styles.platformChipSmall, { backgroundColor: colors.dangerLight, borderColor: colors.dangerBorder }]}>
                      <Ionicons name="alert-circle" size={9} color={colors.danger} />
                      <Text style={[typography.micro, { color: colors.danger, fontSize: 9, marginLeft: 2, fontWeight: '700' }]}>Missing</Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600', lineHeight: 20 }]}
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

              {/* 3-Dots Action Menu with 48dp Android Touch Target */}
              <Pressable
                onPress={() => {
                  setSelectedItem(item);
                  setShowItemMenu(true);
                }}
                style={styles.dotsButton}
                android_ripple={{ color: colors.ripple, borderless: true, radius: 24 }}
                accessibilityRole="button"
                accessibilityLabel="Video options"
                hitSlop={8}
              >
                <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
              </Pressable>
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* Theme-Aware Delete Single Video Dialog */}
      <ConfirmDialog
        visible={!!itemToDelete}
        title="Delete from Device?"
        message={`Permanently delete "${itemToDelete?.title || 'this video'}" and its file from storage?`}
        icon="trash-outline"
        confirmDestructive
        confirmText="Delete"
        cancelText="Cancel"
        onCancel={() => setItemToDelete(null)}
        onConfirm={async () => {
          if (itemToDelete) {
            await deleteHistoryEntryAndFile(itemToDelete.id);
            setItemToDelete(null);
            loadHistory();
          }
        }}
      />

      {/* Theme-Aware Clear All History Dialog */}
      <ConfirmDialog
        visible={showClearAllDialog}
        title="Clear All History?"
        message="Permanently delete all downloaded videos and history? This cannot be undone."
        icon="trash-outline"
        confirmDestructive
        confirmText="Clear All"
        cancelText="Cancel"
        onCancel={() => setShowClearAllDialog(false)}
        onConfirm={async () => {
          await clearHistoryAndFiles();
          setShowClearAllDialog(false);
          loadHistory();
        }}
      />

      {/* Theme-Aware Info Dialog (Replaces white system Alert.alert) */}
      <ConfirmDialog
        visible={!!infoDialog}
        title={infoDialog?.title || ''}
        message={infoDialog?.message || ''}
        icon={infoDialog?.icon}
        iconColor={infoDialog?.iconColor}
        cancelText={null}
        confirmText="Got it"
        onConfirm={() => setInfoDialog(null)}
      />

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
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm + 2,
    minHeight: 42,
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
    height: 38,
    paddingVertical: 0,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm + 4,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: 42,
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
  clearSearchBtn: {
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotsButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
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
