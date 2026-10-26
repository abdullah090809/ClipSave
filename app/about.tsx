import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme/ThemeContext';
import { spacing, borderRadius } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';
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
        {/* Brand Identity Hero */}
        <View style={styles.brandHero}>
          <View
            style={[
              styles.logoCircle,
              {
                backgroundColor: colors.primaryContainer || colors.primaryLight,
                borderColor: colors.primary,
              },
            ]}
          >
            <Ionicons name="film" size={28} color={colors.primary} />
          </View>
          <Text style={[typography.headlineMedium, { color: colors.textPrimary, marginTop: spacing.sm }]}>
            ClipSave
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 2 }]}>
            Verified TikTok Media Downloader
          </Text>
        </View>

        {/* Section 1: Legal Disclaimer & Independence */}
        <View style={styles.sectionGroup}>
          <View style={[styles.sectionContainer, { backgroundColor: colors.surfaceContainerLowest || colors.surface }]}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.tonalBadge, { backgroundColor: colors.primaryContainer || colors.primaryLight }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
              </View>
              <Text style={[typography.titleSmall, { color: colors.textPrimary, marginLeft: spacing.sm }]}>
                Legal Disclaimer & Independence
              </Text>
            </View>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 22 }]}>
              ClipSave is an independent open-source utility and is not affiliated with, endorsed, sponsored, or associated with TikTok, ByteDance Ltd., or any of their subsidiaries.
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 22 }]}>
              This application is designed solely for saving personal videos you own, public domain works, or media for which you have received authorization from the original copyright holder.
            </Text>
          </View>
        </View>

        {/* Section 2: Privacy Architecture */}
        <View style={styles.sectionGroup}>
          <View style={[styles.sectionContainer, { backgroundColor: colors.surfaceContainerLowest || colors.surface }]}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.tonalBadge, { backgroundColor: colors.successLight }]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.success} />
              </View>
              <Text style={[typography.titleSmall, { color: colors.textPrimary, marginLeft: spacing.sm }]}>
                Privacy Architecture
              </Text>
            </View>
            <View style={styles.bulletList}>
              <Text style={[typography.body, { color: colors.textSecondary, lineHeight: 22 }]}>
                • <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Zero Tracking:</Text> ClipSave contains no advertising SDKs, tracking beacons, or device fingerprinting.
              </Text>
              <Text style={[typography.body, { color: colors.textSecondary, lineHeight: 22, marginTop: spacing.xs }]}>
                • <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Data Flow:</Text> Only the video link you provide is sent to your resolver backend to look up public CDN stream URLs. Media bytes stream directly to your device storage.
              </Text>
              <Text style={[typography.body, { color: colors.textSecondary, lineHeight: 22, marginTop: spacing.xs }]}>
                • <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Local Device Storage:</Text> Download history and preferences remain strictly on your local device.
              </Text>
            </View>
          </View>
        </View>

        {/* Section 3: Platform Limitations */}
        <View style={styles.sectionGroup}>
          <View style={[styles.sectionContainer, { backgroundColor: colors.surfaceContainerLowest || colors.surface }]}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.tonalBadge, { backgroundColor: colors.warningLight }]}>
                <Ionicons name="warning-outline" size={18} color={colors.warning} />
              </View>
              <Text style={[typography.titleSmall, { color: colors.textPrimary, marginLeft: spacing.sm }]}>
                Platform Limitations
              </Text>
            </View>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 22 }]}>
              • Private accounts, friends-only clips, regional geoblocks, and age-gated videos cannot be resolved.
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 22 }]}>
              • Clean stream availability depends on the public media served by TikTok's CDN. ClipSave does not blur or modify video pixels.
            </Text>
          </View>
        </View>

        {/* Section 4: Open Source Notices */}
        <View style={styles.sectionGroup}>
          <View style={[styles.sectionContainer, { backgroundColor: colors.surfaceContainerLowest || colors.surface }]}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.tonalBadge, { backgroundColor: colors.primaryContainer || colors.primaryLight }]}>
                <Ionicons name="code-slash-outline" size={18} color={colors.primary} />
              </View>
              <Text style={[typography.titleSmall, { color: colors.textPrimary, marginLeft: spacing.sm }]}>
                Open Source Notices
              </Text>
            </View>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 22 }]}>
              Built with React Native, Expo SDK 58, TypeScript, and FastAPI. Pinned dependency licenses are audited in docs/DEPENDENCIES.md.
            </Text>
            <Text style={[typography.micro, { color: colors.textMuted, marginTop: spacing.md }]}>
              Maintainer Contact: [PROJECT_OWNER_CONTACT_PLACEHOLDER]
            </Text>
          </View>
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  brandHero: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionGroup: {
    marginBottom: spacing.xs,
  },
  sectionContainer: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tonalBadge: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletList: {
    marginTop: spacing.sm,
  },
});
