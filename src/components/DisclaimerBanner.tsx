import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';

const DISCLAIMER_DISMISSED_KEY = '@clipsave_disclaimer_dismissed';

export const DisclaimerBanner: React.FC = () => {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DISCLAIMER_DISMISSED_KEY)
      .then((val) => {
        if (!val) {
          setVisible(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    AsyncStorage.setItem(DISCLAIMER_DISMISSED_KEY, 'true').catch(() => {});
  };

  if (!visible) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceContainerHigh || colors.surfaceElevated,
          borderColor: colors.outlineVariant || colors.surfaceBorder,
        },
      ]}
      accessible={true}
      accessibilityRole="alert"
    >
      <View style={styles.content}>
        <View style={[styles.iconWrapper, { backgroundColor: colors.primaryContainer || colors.primaryLight }]}>
          <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>
            Authorized Use & Transparency
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2, lineHeight: 18 }]}>
            Only download media you own or have permission to save. ClipSave queries public stream metadata and does not bypass private accounts.
          </Text>
        </View>
      </View>
      <Pressable
        onPress={handleDismiss}
        android_ripple={{ color: colors.ripple, borderless: true }}
        style={styles.dismissButton}
        accessibilityRole="button"
        accessibilityLabel="Dismiss notice"
      >
        <Text style={[typography.labelMedium, { color: colors.primary }]}>Got it</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  dismissButton: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
