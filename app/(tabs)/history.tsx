import { useState, useCallback, useMemo, useRef, memo } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, Image, TextInput, Pressable, Dimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { BottomSheetMenu, SheetAction } from '../../src/components/BottomSheetMenu';
import {
  getHistory,
  removeHistoryEntryOnly,
  deleteHistoryEntryAndFile,
  checkHistoryFilesExist,
} from '../../src/storage/historyStore';
import { shareSavedMedia } from '../../src/services/mediaManager';
import { formatBytes, formatDuration, formatShortDate } from '../../src/utils/formatters';
import { HistoryItem } from '../../src/types';

const VERIFY_BATCH = 12;
const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_ITEM_WIDTH = (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm) / 2;

interface RowProps {
  item: HistoryItem;
  missing: boolean;
  onShare: (item: HistoryItem) => void;
  onRedownload: (item: HistoryItem) => void;
  onMore: (item: HistoryItem) => void;
}

/** Grid Item: Visual TikTok-style 2-column card */
const GridItem = memo(function GridItem({ item, missing, onShare, onRedownload, onMore }: RowProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.gridCard,
        {
          width: GRID_ITEM_WIDTH,
          backgroundColor: colors.surfaceContainer,
          borderColor: missing ? colors.warning : colors.outlineVariant,
        },
      ]}
    >
      <View style={[styles.gridThumbContainer, { backgroundColor: colors.surface }]}>
        {item.thumbnailUrl ? (
          <Image source={{ uri: item.thumbnailUrl }} style={styles.gridThumbImage} resizeMode="cover" />
        ) : (
          <Ionicons name="film-outline" size={32} color={colors.textMuted} />
        )}

        {item.durationSeconds ? (
          <View style={styles.gridDurationPill}>
            <Text style={styles.gridDurationText}>{formatDuration(item.durationSeconds)}</Text>
          </View>
        ) : null}

        {missing ? (
          <View style={[styles.gridMissingBadge, { backgroundColor: colors.warning }]}>
            <Text style={styles.gridMissingText}>File Missing</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.gridMetaContainer}>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]} numberOfLines={2}>
          {item.title || 'Saved Video'}
        </Text>
        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
          {formatBytes(item.fileSizeBytes)} {item.author ? `· @${item.author}` : ''}
        </Text>

        <View style={styles.gridActionRow}>
          {missing ? (
            <Pressable
              onPress={() => onRedownload(item)}
              style={[styles.gridActionPill, { backgroundColor: colors.primaryContainer }]}
              accessibilityRole="button"
              accessibilityLabel={`Re-download ${item.title}`}
            >
              <Ionicons name="download-outline" size={14} color={colors.primary} />
              <Text style={[typography.labelMedium, { color: colors.primary, marginLeft: 4 }]}>Re-fetch</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => onShare(item)}
              style={[styles.gridActionPill, { backgroundColor: colors.primaryLight }]}
              accessibilityRole="button"
              accessibilityLabel={`Share ${item.title}`}
            >
              <Ionicons name="share-outline" size={14} color={colors.primary} />
              <Text style={[typography.labelMedium, { color: colors.primary, marginLeft: 4 }]}>Share</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => onMore(item)}
            style={styles.gridMoreBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`More options for ${item.title}`}
          >
            <Ionicons name="ellipsis-vertical" size={16} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

/** List Item: Detailed row view */
const ListItem = memo(function ListItem({ item, missing, onShare, onRedownload, onMore }: RowProps) {
  const { colors } = useTheme();
  const meta = [formatShortDate(item.savedAt), formatBytes(item.fileSizeBytes), item.author ? `@${item.author}` : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.listRow, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
      <View style={[styles.listThumb, { backgroundColor: colors.surface }]}>
        {item.thumbnailUrl ? (
          <Image source={{ uri: item.thumbnailUrl }} style={styles.listThumbImg} resizeMode="cover" />
        ) : (
          <Ionicons name="videocam-outline" size={22} color={colors.textMuted} />
        )}
        {item.durationSeconds ? (
          <View style={styles.listDurationBadge}>
            <Text style={styles.durationText}>{formatDuration(item.durationSeconds)}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.listMeta}>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]} numberOfLines={2}>
          {item.title || 'Saved Video'}
        </Text>
        <Text
          style={[typography.bodySmall, { color: missing ? colors.warning : colors.textSecondary, marginTop: 2 }]}
          numberOfLines={1}
        >
          {missing ? 'File moved or deleted from storage' : meta}
        </Text>
      </View>

      <View style={styles.listActions}>
        {missing ? (
          <Pressable
            onPress={() => onRedownload(item)}
            style={[styles.iconCircle, { backgroundColor: colors.primaryContainer }]}
            accessibilityRole="button"
            accessibilityLabel={`Re-download ${item.title}`}
          >
            <Ionicons name="download-outline" size={16} color={colors.primary} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => onShare(item)}
            style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}
            accessibilityRole="button"
            accessibilityLabel={`Share ${item.title}`}
          >
            <Ionicons name="share-outline" size={16} color={colors.primary} />
          </Pressable>
        )}

        <Pressable
          onPress={() => onMore(item)}
          style={[styles.iconCircle, { backgroundColor: colors.surface, marginLeft: spacing.xs }]}
          accessibilityRole="button"
          accessibilityLabel={`More options for ${item.title}`}
        >
          <Ionicons name="ellipsis-vertical" size={16} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
});

