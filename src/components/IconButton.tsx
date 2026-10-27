import { memo } from 'react';
import { Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';

export type IconName = keyof typeof Ionicons.glyphMap;

interface IconButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** 48dp icon-only button with ripple and a required accessibility label. */
export const IconButton = memo(function IconButton({
  icon,
  label,
  onPress,
  color,
  size = 22,
  disabled,
  style,
}: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: colors.ripple, borderless: true, radius: 24 }}
      style={[styles.btn, disabled && styles.disabled, style]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={0}
    >
      <Ionicons name={icon} size={size} color={color ?? colors.textSecondary} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  btn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
});
