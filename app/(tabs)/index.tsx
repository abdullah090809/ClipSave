import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { DisclaimerBanner } from '../../src/components/DisclaimerBanner';
import { extractAndValidateTikTokUrl } from '../../src/utils/urlValidator';
import { resolveTikTokUrl } from '../../src/services/apiClient';
import { ResolveError } from '../../src/types';

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const [inputUrl, setInputUrl] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const handlePaste = async () => {
    try {
      const hasString = await Clipboard.hasStringAsync();
      if (!hasString) {
        Alert.alert('Empty Clipboard', 'Your clipboard is currently empty.');
        return;
      }
      const text = await Clipboard.getStringAsync();
      if (!text || !text.trim()) {
        Alert.alert('Empty Clipboard', 'Your clipboard contains no text.');
        return;
      }
      setInputUrl(text.trim());
      setValidationError(null);
    } catch {
      Alert.alert('Clipboard Access', 'Could not access clipboard.');
    }
  };

  const handleClear = () => {
    setInputUrl('');
    setValidationError(null);
  };

  const handleResolve = async () => {
    setValidationError(null);

    const validation = extractAndValidateTikTokUrl(inputUrl);
    if (!validation.isValid || !validation.normalizedUrl) {
      setValidationError(validation.errorMessage || 'Invalid TikTok URL.');
      return;
    }

    setResolving(true);
    try {
      const resolvedMedia = await resolveTikTokUrl(validation.normalizedUrl);
      setResolving(false);

      // Navigate to Preview modal with resolved data
      router.push({
        pathname: '/preview',
        params: {
          mediaJson: JSON.stringify(resolvedMedia),
        },
      });
    } catch (err: any) {
      setResolving(false);
      const resolveErr = err as ResolveError;
      setValidationError(resolveErr.message || 'Unable to resolve video.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.logoBadge, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="film" size={26} color={colors.primary} />
            </View>
            <Text style={[typography.display, { color: colors.textPrimary, marginTop: spacing.md }]}>
              ClipSave
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs }]}>
              Private, verified media downloader
            </Text>
          </View>

          {/* Transparency / Compliance Notice */}
          <DisclaimerBanner />

          {/* URL Input Section */}
          <Card style={styles.inputCard}>
            <Text style={[typography.h3, { color: colors.textPrimary }]}>Paste TikTok Link</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
              Supports public video links from tiktok.com or vm.tiktok.com
            </Text>

            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: validationError ? colors.danger : colors.inputBorder,
                },
              ]}
            >
              <Ionicons name="link" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { color: colors.textPrimary }]}
                placeholder="https://www.tiktok.com/@user/video/..."
                placeholderTextColor={colors.textMuted}
                value={inputUrl}
                onChangeText={(t) => {
                  setInputUrl(t);
                  if (validationError) setValidationError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                onSubmitEditing={handleResolve}
                editable={!resolving}
              />
              {inputUrl.length > 0 && (
                <Button
                  title=""
                  icon={<Ionicons name="close-circle" size={18} color={colors.textMuted} />}
                  onPress={handleClear}
                  variant="ghost"
                  style={styles.clearButton}
                />
              )}
            </View>

            {validationError && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={[typography.caption, { color: colors.danger, marginLeft: spacing.xs, flex: 1 }]}>
                  {validationError}
                </Text>
              </View>
            )}

            <View style={styles.actionRow}>
              <Button
                title="Paste from Clipboard"
                icon={<Ionicons name="clipboard-outline" size={18} color={colors.textPrimary} />}
                onPress={handlePaste}
                variant="secondary"
                style={styles.pasteButton}
                disabled={resolving}
              />
              <Button
                title="Resolve"
                icon={<Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
                onPress={handleResolve}
                variant="primary"
                loading={resolving}
                style={styles.resolveButton}
              />
            </View>
          </Card>

          {/* Supported Links & Guidance */}
          <Card elevated style={styles.guideCard}>
            <View style={styles.guideHeader}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
              <Text style={[typography.h3, { color: colors.textPrimary, marginLeft: spacing.sm }]}>
                How ClipSave Works
              </Text>
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm }]}>
              1. Copy a shareable video link from TikTok.
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
              2. Tap Paste and click Resolve to verify available stream source.
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
              3. View stream metadata and download directly to your device storage.
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.md }]}>
              • No ads, no telemetry, no account required.
            </Text>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: spacing.sm,
  },
  clearButton: {
    minHeight: 36,
    paddingHorizontal: spacing.xs,
    paddingVertical: 0,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  pasteButton: {
    flex: 1,
  },
  resolveButton: {
    flex: 1,
  },
  guideCard: {
    marginHorizontal: spacing.lg,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
