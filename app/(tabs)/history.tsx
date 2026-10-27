import { useState, useCallback, useMemo, useRef, memo } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, Image, TextInput } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { EmptyState } from '../../src/components/EmptyState';
import { IconButton } from '../../src/components/IconButton';
import { BottomSheetMenu, SheetAction } from '../../src/components/BottomSheetMenu';
import {
  getHistory,
  removeHistoryEntryOnly,
  deleteHistoryEntryAndFile,
  clearHistoryEntriesOnly,
  clearHistoryAndFiles,
  checkHistoryFilesExist,
} from '../../src/storage/historyStore';
import { shareSavedMedia } from '../../src/services/mediaManager';
import { formatBytes, formatShortDate } from '../../src/utils/formatters';
import { HistoryItem } from '../../src/types';

const ROW_HEIGHT = 84;
const THUMB_W = 44;
const THUMB_H = 58;
const VERIFY_BATCH = 12;

const sameList = (a: HistoryItem[], b: HistoryItem[]) =>
  a.length === b.length && a.every((it, i) => it.id === b[i]!.id && it.fileUri === b[i]!.fileUri);

interface RowProps {
  item: HistoryItem;
  missing: boolean;
  onShare: (item: HistoryItem) => void;
  onRedownload: (item: HistoryItem) => void;
  onMore: (item: HistoryItem) => void;
}

const LibraryRow = memo(function LibraryRow({ item, missing, onShare, onRedownload, onMore }: RowProps) {
  const { colors } = useTheme();
  const meta = [formatShortDate(item.savedAt), formatBytes(item.fileSizeBytes), item.author]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.row, { borderBottomColor: colors.outlineVariant }]}>
      <View style={[styles.thumb, { backgroundColor: colors.surfaceContainer }]}>
        {item.thumbnailUrl ? (
          <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbImg} resizeMode="cover" />
        ) : (
          <Ionicons name="videocam-outline" size={20} color={colors.textMuted} />
        )}
      </View>

      <View style={styles.rowMain}>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={2}>
          {item.title || 'Saved video'}
        </Text>
        <Text
          style={[typography.bodySmall, { color: missing ? colors.warning : colors.textSecondary }]}
          numberOfLines={1}
        >
          {missing ? 'File not found on this device' : meta}
        </Text>
      </View>

      {missing ? (
        <IconButton
          icon="download-outline"
          label={`Re-download ${item.title}`}
          color={colors.primary}
          onPress={() => onRedownload(item)}
        />
      ) : (
        <IconButton
          icon="share-outline"
          label={`Share ${item.title}`}
          color={colors.primary}
          onPress={() => onShare(item)}
        />
      )}
      <IconButton
        icon="ellipsis-vertical"
        label={`More options for ${item.title}`}
        onPress={() => onMore(item)}
      />
    </View>
  );
});

