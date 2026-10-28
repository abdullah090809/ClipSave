import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../src/theme/ThemeContext';
import { spacing, borderRadius, layout, iconSize } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';
import { Card } from '../src/components/Card';
import { ScreenHeader } from '../src/components/ScreenHeader';

export default function AboutScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScreenHeader
        title="About & Privacy"
        subtitle="Version 1.0.0 (Build 100)"
        onBack={() => router.back()}
        backAccessibilityLabel="Return to Settings"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Brand Hero */}
        <View style={styles.brandHero}>
          <Image
            source={require('../assets/clipsave-logo.png')}
            style={{ width: 64, height: 64, borderRadius: 16 }}
            resizeMode="contain"
          />
          <Text style={[typography.headlineLarge, { color: colors.textPrimary, marginTop: spacing.md }]}>
            ClipSave
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 2 }]}>
            Open-Source Verified TikTok Media Downloader
          </Text>
        </View>

        {/* Legal Disclaimer & Independence */}
        <Card variant="outlined" style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="shield-checkmark-outline" size={iconSize.md} color={colors.primary} />
            <Text style={[typography.titleMedium, { color: colors.textPrimary, marginLeft: spacing.xs }]}>
              Legal Disclaimer & Independence
            </Text>
          </View>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 22 }]}>
            ClipSave is an independent open-source utility and is not affiliated with, endorsed, sponsored, or associated with TikTok, ByteDance Ltd., or any of their affiliates.
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 22 }]}>
            ClipSave is intended solely for saving personal videos you own, public domain works, or media for which you have received authorization from the original copyright holder.
          </Text>
        </Card>

        {/* Privacy Architecture */}
        <Card variant="outlined" style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="lock-closed-outline" size={iconSize.md} color={colors.success} />
            <Text style={[typography.titleMedium, { color: colors.textPrimary, marginLeft: spacing.xs }]}>
              Privacy Architecture
            </Text>
          </View>
          <View style={styles.bulletList}>
            <Text style={[typography.body, { color: colors.textSecondary, lineHeight: 22 }]}>
              • <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Zero Tracking:</Text> ClipSave contains no advertising SDKs, analytics beacons, or third-party device trackers.
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, lineHeight: 22, marginTop: spacing.xs }]}>
              • <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Data Flow:</Text> Only the video link you provide is forwarded to your resolver backend to look up public stream URLs. Video bytes stream directly from the CDN to your device storage.
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, lineHeight: 22, marginTop: spacing.xs }]}>
              • <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Local Device Storage:</Text> Download history and preferences remain strictly on your local device.
            </Text>
          </View>
        </Card>

        {/* Platform Limitations */}
        <Card variant="outlined" style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="warning-outline" size={iconSize.md} color={colors.warning} />
            <Text style={[typography.titleMedium, { color: colors.textPrimary, marginLeft: spacing.xs }]}>
              Platform Limitations
            </Text>
          </View>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 22 }]}>
            • Private accounts, friends-only clips, regional geoblocks, and age-gated videos cannot be resolved.
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 22 }]}>
            • Clean/original stream availability depends on the public media served by TikTok's servers. ClipSave does not blur or modify video pixels.
          </Text>
        </Card>

        {/* Open Source Notices */}
        <Card variant="outlined" style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="code-slash-outline" size={iconSize.md} color={colors.accent} />
            <Text style={[typography.titleMedium, { color: colors.textPrimary, marginLeft: spacing.xs }]}>
              Open Source Notices
            </Text>
          </View>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 22 }]}>
            Built with React Native, Expo SDK 58, TypeScript, and FastAPI. Pinned dependency licenses are audited in docs/DEPENDENCIES.md.
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.md }]}>
            Maintainer Contact: [PROJECT_OWNER_CONTACT_PLACEHOLDER]
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: layout.gutter,
    paddingBottom: spacing.huge,
    gap: layout.stack,
  },
  brandHero: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bulletList: {
    marginTop: spacing.sm,
  },
});
