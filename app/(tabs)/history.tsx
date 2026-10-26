import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  Image,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { ScreenHeader } from '../../src/components/ScreenHeader';
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

export default function HistoryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const refreshHistory = useCallback(async () => {
    setLoading(true);
    const items = await getHistory();
    setHistoryItems(items);
    setLoading(false);
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

  const handleDeleteItem = (item: HistoryItem) => {
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
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear Saved Library',
      'Choose how you want to clear your saved items:',
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
  };

  const renderHistoryItem = ({ item }: { item: HistoryItem }) => {
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
        {/* 16:9 Cinematic Thumbnail Container */}
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
              <Ionicons name="videocam" size={24} color={colors.textMuted} />
            </View>
          )}

          {item.durationSeconds !== undefined && item.durationSeconds > 0 && (
            <View style={styles.durationPill}>
              <Text style={[typography.micro, { color: '#FFFFFF', fontSize: 10 }]}>
                {Math.floor(item.durationSeconds / 60)}:
                {String(Math.floor(item.durationSeconds % 60)).padStart(2, '0')}
              </Text>
            </View>
          )}
        </View>

        {/* Info Column */}
        <View style={styles.infoCol}>
          <Text style={[typography.titleSmall, { color: colors.textPrimary }]} numberOfLines={2}>
            {item.title || 'Untitled Video'}
          </Text>

          <View style={styles.creatorMetaRow}>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.author || 'Creator'}
            </Text>
          </View>

          <View style={styles.detailsRow}>
            <Text style={[typography.labelMedium, { color: colors.textMuted }]}>
              {formatBytes(item.fileSizeBytes)}
            </Text>
            <Text style={[typography.labelMedium, { color: colors.textMuted }]}>•</Text>
            <Text style={[typography.labelMedium, { color: colors.textMuted }]}>
              {formatDate(item.savedAt)}
            </Text>
          </View>

          {!item.fileExists && (
            <View style={[styles.missingPill, { backgroundColor: colors.warningLight }]}>
              <Ionicons name="warning-outline" size={12} color={colors.warning} />
              <Text style={[typography.micro, { color: colors.warning, marginLeft: 4 }]}>
                File deleted from storage
              </Text>
            </View>
          )}
        </View>

        {/* Action Controls Cluster */}
        <View style={styles.actionCluster}>
          {item.fileExists ? (
            <Pressable
              onPress={() => shareSavedMedia(item.fileUri)}
              android_ripple={{ color: colors.ripple, borderless: true, radius: 24 }}
              style={[
                styles.iconActionBtn,
                { backgroundColor: colors.primaryContainer || colors.primaryLight },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Share or send ${item.title} to gallery`}
            >
              <Ionicons name="share-social" size={18} color={colors.primary} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push('/')}
              android_ripple={{ color: colors.ripple, borderless: true, radius: 24 }}
              style={[styles.iconActionBtn, { backgroundColor: colors.surfaceContainerHigh || colors.surfaceElevated }]}
              accessibilityRole="button"
              accessibilityLabel={`Re-download ${item.title}`}
            >
              <Ionicons name="download-outline" size={18} color={colors.primary} />
            </Pressable>
          )}

          <Pressable
            onPress={() => handleDeleteItem(item)}
            android_ripple={{ color: colors.ripple, borderless: true, radius: 24 }}
            style={[styles.iconActionBtn, { backgroundColor: colors.surfaceContainerLow || colors.surfaceElevated }]}
            accessibilityRole="button"
            accessibilityLabel={`Delete options for ${item.title}`}
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScreenHeader
        title="Saved Library"
        subtitle={`${historyItems.length} videos • ${formatBytes(totalStorageBytes)}`}
        rightAction={
          historyItems.length > 0
            ? {
                label: 'Clear',
                icon: 'trash-outline',
                destructive: true,
                onPress: handleClearAll,
                accessibilityLabel: 'Clear history records or files',
              }
            : undefined
        }
      />

      {/* Instant Search Bar */}
      {historyItems.length > 0 && (
        <View style={styles.searchBarWrapper}>
          <View
            style={[
              styles.searchInputContainer,
              {
                backgroundColor: colors.surfaceContainerLow || colors.inputBackground,
                borderColor: colors.outlineVariant || colors.surfaceBorder,
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
              accessibilityLabel="Search saved videos"
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery('')}
                android_ripple={{ color: colors.ripple, borderless: true, radius: 18 }}
                style={styles.clearSearchBtn}
                accessibilityRole="button"
                accessibilityLabel="Clear search query"
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {historyItems.length === 0 ? (
        <EmptyState
          iconName="film-outline"
          title="Library is Empty"
          description="Videos you resolve and download will be organized here with instant playback, sharing, and storage controls."
          actionTitle="Download a Video"
          actionIcon="arrow-down-circle"
          onAction={() => router.push('/(tabs)')}
        />
      ) : filteredItems.length === 0 ? (
        <View style={styles.noSearchResults}>
          <Ionicons name="search-outline" size={40} color={colors.textMuted} />
          <Text style={[typography.titleMedium, { color: colors.textPrimary, marginTop: spacing.md }]}>
            No videos match "{searchQuery}"
          </Text>
          <Button
            title="Clear Search"
            onPress={() => setSearchQuery('')}
            variant="secondary"
            size="sm"
            style={{ marginTop: spacing.md }}
          />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={renderHistoryItem}
          contentContainerStyle={styles.listContent}
          onRefresh={refreshHistory}
          refreshing={loading}
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
  searchBarWrapper: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 46,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: spacing.xs,
  },
  clearSearchBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  mediaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  thumbnailWrapper: {
    width: 86,
    height: 56,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
    marginRight: spacing.md,
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: borderRadius.xs,
  },
  infoCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  creatorMetaRow: {
    marginTop: 2,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 3,
  },
  missingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  actionCluster: {
    flexDirection: 'column',
    gap: spacing.xs,
    alignItems: 'center',
  },
  iconActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noSearchResults: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
});
