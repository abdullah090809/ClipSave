import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string | undefined;
  onBack?: (() => void) | undefined;
  backAccessibilityLabel?: string | undefined;
  rightAction?: {
    label?: string | undefined;
    icon?: keyof typeof Ionicons.glyphMap | undefined;
    onPress: () => void;
    accessibilityLabel: string;
    destructive?: boolean | undefined;
  } | undefined;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  onBack,
  backAccessibilityLabel = 'Go back',
  rightAction,
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.leftRow}>
        {onBack && (
          <Pressable
            onPress={onBack}
            android_ripple={{ color: colors.ripple, borderless: true, radius: 24 }}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel={backAccessibilityLabel}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
        )}
        <View style={styles.titleArea}>
          <Text style={[typography.headlineMedium, { color: colors.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 1 }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {rightAction && (
        <Pressable
          onPress={rightAction.onPress}
          android_ripple={{ color: colors.ripple, borderless: false }}
          style={styles.rightButton}
          accessibilityRole="button"
          accessibilityLabel={rightAction.accessibilityLabel}
        >
          {rightAction.icon && (
            <Ionicons
              name={rightAction.icon}
              size={18}
              color={rightAction.destructive ? colors.danger : colors.primary}
              style={rightAction.label ? { marginRight: 4 } : undefined}
            />
          )}
          {rightAction.label && (
            <Text
              style={[
                typography.labelMedium,
                { color: rightAction.destructive ? colors.danger : colors.primary },
              ]}
            >
              {rightAction.label}
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  leftRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: spacing.touchTargetMin,
    height: spacing.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
    marginLeft: -spacing.xs,
    borderRadius: borderRadius.full,
  },
  titleArea: {
    flex: 1,
  },
  rightButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: spacing.touchTargetMin,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
  },
});
