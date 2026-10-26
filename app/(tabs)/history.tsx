import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  Image,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { EmptyState } from '../../src/components/EmptyState';
import {
  getHistory,
  removeHistoryEntryOnly,
  deleteHistoryEntryAndFile,
  clearHistoryEntriesOnly,
  clearHistoryAndFiles,
} from '../../src/storage/historyStore';
import { shareSavedMedia } from '../../src/services/mediaManager';
import { formatBytes, formatDate } from '../../src/utils/formatters';
import { HistoryItem } from '../../src/types';

const ITEM_HEIGHT = 84;

// Memoized individual media row for fast scrolling & zero rerender of offscreen items
const HistoryItemRow = memo(({
  item,
  onShare,
  onDelete,
  onRedownload,
}: {
  item: HistoryItem;
  onShare: (uri: string) => void;
  onDelete: (item: HistoryItem) => void;
  onRedownload: () => void;
}) => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.mediaRow,
        {
          backgroundColor: colors.surfaceContainerLowest || colors.surface,
          borderColor: colors.outlineVariant || colors.surfaceBorder,
        },
      ]}
    >
      {/* Media Thumbnail Container */}
      <View
        style={[
          styles.thumbnailWrapper,
          { backgroundColor: colors.surfaceContainerLow || colors.surfaceElevated },
        ]}
      >
        {item.thumbnailUrl ? (
          <Image
            source={{ uri: item.thumbnailUrl }}
            style={styles.thumbnailImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons name="videocam-outline" size={22} color={colors.textMuted} />
          </View>
        )}

        {item.durationSeconds !== undefined && item.durationSeconds > 0 && (
          <View style={styles.durationPill}>
            <Text style={[typography.micro, { color: '#FFFFFF', fontSize: 9, fontWeight: '700' }]}>
              {Math.floor(item.durationSeconds / 60)}:
              {String(Math.floor(item.durationSeconds % 60)).padStart(2, '0')}
            </Text>
          </View>
        )}
      </View>

      {/* Info Column */}
      <View style={styles.infoCol}>
        <Text style={[typography.titleSmall, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.title || 'Saved Video'}
        </Text>
        <Text style={[typography.micro, { color: colors.textSecondary, marginTop: 1 }]} numberOfLines={1}>
          {item.author || 'Creator'} • {formatDate(item.savedAt)}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[typography.labelMedium, { color: colors.primary, fontWeight: '600' }]}>
            {formatBytes(item.fileSizeBytes)}
          </Text>
          {!item.fileExists && (
            <View style={[styles.missingTag, { backgroundColor: colors.warningLight }]}>
              <Text style={[typography.micro, { color: colors.warning, fontWeight: '700' }]}>
                FILE MOVED
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Action Controls */}
      <View style={styles.actionsCluster}>
        {item.fileExists ? (
          <Pressable
            onPress={() => onShare(item.fileUri)}
            android_ripple={{ color: colors.ripple, borderless: true, radius: 22 }}
            style={[styles.shareActionBtn, { backgroundColor: colors.primaryContainer || colors.primaryLight }]}
            accessibilityRole="button"
            accessibilityLabel={`Share or export ${item.title}`}
          >
            <Ionicons name="share-social-outline" size={17} color={colors.primary} />
          </Pressable>
        ) : (
          <Pressable
            onPress={onRedownload}
            android_ripple={{ color: colors.ripple, borderless: true, radius: 22 }}
            style={[styles.shareActionBtn, { backgroundColor: colors.surfaceContainerHigh || colors.surfaceElevated }]}
            accessibilityRole="button"
            accessibilityLabel={`Re-download ${item.title}`}
          >
            <Ionicons name="download-outline" size={17} color={colors.primary} />
          </Pressable>
        )}

        <Pressable
          onPress={() => onDelete(item)}
          android_ripple={{ color: colors.ripple, borderless: true, radius: 22 }}
          style={styles.deleteActionBtn}
          accessibilityRole="button"
          accessibilityLabel={`Delete options for ${item.title}`}
        >
          <Ionicons name="trash-outline" size={17} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
});
HistoryItemRow.displayName = 'HistoryItemRow';

