import { memo } from 'react';
import { Pressable, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';

interface TextButtonProps {
  title: string;
  onPress: () => void;
  tone?: 'primary' | 'danger' | 'neutral';
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Low-emphasis action: text only, 48dp tall, ripple feedback. */
export const TextButton = memo(function TextButton({
  title,
  onPress,
  tone = 'primary',
  accessibilityLabel,
  style,
}: TextButtonProps) {
  const { colors } = useTheme();
  const color =
    tone === 'danger' ? colors.danger : tone === 'neutral' ? colors.textSecondary : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.ripple }}
      style={[styles.btn, style]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
    >
      <Text style={[typography.labelLarge, { color }]} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
});
