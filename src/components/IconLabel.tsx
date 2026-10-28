import React from 'react';
import { View, Text, StyleSheet, StyleProp, TextStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import { spacing, iconSize } from '../theme/spacing';
import { typography } from '../theme/typography';
import { IconBubble } from './IconBubble';

type IconName = keyof typeof Ionicons.glyphMap;

/** An icon sitting inline with a line of text (replaces emoji prefixes). */
export const IconText: React.FC<{
  icon: IconName;
  color: string;
  children: React.ReactNode;
  textStyle?: StyleProp<TextStyle>;
  size?: number;
  numberOfLines?: number;
}> = ({ icon, color, children, textStyle, size = iconSize.xs, numberOfLines }) => (
  <View style={styles.inline}>
    <Ionicons name={icon} size={size} color={color} />
    <Text style={[typography.captionMedium, { color }, textStyle]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  </View>
);

/** Section heading: small tinted icon tile, sentence-case title, optional count. */
export const SectionTitle: React.FC<{
  icon: IconName;
  title: string;
  count?: number;
  tint?: 'primary' | 'accent' | 'success' | 'danger' | 'neutral';
}> = ({ icon, title, count, tint = 'primary' }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionRow} accessibilityRole="header">
      <IconBubble icon={icon} tint={tint} size="sm" />
      <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>{title}</Text>
      {count !== undefined ? (
        <Text style={[typography.numeric, { color: colors.textMuted }]}>{count}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
