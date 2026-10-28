import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import { spacing, layout, iconSize } from '../theme/spacing';
import { typography } from '../theme/typography';

type IconName = keyof typeof Ionicons.glyphMap;

export interface HeaderAction {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
}

interface TabHeaderProps {
  /** Screen title, shown large. Ignored when `brand` is set. */
  title?: string;
  /** Optional subtitle or tagline */
  subtitle?: string;
  /** Home shows the logo + wordmark instead of a screen title. */
  brand?: boolean;
  /** Whether to show the ClipSave brand logo (defaults to true) */
  showLogo?: boolean;
  /** Optional 3-dots overflow action handler */
  onOverflowPress?: () => void;
  /** Overflow accessibility label */
  overflowLabel?: string;
  actions?: HeaderAction[];
}

/** One header for every top-level screen: brand logo + title on the left, 3-dots or custom actions on the right. */
export const TabHeader: React.FC<TabHeaderProps> = ({
  title,
  subtitle,
  brand,
  showLogo = true,
  onOverflowPress,
  overflowLabel = 'More options',
  actions = [],
}) => {
  const { colors } = useTheme();
  const displayTitle = brand ? 'ClipSave' : title || 'ClipSave';

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {showLogo && (
          <Image
            source={require('../../assets/clipsave-logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        )}
        <View style={styles.titleCol}>
          <Text
            style={[
              typography.titleLarge,
              { color: colors.textPrimary, fontWeight: '800', letterSpacing: -0.3 },
            ]}
            accessibilityRole="header"
            numberOfLines={1}
          >
            {displayTitle}
          </Text>
          {subtitle ? (
            <Text style={[typography.caption, { color: colors.textMuted, fontWeight: '500' }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.right}>
        {actions.map((a) => (
          <Pressable
            key={a.label}
            onPress={a.onPress}
            android_ripple={{ color: colors.ripple, borderless: true }}
            style={({ pressed }) => [
              styles.action,
              {
                backgroundColor: a.active ? colors.primaryContainer : colors.surfaceContainer,
                borderColor: a.active ? colors.primaryBorder : colors.outlineVariant,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            accessibilityState={{ selected: !!a.active }}
          >
            <Ionicons
              name={a.icon}
              size={iconSize.md}
              color={a.active ? colors.primary : colors.textPrimary}
            />
          </Pressable>
        ))}

        {onOverflowPress && (
          <Pressable
            onPress={onOverflowPress}
            android_ripple={{ color: colors.ripple, borderless: true, radius: 20 }}
            style={({ pressed }) => [
              styles.action,
              {
                backgroundColor: colors.surfaceContainer,
                borderColor: colors.outlineVariant,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={overflowLabel}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={iconSize.md}
              color={colors.textPrimary}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    minHeight: 56,
  },
  left: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  logo: { width: 34, height: 34, borderRadius: 8 },
  titleCol: { flexDirection: 'column', justifyContent: 'center' },
  right: { flexDirection: 'row', alignItems: 'center', gap: layout.inline },
  action: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
