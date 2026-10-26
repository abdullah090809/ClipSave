import React from 'react';
import { View, Pressable, ViewStyle, Platform } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { spacing, borderRadius, elevation } from '../theme/spacing';

export type CardVariant = 'filled' | 'elevated' | 'outlined';

export interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  style?: ViewStyle;
  elevated?: boolean; // Backwards compatible with existing usage
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant,
  elevated = false,
  style,
  onPress,
  accessibilityLabel,
  testID,
}) => {
  const { colors, isDark } = useTheme();

  // Resolve variant: if elevated=true is passed, treat as 'elevated'
  const resolvedVariant: CardVariant = variant || (elevated ? 'elevated' : 'outlined');

  const getCardStyle = (): ViewStyle => {
    switch (resolvedVariant) {
      case 'elevated':
        return {
          backgroundColor: colors.surfaceContainerHigh || colors.surfaceElevated,
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: colors.outlineVariant || colors.surfaceBorder,
          ...(Platform.OS === 'android' ? elevation.level1 : {}),
        };
      case 'filled':
        return {
          backgroundColor: colors.surfaceContainer || colors.surface,
          borderRadius: borderRadius.lg,
          borderWidth: 0,
        };
      case 'outlined':
      default:
        return {
          backgroundColor: colors.surfaceContainerLowest || colors.surface,
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: colors.outlineVariant || colors.surfaceBorder,
        };
    }
  };

  const cardContainerStyle: ViewStyle = {
    ...getCardStyle(),
    padding: spacing.lg,
    overflow: 'hidden',
  };

  if (onPress) {
    const rippleColor = colors.ripple || (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)');

    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        android_ripple={{ color: rippleColor, borderless: false }}
        style={({ pressed }) => [
          cardContainerStyle,
          style,
          {
            opacity: pressed && Platform.OS !== 'android' ? 0.9 : 1,
          },
        ]}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View testID={testID} style={[cardContainerStyle, style]}>
      {children}
    </View>
  );
};
