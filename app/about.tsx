import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme/ThemeContext';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';
import { Card } from '../src/components/Card';

export default function AboutScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back to settings"
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[typography.h2, { color: colors.textPrimary }]}>About & Privacy</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Brand & Version */}
        <View style={styles.brandBox}>
          <View style={[styles.logoCircle, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="film" size={32} color={colors.primary} />
          </View>
          <Text style={[typography.h1, { color: colors.textPrimary, marginTop: spacing.md }]}>
            ClipSave
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Version 1.0.0 (Build 100)
          </Text>
        </View>

        {/* Legal & Independent Entity Notice */}
        <Card style={styles.card}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>Legal Disclaimer & Independence</Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            ClipSave is an independent open-source utility and is not affiliated with, endorsed, sponsored, or associated with TikTok, ByteDance, or any of their affiliates.
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            ClipSave is intended solely for saving personal videos you own, content in the public domain, or media for which you have received express authorization from the rights holder.
          </Text>
        </Card>

        {/* Privacy & Data Flow */}
        <Card style={styles.card}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>Privacy Architecture</Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            • <Text style={{ fontWeight: '600', color: colors.textPrimary }}>Zero Tracking:</Text> ClipSave contains no analytics SDKs, advertising trackers, or device fingerprinting libraries.
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            • <Text style={{ fontWeight: '600', color: colors.textPrimary }}>Data Flow:</Text> When you submit a link, only the URL string is sent to your configured ClipSave resolver backend to query available public stream metadata. Video bytes are streamed directly from the media source to your device; video content is never routed through or stored on the backend.
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            • <Text style={{ fontWeight: '600', color: colors.textPrimary }}>Local Storage:</Text> Download history and preferences remain entirely on your local device.
          </Text>
        </Card>

        {/* Limitations & Technical Constraints */}
        <Card style={styles.card}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>Platform Limitations</Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            • Private accounts, age gates, regional geoblocks, and authenticated content cannot and will not be accessed.
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            • Availability of clean or original sources depends entirely on what the public platform provides. ClipSave does not alter video pixels to erase platform watermarks.
          </Text>
        </Card>

        {/* Contact & Open Source */}
        <Card style={styles.card}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>Open Source Notices</Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            Built with React Native, Expo, TypeScript, and FastAPI. Pinned dependency licenses are audited in docs/DEPENDENCIES.md.
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.md }]}>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    height: 56,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  brandBox: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    padding: spacing.lg,
  },
});
