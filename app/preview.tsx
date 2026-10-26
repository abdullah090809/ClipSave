import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme/ThemeContext';
import { spacing, borderRadius } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';
import { Card } from '../src/components/Card';
import { Badge } from '../src/components/Badge';
import { Button } from '../src/components/Button';
import { startDownload } from '../src/services/downloadEngine';
import { formatBytes, formatDuration } from '../src/utils/formatters';
import { ResolvedMedia } from '../src/types';

export default function PreviewModal() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ mediaJson?: string }>();

  let media: ResolvedMedia | null = null;
  try {
    if (params.mediaJson) {
      media = JSON.parse(params.mediaJson);
    }
  } catch {
    media = null;
  }

  if (!media) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorBox}>
          <Text style={[typography.h2, { color: colors.textPrimary }]}>No Media Found</Text>
          <Button
            title="Go Back"
            onPress={() => router.back()}
            variant="outline"
            style={{ marginTop: spacing.md }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const handleStartDownload = async () => {
    if (!media) return;
    await startDownload(media);
    router.replace('/(tabs)/queue');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[typography.h1, { color: colors.textPrimary }]}>Video Preview</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            Review metadata before downloading
          </Text>
        </View>

        <Card style={styles.previewCard}>
          {media.thumbnailUrl ? (
            <Image
              source={{ uri: media.thumbnailUrl }}
              style={[styles.thumbnailImage, { backgroundColor: colors.surfaceElevated }]}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.thumbnailImage, styles.placeholderThumbnail, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="film-outline" size={48} color={colors.textMuted} />
            </View>
          )}

          <View style={styles.detailsArea}>
            <View style={styles.badgeRow}>
              <Badge label="Available Source" variant="primary" />
              {media.durationSeconds !== undefined && (
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {formatDuration(media.durationSeconds)}
                </Text>
              )}
            </View>

            <Text style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.sm }]}>
              {media.title}
            </Text>

            <Text style={[typography.bodyMedium, { color: colors.primary, marginTop: spacing.xs }]}>
              {media.author} {media.authorUsername ? `(${media.authorUsername})` : ''}
            </Text>

            <View style={[styles.metaGrid, { borderColor: colors.surfaceBorder }]}>
              <View style={styles.metaCol}>
                <Text style={[typography.micro, { color: colors.textMuted }]}>ESTIMATED SIZE</Text>
                <Text style={[typography.captionMedium, { color: colors.textPrimary }]}>
                  {formatBytes(media.estimatedSizeBytes)}
                </Text>
              </View>
              <View style={styles.metaCol}>
                <Text style={[typography.micro, { color: colors.textMuted }]}>FORMAT</Text>
                <Text style={[typography.captionMedium, { color: colors.textPrimary, textTransform: 'uppercase' }]}>
                  {media.format || 'MP4 Video'}
                </Text>
              </View>
            </View>

            <View style={[styles.reminderBox, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="shield-outline" size={16} color={colors.textMuted} />
              <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: spacing.xs, flex: 1 }]}>
                Please ensure you have permission to save this creator's work.
              </Text>
            </View>
          </View>
        </Card>

        <View style={styles.buttonRow}>
          <Button
            title="Cancel"
            onPress={() => router.back()}
            variant="ghost"
            style={styles.cancelBtn}
          />
          <Button
            title="Start Download"
            icon={<Ionicons name="download" size={18} color="#FFFFFF" />}
            onPress={handleStartDownload}
            variant="primary"
            style={styles.downloadBtn}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.md,
  },
  previewCard: {
    padding: 0,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: 220,
  },
  placeholderThumbnail: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsArea: {
    padding: spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: spacing.sm,
    marginVertical: spacing.md,
  },
  metaCol: {
    flex: 1,
  },
  reminderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  cancelBtn: {
    flex: 1,
  },
  downloadBtn: {
    flex: 2,
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
