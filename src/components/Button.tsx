import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  AccessibilityRole,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const { colors } = useTheme();

  const getContainerStyle = (): ViewStyle => {
    const base: ViewStyle = {
      minHeight: spacing.touchTargetMin,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      opacity: disabled || loading ? 0.5 : 1,
    };

    switch (variant) {
      case 'primary':
        return { ...base, backgroundColor: colors.primary };
      case 'secondary':
        return { ...base, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.surfaceBorder };
      case 'danger':
        return { ...base, backgroundColor: colors.danger };
      case 'outline':
        return { ...base, backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary };
      case 'ghost':
        return { ...base, backgroundColor: 'transparent' };
      default:
        return base;
    }
  };

  const getTextColor = (): string => {
    switch (variant) {
      case 'primary':
      case 'danger':
        return '#FFFFFF';
      case 'outline':
      case 'ghost':
        return colors.primary;
      case 'secondary':
      default:
        return colors.textPrimary;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled || loading}
      style={[getContainerStyle(), style]}
      accessible={true}
      accessibilityRole={'button' as AccessibilityRole}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getTextColor()} />
      ) : (
        <>
          {icon}
          <Text style={[typography.bodyMedium, { color: getTextColor() }, textStyle]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};
