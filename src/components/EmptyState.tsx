import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Button } from './Button';

export interface EmptyStateProps {
  iconName: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionTitle?: string | undefined;
  onAction?: (() => void) | undefined;
}

/** Flat empty state: icon, one heading, one sentence, optional single action. */
export const EmptyState: React.FC<EmptyStateProps> = ({
  iconName,
  title,
  description,
  actionTitle,
  onAction,
}) => {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Ionicons name={iconName} size={40} color={colors.textMuted} />
      <Text style={[typography.titleLarge, styles.title, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[typography.body, styles.desc, { color: colors.textSecondary }]}>{description}</Text>
      {actionTitle && onAction ? (
        <Button title={actionTitle} onPress={onAction} variant="tonal" style={styles.action} />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xxxl,
    paddingTop: spacing.huge,
    alignItems: 'center',
  },
  title: { marginTop: spacing.md, textAlign: 'center' },
  desc: { marginTop: spacing.xs, textAlign: 'center', maxWidth: 320 },
  action: { marginTop: spacing.xl, minWidth: 180 },
});
