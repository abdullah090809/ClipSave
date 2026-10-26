import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  Image,
  Pressable,
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
      'Clear Saved History',
      'Choose which items to clear from ClipSave:',
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
      <Card variant="outlined" style={styles.itemCard}>
        <View style={styles.cardRow}>
          {/* Thumbnail / Media Icon */}
          {item.thumbnailUrl ? (
            <Image
              source={{ uri: item.thumbnailUrl }}
              style={[
                styles.thumbnail,
                {
                  backgroundColor: colors.surfaceContainerLow || colors.surfaceElevated,
                  borderColor: colors.outlineVariant || colors.surfaceBorder,
                },
              ]}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.thumbnail,
                styles.thumbnailPlaceholder,
                {
                  backgroundColor: colors.surfaceContainerLow || colors.surfaceElevated,
                  borderColor: colors.outlineVariant || colors.surfaceBorder,
                },
              ]}
            >
              <Ionicons name="videocam" size={26} color={colors.textMuted} />
            </View>
          )}

          {/* Video Metadata */}
          <View style={styles.infoArea}>
            <Text style={[typography.titleMedium, { color: colors.textPrimary }]} numberOfLines={2}>
              {item.title || 'Untitled Video'}
            </Text>
            <View style={styles.authorRow}>
              <Ionicons name="person-outline" size={13} color={colors.textMuted} />
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: 4 }]} numberOfLines={1}>
                {item.author || 'Creator'}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <Text style={[typography.labelMedium, { color: colors.textMuted }]}>
                {formatBytes(item.fileSizeBytes)}
              </Text>
              <Text style={[typography.labelMedium, { color: colors.textMuted }]}>•</Text>
              <Text style={[typography.labelMedium, { color: colors.textMuted }]}>
                {formatDate(item.savedAt)}
              </Text>
            </View>

            {!item.fileExists && (
              <View style={[styles.missingBadge, { backgroundColor: colors.warningLight }]}>
                <Ionicons name="warning-outline" size={13} color={colors.warning} />
                <Text style={[typography.labelMedium, { color: colors.warning, marginLeft: 4 }]}>
                  File moved or deleted
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Controls */}
        <View style={styles.actionsRow}>
          {item.fileExists ? (
            <Button
              title="Share / Send to Gallery"
              icon={<Ionicons name="share-social-outline" size={16} color={colors.textPrimary} />}
              onPress={() => shareSavedMedia(item.fileUri)}
              variant="secondary"
              style={styles.actionBtn}
              accessibilityLabel={`Share or send ${item.title} to gallery`}
            />
          ) : (
            <Button
              title="Re-download"
              icon={<Ionicons name="download-outline" size={16} color={colors.primary} />}
              onPress={() => router.push('/')}
              variant="outline"
              style={styles.actionBtn}
              accessibilityLabel={`Re-download ${item.title}`}
            />
          )}

          <Pressable
            onPress={() => handleDeleteItem(item)}
            android_ripple={{ color: colors.ripple, borderless: true, radius: 24 }}
            style={styles.deleteIconButton}
            accessibilityRole="button"
            accessibilityLabel={`Delete options for ${item.title}`}
          >
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </Pressable>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScreenHeader
        title="Saved History"
        subtitle={`${historyItems.length} ${historyItems.length === 1 ? 'saved video' : 'saved videos'}`}
        rightAction={
          historyItems.length > 0
            ? {
                label: 'Clear All',
                icon: 'trash-outline',
                destructive: true,
                onPress: handleClearAll,
                accessibilityLabel: 'Clear all history records or files',
              }
            : undefined
        }
      />

      {historyItems.length === 0 ? (
        <EmptyState
          iconName="time-outline"
          title="No Saved History"
          description="Videos you resolve and download will be organized here for easy playback, sharing, and management."
          actionTitle="Download a Video"
          actionIcon="arrow-down-circle"
          onAction={() => router.push('/(tabs)')}
        />
      ) : (
        <FlatList
          data={historyItems}
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
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  itemCard: {
    marginBottom: spacing.xs,
  },
  cardRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  thumbnail: {
    width: 76,
    height: 76,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoArea: {
    flex: 1,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
  },
  missingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
    minHeight: spacing.touchTargetMin,
  },
  deleteIconButton: {
    width: spacing.touchTargetMin,
    height: spacing.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },
});
