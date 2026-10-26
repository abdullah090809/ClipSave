import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
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
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.surfaceBorder,
        },
      ]}
      accessible={true}
      accessibilityRole="alert"
    >
      <View style={styles.content}>
        <Ionicons name="information-circle-outline" size={20} color={colors.primary} style={styles.icon} />
        <View style={styles.textContainer}>
          <Text style={[typography.captionMedium, { color: colors.textPrimary }]}>
            Authorized Use & Transparency Notice
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
            Only download media you own or have permission to save. URLs are verified through your configured resolver backend. ClipSave does not bypass private accounts or access controls.
          </Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={handleDismiss}
        style={styles.dismissButton}
        accessibilityRole="button"
        accessibilityLabel="Dismiss notice"
      >
        <Text style={[typography.captionMedium, { color: colors.primary }]}>Got it</Text>
      </TouchableOpacity>
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
  },
  icon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  dismissButton: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minHeight: 36,
    justifyContent: 'center',
  },
});