export default function HistoryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [missing, setMissing] = useState<Record<string, boolean>>({});
  const [menuItem, setMenuItem] = useState<HistoryItem | null>(null);
  const [libraryMenu, setLibraryMenu] = useState(false);

  // Files are verified lazily, only for rows that scroll into view, and only once per visit.
  const checked = useRef(new Set<string>());
  const itemsRef = useRef<HistoryItem[]>([]);
  itemsRef.current = items;

  const verify = useCallback(async (candidates: HistoryItem[]) => {
    const todo = candidates.filter((c) => !checked.current.has(c.id)).slice(0, VERIFY_BATCH);
    if (todo.length === 0) return;
    todo.forEach((t) => checked.current.add(t.id));
    const result = await checkHistoryFilesExist(todo);
    setMissing((prev) => {
      const next = { ...prev };
      for (const t of todo) next[t.id] = result[t.id] === false;
      return next;
    });
  }, []);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: { item: unknown }[] }) => {
    verify(viewableItems.map((v) => v.item as HistoryItem));
  }).current;

  const refresh = useCallback(async () => {
    const list = await getHistory(false);
    setItems((prev) => (sameList(prev, list) ? prev : list));
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      checked.current.clear();
      refresh();
    }, [refresh])
  );

  const totalBytes = useMemo(() => items.reduce((n, it) => n + (it.fileSizeBytes || 0), 0), [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.author.toLowerCase().includes(q) ||
        (it.sourceUrl ? it.sourceUrl.toLowerCase().includes(q) : false)
    );
  }, [items, query]);

  const handleShare = useCallback((item: HistoryItem) => {
    shareSavedMedia(item.fileUri);
  }, []);

  // Re-download: send the saved source link back to Home so the normal resolve/preview flow runs.
  const handleRedownload = useCallback(
    (item: HistoryItem) => {
      router.navigate({ pathname: '/', params: { prefill: item.sourceUrl, ts: String(Date.now()) } });
    },
    [router]
  );

  const removeRecord = useCallback(async (item: HistoryItem) => {
    setItems(await removeHistoryEntryOnly(item.id));
  }, []);

  const confirmDeleteFile = useCallback((item: HistoryItem) => {
    Alert.alert(
      'Delete video file?',
      `"${item.title}" will be permanently deleted from this device and removed from your library. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete file',
          style: 'destructive',
          onPress: async () => setItems(await deleteHistoryEntryAndFile(item.id)),
        },
      ]
    );
  }, []);

  const itemActions = useCallback(
    (item: HistoryItem): SheetAction[] => [
      ...(missing[item.id]
        ? [{ key: 'redl', label: 'Re-download', icon: 'download-outline' as const, onPress: () => handleRedownload(item) }]
        : [{ key: 'share', label: 'Share', icon: 'share-outline' as const, onPress: () => handleShare(item) }]),
      {
        key: 'remove',
        label: 'Remove from library (keep file)',
        icon: 'remove-circle-outline',
        onPress: () => removeRecord(item),
      },
      {
        key: 'delete',
        label: 'Delete video file…',
        icon: 'trash-outline',
        destructive: true,
        onPress: () => confirmDeleteFile(item),
      },
    ],
    [missing, handleRedownload, handleShare, removeRecord, confirmDeleteFile]
  );

  const clearLibrary = useCallback(() => {
    Alert.alert('Clear library', 'What should be cleared?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Records only (keep files)',
        onPress: async () => {
          await clearHistoryEntriesOnly();
          refresh();
        },
      },
      {
        text: 'Records and video files…',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            'Delete all saved videos?',
            'Every saved video file in your library will be permanently deleted from this device. This can’t be undone.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete everything',
                style: 'destructive',
                onPress: async () => {
                  await clearHistoryAndFiles();
                  refresh();
                },
              },
            ]
          ),
      },
    ]);
  }, [refresh]);

  const renderItem = useCallback(
    ({ item }: { item: HistoryItem }) => (
      <LibraryRow
        item={item}
        missing={missing[item.id] === true}
        onShare={handleShare}
        onRedownload={handleRedownload}
        onMore={setMenuItem}
      />
    ),
    [missing, handleShare, handleRedownload]
  );

  const subtitle = `${items.length} ${items.length === 1 ? 'video' : 'videos'} · ${formatBytes(totalBytes)}`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Text style={[typography.titleLarge, { color: colors.textPrimary }]}>History</Text>
          {items.length > 0 ? (
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{subtitle}</Text>
          ) : null}
        </View>
        {items.length > 0 ? (
          <>
            <IconButton
              icon={searchOpen ? 'close' : 'search'}
              label={searchOpen ? 'Close search' : 'Search history'}
              onPress={() => {
                if (searchOpen) setQuery('');
                setSearchOpen(!searchOpen);
              }}
            />
            <IconButton icon="ellipsis-vertical" label="Library options" onPress={() => setLibraryMenu(true)} />
          </>
        ) : null}
      </View>

      {searchOpen ? (
        <View style={[styles.search, { backgroundColor: colors.surfaceContainer }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search title, creator or link"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search history"
          />
        </View>
      ) : null}

      <FlatList
        data={visible}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50, minimumViewTime: 150 }}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loaded ? (
            query ? (
              <EmptyState
                iconName="search-outline"
                title="No matches"
                description={`Nothing in your history matches "${query}".`}
              />
            ) : (
              <EmptyState
                iconName="albums-outline"
                title="Nothing saved yet"
                description="Videos you download are listed here so you can share them again."
                actionTitle="Go to Home"
                onAction={() => router.navigate('/')}
              />
            )
          ) : (
            <View />
          )
        }
      />

      <BottomSheetMenu
        visible={menuItem !== null}
        {...(menuItem ? { title: menuItem.title } : {})}
        actions={menuItem ? itemActions(menuItem) : []}
        onClose={() => setMenuItem(null)}
      />
      <BottomSheetMenu
        visible={libraryMenu}
        actions={[
          { key: 'clear', label: 'Clear library…', icon: 'trash-outline', destructive: true, onPress: clearLibrary },
        ]}
        onClose={() => setLibraryMenu(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    minHeight: 64,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: { flex: 1 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 48,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0, minHeight: 44 },
  listContent: { paddingBottom: spacing.xxxl },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: {
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: { width: THUMB_W, height: THUMB_H },
  rowMain: { flex: 1, marginHorizontal: spacing.md },
});
