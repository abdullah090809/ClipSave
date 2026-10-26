import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
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

export default function HistoryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshHistory = useCallback(async () => {
    setLoading(true);
    const items = await getHistory();
    setHistoryItems(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const handleDeleteItem = (item: HistoryItem) => {
    Alert.alert(
      'Delete Item',
      `Choose how you would like to remove "${item.title}":`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove from History Only',
          onPress: async () => {
            const updated = await removeHistoryEntryOnly(item.id);
            setHistoryItems(updated);
          },
        },
        {
          text: 'Delete File from Device',
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
      'Clear History',
      'What would you like to clear?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Records Only',
          onPress: async () => {
            await clearHistoryEntriesOnly();
            refreshHistory();
          },
        },
        {
          text: 'Delete All Saved Files & Records',
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
      <Card style={styles.itemCard}>
        <View style={styles.cardRow}>
          {item.thumbnailUrl ? (
            <Image
              source={{ uri: item.thumbnailUrl }}
              style={[styles.thumbnail, { backgroundColor: colors.surfaceElevated }]}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailPlaceholder, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="videocam" size={24} color={colors.textMuted} />
            </View>
          )}

          <View style={styles.infoArea}>
            <Text style={[typography.h3, { color: colors.textPrimary }]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              {item.author}
            </Text>

            <View style={styles.metaRow}>
              <Text style={[typography.micro, { color: colors.textMuted }]}>
                {formatBytes(item.fileSizeBytes)}
              </Text>
              <Text style={[typography.micro, { color: colors.textMuted }]}>•</Text>
              <Text style={[typography.micro, { color: colors.textMuted }]}>
                {formatDate(item.savedAt)}
              </Text>
            </View>

            {!item.fileExists && (
              <View style={styles.missingBadge}>
                <Ionicons name="warning-outline" size={14} color={colors.warning} />
                <Text style={[typography.caption, { color: colors.warning, marginLeft: 4 }]}>
                  File moved or deleted
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.actionsRow}>
          {item.fileExists ? (
            <Button
              title="Share / Open"
              icon={<Ionicons name="share-outline" size={16} color={colors.textPrimary} />}
              onPress={() => shareSavedMedia(item.fileUri)}
              variant="secondary"
              style={styles.actionBtn}
            />
          ) : (
            <Button
              title="Re-download"
              icon={<Ionicons name="download-outline" size={16} color={colors.primary} />}
              onPress={() => {
                router.push({
                  pathname: '/',
                });
              }}
              variant="outline"
              style={styles.actionBtn}
            />
          )}

          <Button
            title="Delete"
            icon={<Ionicons name="trash-outline" size={16} color={colors.danger} />}
            onPress={() => handleDeleteItem(item)}
            variant="ghost"
            textStyle={{ color: colors.danger }}
            style={styles.deleteBtn}
          />
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={[typography.h1, { color: colors.textPrimary }]}>Saved History</Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
            {historyItems.length} saved {historyItems.length === 1 ? 'video' : 'videos'}
          </Text>
        </View>

        {historyItems.length > 0 && (
          <TouchableOpacity
            onPress={handleClearAll}
            style={styles.clearBtn}
            accessibilityRole="button"
            accessibilityLabel="Clear history"
          >
            <Text style={[typography.captionMedium, { color: colors.danger }]}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {historyItems.length === 0 ? (
        <EmptyState
          iconName="time-outline"
          title="No history yet"
          description="Videos you resolve and download will be listed here for quick playback, sharing, or deletion."
        />
      ) : (
        <FlatList
          data={historyItems}
          keyExtractor={(item) => item.id}
          renderItem={renderHistoryItem}
          contentContainerStyle={styles.listContent}
          onRefresh={refreshHistory}
          refreshing={loading}
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
  itemCard: {
    marginBottom: spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.md,
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoArea: {
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  missingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
    minHeight: 42,
  },
  deleteBtn: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
});
