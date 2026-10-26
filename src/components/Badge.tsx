import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';
import { DownloadState } from '../types';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'muted';
  state?: DownloadState;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant, state, style }) => {
  const { colors } = useTheme();

  const resolveColors = () => {
    if (state) {
      switch (state) {
        case 'COMPLETED':
          return { bg: colors.successLight, text: colors.success };
        case 'DOWNLOADING':
        case 'FINALIZING':
          return { bg: colors.primaryLight, text: colors.primary };
        case 'PAUSED':
        case 'READY':
        case 'QUEUED':
        case 'RESOLVING':
          return { bg: colors.warningLight, text: colors.warning };
        case 'FAILED':
        case 'CANCELLED':
          return { bg: colors.dangerLight, text: colors.danger };
      }
    }

    switch (variant) {
      case 'success':
        return { bg: colors.successLight, text: colors.success };
      case 'warning':
        return { bg: colors.warningLight, text: colors.warning };
      case 'danger':
        return { bg: colors.dangerLight, text: colors.danger };
      case 'muted':
        return { bg: colors.surfaceElevated, text: colors.textMuted };
      case 'primary':
      default:
        return { bg: colors.primaryLight, text: colors.primary };
    }
  };

  const c = resolveColors();

  return (
    <View
      style={[
        {
          backgroundColor: c.bg,
          paddingHorizontal: spacing.sm + 2,
          paddingVertical: spacing.xs,
          borderRadius: borderRadius.sm,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text style={[typography.micro, { color: c.text }]}>{label}</Text>
    </View>
  );
};
