import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { spacing, borderRadius } from '../theme/spacing';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, style, elevated = false }) => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: elevated ? colors.surfaceElevated : colors.surface,
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
          padding: spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};
