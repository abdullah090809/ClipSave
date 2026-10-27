import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { extractAndValidateTikTokUrl } from '../../src/utils/urlValidator';
import { resolveTikTokUrl } from '../../src/services/apiClient';
import { startDownload } from '../../src/services/downloadEngine';
import { subscribeQueue } from '../../src/storage/queueStore';
import { jobBucket, jobProgressFraction } from '../../src/utils/jobDisplay';
import { formatBytes } from '../../src/utils/formatters';
import { DownloadJob, ResolveError } from '../../src/types';

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ prefill?: string; ts?: string }>();

  // State
  const [activeJob, setActiveJob] = useState<DownloadJob | null>(null);
  const [resolving, setResolving] = useState(false);
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [recentSavedTitle, setRecentSavedTitle] = useState<string | null>(null);

  // Animations
  const orbScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const resolvingRef = useRef(false);

  // Subscribe to Queue
  useEffect(() => {
    return subscribeQueue((jobs) => {
      const active = jobs.find((j) => jobBucket(j) === 'active');
      setActiveJob(active || null);

      const latestDone = jobs.find((j) => jobBucket(j) === 'done');
      if (latestDone && !active) {
        setRecentSavedTitle(latestDone.media.title || 'Video saved to Gallery');
      }
    });
  }, []);

  // Check Clipboard on Focus
  useFocusEffect(
    useCallback(() => {
      Clipboard.hasStringAsync()
        .then(async (has) => {
          if (!has) {
            setClipboardUrl(null);
            return;
          }
          const text = await Clipboard.getStringAsync();
          if (text && text.trim()) {
            const check = extractAndValidateTikTokUrl(text.trim());
            if (check.isValid && check.normalizedUrl) {
              setClipboardUrl(check.normalizedUrl);
            } else {
              setClipboardUrl(null);
            }
          }
        })
        .catch(() => {});
    }, [])
  );

  // Prefill handling
  useEffect(() => {
    if (params.prefill) {
      setManualInput(params.prefill);
      setManualModalOpen(true);
    }
  }, [params.prefill, params.ts]);

  // Pulse animation when downloading
  useEffect(() => {
    if (activeJob || resolving) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [activeJob, resolving, pulseAnim]);

  // Execute Download Flow
  const triggerDownloadForUrl = async (rawUrl: string) => {
    if (resolvingRef.current) return;
    const check = extractAndValidateTikTokUrl(rawUrl);
    if (!check.isValid || !check.normalizedUrl) {
      setStatusMessage('Invalid link. Please copy a valid TikTok video URL.');
      return;
    }

    resolvingRef.current = true;
    setResolving(true);
    setStatusMessage('Resolving video...');
    try {
      const media = await resolveTikTokUrl(check.normalizedUrl);
      setStatusMessage('Starting download...');
      await startDownload(media);
      setStatusMessage(null);
      setManualModalOpen(false);
      setManualInput('');
      setClipboardUrl(null);
    } catch (err: unknown) {
      const error = err as ResolveError;
      setStatusMessage(error?.message || 'Could not resolve video. Please check link.');
    } finally {
      resolvingRef.current = false;
      setResolving(false);
    }
  };

  // Main Orb Tap Handler
  const handleOrbPress = async () => {
    // Tactile bounce
    Animated.sequence([
      Animated.timing(orbScale, { toValue: 0.94, duration: 90, useNativeDriver: true }),
      Animated.timing(orbScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();

    // If already downloading, open queue/activity
    if (activeJob) {
      router.push('/(tabs)/queue');
      return;
    }

    // 1. Check current clipboard state
    try {
      const hasStr = await Clipboard.hasStringAsync();
      if (hasStr) {
        const text = await Clipboard.getStringAsync();
        if (text && text.trim()) {
          const check = extractAndValidateTikTokUrl(text.trim());
          if (check.isValid && check.normalizedUrl) {
            triggerDownloadForUrl(check.normalizedUrl);
            return;
          }
        }
      }
    } catch {
      // Fall through to manual modal
    }

    // If no valid TikTok URL was on clipboard, open manual input modal
    setManualModalOpen(true);
  };

  const handleManualPaste = async () => {
    try {
      const hasStr = await Clipboard.hasStringAsync();
      const text = hasStr ? await Clipboard.getStringAsync() : '';
      if (!text || !text.trim()) {
        Alert.alert('Empty Clipboard', 'No text found on clipboard.');
        return;
      }
      setManualInput(text.trim());
    } catch {
      Alert.alert('Clipboard', 'Could not read from clipboard.');
    }
  };

  // Status text determination
  const fraction = activeJob ? jobProgressFraction(activeJob) ?? 0.1 : 0;
  const percentText = Math.round(fraction * 100);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.push('/about')}
          style={[styles.headerCircleBtn, { borderColor: colors.outlineVariant }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="About ClipSave"
        >
          <Ionicons name="information-circle-outline" size={22} color={colors.textSecondary} />
        </Pressable>

        <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>C L I P S A V E</Text>

        <Pressable
          onPress={() => router.push('/(tabs)/settings')}
          style={[styles.headerCircleBtn, { borderColor: colors.outlineVariant }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Main Center Area with Central Download Orb */}
      <View style={styles.centerContainer}>
        <Animated.View
          style={[
            styles.orbOuterRing,
            {
              transform: [{ scale: orbScale }, { scale: pulseAnim }],
              borderColor: activeJob ? colors.primary : clipboardUrl ? colors.primary : '#334155',
              shadowColor: activeJob || clipboardUrl ? colors.primary : '#000000',
            },
          ]}
        >
          <Pressable
            onPress={handleOrbPress}
            style={[styles.orbCore, { backgroundColor: colors.surfaceContainer }]}
            android_ripple={{ color: colors.ripple, borderless: true, radius: 95 }}
            accessibilityRole="button"
            accessibilityLabel={
              activeJob
                ? `Downloading ${percentText} percent. Tap to view queue.`
                : clipboardUrl
                ? 'Link detected. Tap to download from clipboard.'
                : 'Tap to download TikTok video from clipboard'
            }
          >
            {resolving ? (
              <View style={styles.orbInnerContent}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.orbStatusText, { color: colors.primary, marginTop: spacing.sm }]}>
                  RESOLVING...
                </Text>
              </View>
            ) : activeJob ? (
              <View style={styles.orbInnerContent}>
                <Text style={[styles.orbPercentText, { color: colors.primary }]}>{percentText}%</Text>
                <Text style={[styles.orbByteText, { color: colors.textSecondary }]}>
                  {formatBytes(activeJob.bytesDownloaded)}
                </Text>
                <Text style={[styles.orbActionText, { color: colors.primary, marginTop: 4 }]}>
                  DOWNLOADING
                </Text>
              </View>
            ) : (
              <View style={styles.orbInnerContent}>
                <Ionicons
                  name={clipboardUrl ? 'cloud-download-outline' : 'download-outline'}
                  size={46}
                  color={clipboardUrl ? colors.primary : colors.textPrimary}
                />
                <Text
                  style={[
                    styles.orbActionText,
                    { color: clipboardUrl ? colors.primary : colors.textPrimary, marginTop: spacing.sm },
                  ]}
                >
                  {clipboardUrl ? 'TAP TO SAVE' : 'DOWNLOAD'}
                </Text>
              </View>
            )}
          </Pressable>
        </Animated.View>

        {/* Dynamic Status Readout Under Orb */}
        <View style={styles.statusBox}>
          {statusMessage ? (
            <Text style={[typography.bodySmall, { color: colors.danger, textAlign: 'center' }]}>
              {statusMessage}
            </Text>
          ) : activeJob ? (
            <Text style={[typography.bodySmall, { color: colors.textSecondary, textAlign: 'center' }]} numberOfLines={1}>
              {activeJob.media.title || 'Downloading TikTok Video...'}
            </Text>
          ) : clipboardUrl ? (
            <Text style={[typography.bodySmall, { color: colors.primary, textAlign: 'center', fontWeight: '600' }]} numberOfLines={1}>
              TikTok Link Ready · Tap Orb to Download
            </Text>
          ) : recentSavedTitle ? (
            <Text style={[typography.bodySmall, { color: colors.success, textAlign: 'center' }]} numberOfLines={1}>
              ✓ {recentSavedTitle}
            </Text>
          ) : (
            <Text style={[typography.bodySmall, { color: colors.textMuted, textAlign: 'center' }]}>
              Copy a TikTok link, then tap the orb
            </Text>
          )}

          <Pressable
            onPress={() => setManualModalOpen(true)}
            style={styles.manualLinkBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Enter link manually"
          >
            <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>
              or enter link manually
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Bottom Videos Trigger (Matching BlackHole presentation) */}
      <View style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          onPress={() => router.push('/(tabs)/history')}
          style={styles.videosTrigger}
          android_ripple={{ color: colors.ripple, borderless: true, radius: 48 }}
          accessibilityRole="button"
          accessibilityLabel="Open saved videos library"
        >
          {/* Constellation Icon dots */}
          <View style={styles.constellationBox}>
            <View style={styles.constellationRow}>
              <View style={[styles.constellationDot, { backgroundColor: '#E2B170' }]} />
              <View style={[styles.constellationDot, { backgroundColor: '#E2B170' }]} />
              <View style={[styles.constellationDot, { backgroundColor: '#E2B170' }]} />
            </View>
            <View style={styles.constellationRow}>
              <View style={[styles.constellationDot, { backgroundColor: '#E2B170' }]} />
              <View style={[styles.constellationDot, { backgroundColor: '#E2B170', width: 7, height: 7, borderRadius: 3.5 }]} />
              <View style={[styles.constellationDot, { backgroundColor: '#E2B170' }]} />
            </View>
            <View style={styles.constellationRow}>
              <View style={[styles.constellationDot, { backgroundColor: '#E2B170' }]} />
              <View style={[styles.constellationDot, { backgroundColor: '#E2B170' }]} />
              <View style={[styles.constellationDot, { backgroundColor: '#E2B170' }]} />
            </View>
          </View>
          <Text style={styles.videosLabel}>V I D E O S</Text>
        </Pressable>
      </View>

      {/* Manual Input Modal Bottom Sheet */}
      <Modal
        visible={manualModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setManualModalOpen(false)}
      >
        <Pressable style={styles.modalScrim} onPress={() => setManualModalOpen(false)} />
        <View
          style={[
            styles.modalSheet,
            {
              backgroundColor: colors.surfaceContainer,
              borderTopColor: colors.outlineVariant,
              paddingBottom: Math.max(insets.bottom, 16) + spacing.md,
            },
          ]}
        >
          <View style={[styles.sheetHandle, { backgroundColor: colors.outline }]} />

          <View style={styles.sheetTopRow}>
            <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>Enter TikTok Link</Text>
            <Pressable onPress={() => setManualModalOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <View
            style={[
              styles.modalInputWrapper,
              { backgroundColor: colors.surface, borderColor: colors.outlineVariant },
            ]}
          >
            <Ionicons name="link-outline" size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
            <TextInput
              value={manualInput}
              onChangeText={setManualInput}
              placeholder="Paste public TikTok video link..."
              placeholderTextColor={colors.textMuted}
              style={[styles.modalTextInput, { color: colors.textPrimary }]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={() => triggerDownloadForUrl(manualInput)}
            />
            {manualInput.length > 0 ? (
              <Pressable onPress={() => setManualInput('')} hitSlop={6}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : (
              <Pressable onPress={handleManualPaste} style={[styles.pasteBadge, { backgroundColor: colors.primaryContainer }]}>
                <Text style={[typography.labelMedium, { color: colors.primary }]}>Paste</Text>
              </Pressable>
            )}
          </View>

          <Pressable
            onPress={() => triggerDownloadForUrl(manualInput)}
            disabled={resolving || !manualInput.trim()}
            style={[
              styles.downloadSubmitBtn,
              {
                backgroundColor: manualInput.trim() ? colors.primary : colors.surface,
                opacity: resolving ? 0.7 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Download video from entered link"
          >
            {resolving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color={manualInput.trim() ? '#FFFFFF' : colors.textMuted} />
                <Text
                  style={[
                    typography.labelMedium,
                    {
                      color: manualInput.trim() ? '#FFFFFF' : colors.textMuted,
                      fontWeight: '700',
                      marginLeft: 6,
                    },
                  ]}
                >
                  Download Video
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </Modal>
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 6,
  },
  headerCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  orbOuterRing: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  orbCore: {
    width: 184,
    height: 184,
    borderRadius: 92,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orbInnerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbActionText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  orbPercentText: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  orbByteText: {
    fontSize: 11,
    marginTop: 2,
  },
  orbStatusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  statusBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    height: 54,
    paddingHorizontal: spacing.lg,
  },
  manualLinkBtn: {
    marginTop: spacing.xs,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  bottomContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xs,
  },
  videosTrigger: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  constellationBox: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  constellationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  constellationDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  videosLabel: {
    color: '#E2B170',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 4,
    marginTop: 4,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  modalSheet: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderTopWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    marginBottom: spacing.md,
  },
  modalTextInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
  },
  pasteBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  downloadSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: borderRadius.md,
  },
});
