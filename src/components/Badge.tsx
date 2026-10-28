import React from 'react';
import { View, Text, ViewStyle, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import { spacing, borderRadius, iconSize } from '../theme/spacing';
import { typography } from '../theme/typography';
import { DownloadState } from '../types';

export interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'muted';
  state?: DownloadState;
  showIcon?: boolean;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant,
  state,
  showIcon = true,
  style,
}) => {
  const { colors } = useTheme();

  const resolveColorsAndIcon = (): {
    bg: string;
    text: string;
    iconName?: keyof typeof Ionicons.glyphMap;
  } => {
    if (state) {
      switch (state) {
        case 'COMPLETED':
          return {
            bg: colors.successLight,
            text: colors.success,
            iconName: 'checkmark-circle',
          };
        case 'DOWNLOADING':
          return {
            bg: colors.primaryLight,
            text: colors.primary,
            iconName: 'arrow-down-circle',
          };
        case 'FINALIZING':
          return {
            bg: colors.primaryLight,
            text: colors.primary,
            iconName: 'sync-circle',
          };
        case 'PAUSED':
          return {
            bg: colors.warningLight,
            text: colors.warning,
            iconName: 'pause-circle',
          };
        case 'QUEUED':
        case 'READY':
        case 'RESOLVING':
          return {
            bg: colors.primaryContainer || colors.primaryLight,
            text: colors.onPrimaryContainer || colors.primary,
            iconName: 'time-outline',
          };
        case 'FAILED':
          return {
            bg: colors.dangerLight,
            text: colors.danger,
            iconName: 'alert-circle',
          };
        case 'CANCELLED':
          return {
            bg: colors.surfaceContainerHigh || colors.surfaceElevated,
            text: colors.textMuted,
            iconName: 'close-circle-outline',
          };
      }
    }

    switch (variant) {
      case 'success':
        return { bg: colors.successLight, text: colors.success, iconName: 'checkmark-circle' };
      case 'warning':
        return { bg: colors.warningLight, text: colors.warning, iconName: 'warning-outline' };
      case 'danger':
        return { bg: colors.dangerLight, text: colors.danger, iconName: 'alert-circle' };
      case 'muted':
        return { bg: colors.surfaceContainerHigh || colors.surfaceElevated, text: colors.textMuted };
      case 'primary':
      default:
        return { bg: colors.primaryLight, text: colors.primary, iconName: 'shield-checkmark-outline' };
    }
  };

  const { bg, text, iconName } = resolveColorsAndIcon();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg },
        style,
      ]}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`Status: ${label}`}
    >
      {showIcon && iconName && (
        <Ionicons name={iconName} size={iconSize.xs} color={text} style={styles.icon} />
      )}
      <Text style={[typography.labelMedium, { color: text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
});