export default function HistoryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const refreshHistory = useCallback(async () => {
    const items = await getHistory(false);
    setHistoryItems(items);
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const totalStorageBytes = useMemo(() => {
    return historyItems.reduce((acc, item) => acc + (item.fileSizeBytes || 0), 0);
  }, [historyItems]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return historyItems;
    return historyItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q) ||
        (item.sourceUrl && item.sourceUrl.toLowerCase().includes(q))
    );
  }, [historyItems, searchQuery]);

  const handleDeleteItem = useCallback((item: HistoryItem) => {
    Alert.alert(
      'Manage Saved Item',
      `Choose how you would like to handle "${item.title}":`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove from History (Keep File)',
          onPress: async () => {
            const updated = await removeHistoryEntryOnly(item.id);
            setHistoryItems(updated);
          },
        },
        {
          text: 'Permanently Delete Video File',
          style: 'destructive',
          onPress: async () => {
            const updated = await deleteHistoryEntryAndFile(item.id);
            setHistoryItems(updated);
          },
        },
      ]
    );
  }, []);

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Clear Saved Library',
      'Choose an action to clear your history:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear History Records Only',
          onPress: async () => {
            await clearHistoryEntriesOnly();
            refreshHistory();
          },
        },
        {
          text: 'Delete All Video Files & Records',
          style: 'destructive',
          onPress: async () => {
            await clearHistoryAndFiles();
            refreshHistory();
          },
        },
      ]
    );
  }, [refreshHistory]);

  const handleShare = useCallback((fileUri: string) => {
    shareSavedMedia(fileUri);
  }, []);

  const handleRedownload = useCallback(() => {
    router.push('/');
  }, [router]);

  const renderItem = useCallback(
    ({ item }: { item: HistoryItem }) => (
      <HistoryItemRow
        item={item}
        onShare={handleShare}
        onDelete={handleDeleteItem}
        onRedownload={handleRedownload}
      />
    ),
    [handleShare, handleDeleteItem, handleRedownload]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Top Media Library Utility Bar */}
      <View style={styles.topUtilityBar}>
        <View>
          <Text style={[typography.headlineMedium, { color: colors.textPrimary, letterSpacing: -0.3 }]}>
            Library
          </Text>
          <Text style={[typography.micro, { color: colors.textMuted }]}>
            {historyItems.length} {historyItems.length === 1 ? 'video' : 'videos'} • {formatBytes(totalStorageBytes)}
          </Text>
        </View>

        {historyItems.length > 0 && (
          <Pressable
            onPress={handleClearAll}
            android_ripple={{ color: colors.ripple, borderless: false }}
            style={[styles.clearBtn, { backgroundColor: colors.surfaceContainerLow || colors.surfaceElevated }]}
            accessibilityRole="button"
            accessibilityLabel="Clear library records or files"
          >
            <Ionicons name="trash-outline" size={14} color={colors.textSecondary} />
            <Text style={[typography.labelMedium, { color: colors.textSecondary, marginLeft: 4 }]}>
              Clear
            </Text>
          </Pressable>
        )}
      </View>

      {/* Instant Search Bar */}
      {historyItems.length > 0 && (
        <View style={styles.searchBarWrapper}>
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: colors.surfaceContainerLow || colors.inputBackground,
                borderColor: colors.outlineVariant || colors.inputBorder,
              },
            ]}
          >
            <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Search saved videos or creators..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              accessibilityLabel="Search saved videos"
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery('')}
                style={styles.searchClearBtn}
                accessibilityRole="button"
                accessibilityLabel="Clear search text"
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Virtualized Media Library List */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            iconName="videocam-outline"
            title={searchQuery ? 'No matching videos' : 'No saved videos yet'}
            description={
              searchQuery
                ? `No videos match "${searchQuery}". Try a different search term.`
                : 'Downloaded TikTok videos will appear here ready to open or share.'
            }
            actionTitle={!searchQuery ? 'Download a Video' : undefined}
            onAction={!searchQuery ? () => router.push('/') : undefined}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topUtilityBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
  },
  searchBarWrapper: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
  },
  mediaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ITEM_HEIGHT - 8,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: 8,
  },
  thumbnailWrapper: {
    width: 58,
    height: 58,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
    marginRight: spacing.sm,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationPill: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: spacing.xs,
  },
  missingTag: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  actionsCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: spacing.xs,
  },
  shareActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