export default function HistoryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterMode, setFilterMode] = useState<'all' | 'available' | 'missing'>('all');
  const [missing, setMissing] = useState<Record<string, boolean>>({});
  const [menuItem, setMenuItem] = useState<HistoryItem | null>(null);

  const verifiedRef = useRef(new Set<string>());

  const reload = useCallback(async () => {
    const list = await getHistory(false);
    setItems(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  // Lazy batch file-existence verification
  const verifySlice = useCallback(
    async (batch: HistoryItem[]) => {
      const needed = batch.filter((it) => !verifiedRef.current.has(it.id));
      if (needed.length === 0) return;
      for (const it of needed) verifiedRef.current.add(it.id);

      const existsMap = await checkHistoryFilesExist(needed);
      setMissing((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [id, exists] of Object.entries(existsMap)) {
          const isMiss = !exists;
          if (next[id] !== isMiss) {
            next[id] = isMiss;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    },
    []
  );

  // Filter items
  const filtered = useMemo(() => {
    let result = items;
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (it) => it.title.toLowerCase().includes(q) || (it.author && it.author.toLowerCase().includes(q))
      );
    }
    if (filterMode === 'available') {
      result = result.filter((it) => !missing[it.id]);
    } else if (filterMode === 'missing') {
      result = result.filter((it) => Boolean(missing[it.id]));
    }
    return result;
  }, [items, query, filterMode, missing]);

  // Initial slice verify
  useFocusEffect(
    useCallback(() => {
      if (items.length > 0) {
        verifySlice(items.slice(0, VERIFY_BATCH));
      }
    }, [items, verifySlice])
  );

  const totalBytes = useMemo(() => {
    return items.reduce((acc, it) => acc + (it.fileSizeBytes || 0), 0);
  }, [items]);

  const handleShare = useCallback((item: HistoryItem) => {
    shareSavedMedia(item.fileUri);
  }, []);

  const handleRedownload = useCallback(
    (item: HistoryItem) => {
      router.push({
        pathname: '/(tabs)',
        params: { prefill: item.sourceUrl, ts: String(Date.now()) },
      });
    },
    [router]
  );

  const handleMore = useCallback((item: HistoryItem) => {
    setMenuItem(item);
  }, []);

  const sheetActions = useMemo<SheetAction[]>(() => {
    if (!menuItem) return [];
    const isMissing = Boolean(missing[menuItem.id]);
    const actions: SheetAction[] = [];

    if (!isMissing) {
      actions.push({
        key: 'share',
        label: 'Share Video',
        icon: 'share-outline',
        onPress: () => shareSavedMedia(menuItem.fileUri),
      });
    }

    actions.push({
      key: 'redownload',
      label: 'Re-download Video',
      icon: 'download-outline',
      onPress: () => handleRedownload(menuItem),
    });

    actions.push({
      key: 'remove-record',
      label: 'Remove from Library',
      icon: 'bookmark-outline',
      onPress: async () => {
        await removeHistoryEntryOnly(menuItem.id);
        setItems((prev) => prev.filter((i) => i.id !== menuItem.id));
      },
    });

    if (!isMissing) {
      actions.push({
        key: 'delete-file',
        label: 'Delete Video File from Device',
        icon: 'trash-outline',
        destructive: true,
        onPress: () => {
          Alert.alert(
            'Delete Video File?',
            `"${menuItem.title}" will be permanently deleted from your phone's storage.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete File',
                style: 'destructive',
                onPress: async () => {
                  await deleteHistoryEntryAndFile(menuItem.id);
                  setItems((prev) => prev.filter((i) => i.id !== menuItem.id));
                },
              },
            ]
          );
        },
      });
    }

    return actions;
  }, [menuItem, missing, handleRedownload]);

  const renderItem = useCallback(
    ({ item }: { item: HistoryItem }) =>
      viewMode === 'grid' ? (
        <GridItem
          item={item}
          missing={Boolean(missing[item.id])}
          onShare={handleShare}
          onRedownload={handleRedownload}
          onMore={handleMore}
        />
      ) : (
        <ListItem
          item={item}
          missing={Boolean(missing[item.id])}
          onShare={handleShare}
          onRedownload={handleRedownload}
          onMore={handleMore}
        />
      ),
    [viewMode, missing, handleShare, handleRedownload, handleMore]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Top Header Bar */}
      <View style={[styles.topBar, { borderBottomColor: colors.outlineVariant }]}>
        <View>
          <Text style={[typography.titleLarge, { color: colors.textPrimary }]}>Library</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 1 }]}>
            {items.length} saved · {formatBytes(totalBytes)}
          </Text>
        </View>

        <View style={styles.topBarActions}>
          <Pressable
            onPress={() => setSearchOpen((prev) => !prev)}
            style={styles.headerIconBtn}
            accessibilityRole="button"
            accessibilityLabel="Search library"
          >
            <Ionicons name="search-outline" size={20} color={searchOpen ? colors.primary : colors.textSecondary} />
          </Pressable>

          <Pressable
            onPress={() => setViewMode((prev) => (prev === 'grid' ? 'list' : 'grid'))}
            style={[styles.headerIconBtn, { backgroundColor: colors.surfaceContainer }]}
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
          >
            <Ionicons
              name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'}
              size={18}
              color={colors.primary}
            />
          </Pressable>
        </View>
      </View>

      {/* Expandable Search Input */}
      {searchOpen && (
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by title or author..."
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            autoFocus
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      )}

      {/* Filter Chips Bar */}
      <View style={styles.filterBar}>
        <Pressable
          onPress={() => setFilterMode('all')}
          style={[
            styles.filterChip,
            {
              backgroundColor: filterMode === 'all' ? colors.primaryContainer : colors.surfaceContainer,
              borderColor: filterMode === 'all' ? colors.primary : colors.outlineVariant,
            },
          ]}
        >
          <Text style={[typography.labelMedium, { color: filterMode === 'all' ? colors.primary : colors.textSecondary }]}>
            All ({items.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilterMode('available')}
          style={[
            styles.filterChip,
            {
              backgroundColor: filterMode === 'available' ? colors.primaryContainer : colors.surfaceContainer,
              borderColor: filterMode === 'available' ? colors.primary : colors.outlineVariant,
            },
          ]}
        >
          <Text style={[typography.labelMedium, { color: filterMode === 'available' ? colors.primary : colors.textSecondary }]}>
            On Device
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilterMode('missing')}
          style={[
            styles.filterChip,
            {
              backgroundColor: filterMode === 'missing' ? colors.warningLight : colors.surfaceContainer,
              borderColor: filterMode === 'missing' ? colors.warning : colors.outlineVariant,
            },
          ]}
        >
          <Text style={[typography.labelMedium, { color: filterMode === 'missing' ? colors.warning : colors.textSecondary }]}>
            Missing
          </Text>
        </Pressable>
      </View>

      {/* Media FlatList (Grid or List) */}
      {filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconBox, { backgroundColor: colors.surfaceContainer }]}>
            <Ionicons name="film-outline" size={36} color={colors.textMuted} />
          </View>
          <Text style={[typography.titleMedium, { color: colors.textPrimary, marginTop: spacing.md }]}>
            {query ? 'No Videos Match Search' : 'Your Library is Empty'}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, textAlign: 'center', marginTop: 4, maxWidth: 260 }]}>
            {query
              ? 'Try searching with a different title or username.'
              : 'Downloaded videos will be organized here and saved in your device gallery.'}
          </Text>
          {!query && (
            <Pressable
              onPress={() => router.push('/(tabs)')}
              style={[styles.emptyActionBtn, { backgroundColor: colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Download videos"
            >
              <Ionicons name="download-outline" size={18} color="#FFFFFF" />
              <Text style={[typography.labelMedium, { color: '#FFFFFF', marginLeft: 6 }]}>Download Videos</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          key={viewMode} // Re-mount when switching between 1-column list and 2-column grid
          data={filtered}
          numColumns={viewMode === 'grid' ? 2 : 1}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={viewMode === 'grid' ? styles.gridRowWrapper : undefined}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            verifySlice(filtered.slice(0, verifiedRef.current.size + VERIFY_BATCH));
          }}
          onEndReachedThreshold={0.5}
        />
      )}

      {/* Bottom Sheet Menu */}
      <BottomSheetMenu
        visible={Boolean(menuItem)}
        title={menuItem?.title || 'Saved Video'}
        actions={sheetActions}
        onClose={() => setMenuItem(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: 14,
    paddingVertical: 4,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  gridRowWrapper: {
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  gridCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  gridThumbContainer: {
    width: '100%',
    height: GRID_ITEM_WIDTH * 1.25, // Sleek vertical short-form aspect ratio
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  gridThumbImage: {
    width: '100%',
    height: '100%',
  },
  gridDurationPill: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  gridDurationText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
  },
  gridMissingBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  gridMissingText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '700',
  },
  gridMetaContainer: {
    padding: spacing.sm,
  },
  gridActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  gridActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  gridMoreBtn: {
    padding: 4,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  listThumb: {
    width: 48,
    height: 62,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  listThumbImg: {
    width: '100%',
    height: '100%',
  },
  listDurationBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
  },
  listMeta: {
    flex: 1,
    marginLeft: spacing.md,
  },
  listActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
});
