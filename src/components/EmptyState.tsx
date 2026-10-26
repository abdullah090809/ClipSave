import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Button } from './Button';

export interface EmptyStateProps {
  iconName: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionTitle?: string;
  onAction?: () => void;
  actionIcon?: keyof typeof Ionicons.glyphMap;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  iconName,
  title,
  description,
  actionTitle,
  onAction,
  actionIcon,
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: colors.surfaceContainerHigh || colors.surfaceElevated,
            borderColor: colors.outlineVariant || colors.surfaceBorder,
          },
        ]}
      >
        <Ionicons name={iconName} size={44} color={colors.primary} />
      </View>
      <Text
        style={[
          typography.headlineMedium,
          { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          typography.body,
          {
            color: colors.textSecondary,
            textAlign: 'center',
            marginTop: spacing.sm,
            maxWidth: 320,
            lineHeight: 22,
          },
        ]}
      >
        {description}
      </Text>
      {actionTitle && onAction && (
        <Button
          title={actionTitle}
          icon={actionIcon ? <Ionicons name={actionIcon} size={18} color="#FFFFFF" /> : undefined}
          onPress={onAction}
          variant="primary"
          style={{ marginTop: spacing.xl, minWidth: 200 }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
