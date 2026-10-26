import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { spacing, borderRadius, elevation } from '../theme/spacing';
import { typography } from '../theme/typography';

export type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'danger' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
  testID,
}) => {
  const { colors, isDark } = useTheme();

  const isInteractive = !disabled && !loading;

  const getHeightAndPadding = (): { minHeight: number; paddingVertical: number; paddingHorizontal: number } => {
    switch (size) {
      case 'sm':
        return {
          minHeight: spacing.touchTargetMin, // Guaranteed 48dp touch target
          paddingVertical: spacing.xs + 2,
          paddingHorizontal: spacing.md,
        };
      case 'lg':
        return {
          minHeight: 54,
          paddingVertical: spacing.md + 2,
          paddingHorizontal: spacing.xxl,
        };
      case 'md':
      default:
        return {
          minHeight: spacing.touchTargetMin, // 48dp
          paddingVertical: spacing.sm + 2,
          paddingHorizontal: spacing.xl,
        };
    }
  };

  const getBaseStyle = (): ViewStyle => {
    const { minHeight, paddingVertical, paddingHorizontal } = getHeightAndPadding();

    const base: ViewStyle = {
      minHeight,
      paddingVertical,
      paddingHorizontal,
      borderRadius: borderRadius.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      overflow: 'hidden',
    };

    switch (variant) {
      case 'primary':
        return {
          ...base,
          backgroundColor: isInteractive ? colors.primary : colors.surfaceBorder,
          ...(isInteractive && Platform.OS === 'android' ? elevation.level1 : {}),
        };
      case 'secondary':
        return {
          ...base,
          backgroundColor: colors.surfaceContainerHigh || colors.surfaceElevated,
          borderWidth: 1,
          borderColor: colors.outlineVariant || colors.surfaceBorder,
        };
      case 'tonal':
        return {
          ...base,
          backgroundColor: colors.primaryContainer || colors.primaryLight,
        };
      case 'danger':
        return {
          ...base,
          backgroundColor: isInteractive ? colors.danger : colors.surfaceBorder,
        };
      case 'outline':
        return {
          ...base,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: isInteractive ? colors.primary : colors.surfaceBorder,
        };
      case 'ghost':
      default:
        return {
          ...base,
          backgroundColor: 'transparent',
        };
    }
  };

  const getTextColor = (): string => {
    if (!isInteractive) {
      return colors.textMuted;
    }
    switch (variant) {
      case 'primary':
      case 'danger':
        return '#FFFFFF';
      case 'tonal':
        return colors.onPrimaryContainer || colors.primary;
      case 'outline':
      case 'ghost':
        return colors.primary;
      case 'secondary':
      default:
        return colors.textPrimary;
    }
  };

  const rippleColor =
    variant === 'primary' || variant === 'danger'
      ? colors.ripplePrimary || 'rgba(255, 255, 255, 0.25)'
      : colors.ripple || (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)');

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!isInteractive}
      android_ripple={{
        color: rippleColor,
        borderless: false,
      }}
      style={({ pressed }) => [
        getBaseStyle(),
        style,
        {
          opacity: !isInteractive ? 0.55 : pressed && Platform.OS !== 'android' ? 0.75 : 1,
        },
      ]}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getTextColor()} />
      ) : (
        <>
          {icon}
          {title ? (
            <Text
              style={[
                size === 'lg' ? typography.titleMedium : typography.labelLarge,
                { color: getTextColor() },
                textStyle,
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
};
