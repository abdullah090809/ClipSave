import React from 'react';
import { View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';

type IconName = keyof typeof Ionicons.glyphMap;

export type BubbleTint =
  | 'primary' | 'accent' | 'success' | 'danger' | 'warning' | 'violet' | 'pink' | 'neutral';

/**
 * Container size / icon size. The icon is always about 45% of the bubble so it
 * has room to breathe (the old 28px tiles held 16px icons at 57% and felt packed).
 */
const SIZES = {
  sm: { box: 36, icon: 16 },
  md: { box: 44, icon: 20 },
  lg: { box: 52, icon: 24 },
  xl: { box: 80, icon: 34 },
} as const;

export type BubbleSize = keyof typeof SIZES;

interface IconBubbleProps {
  icon: IconName;
  tint?: BubbleTint;
  size?: BubbleSize;
  /** Circle instead of rounded square. */
  round?: boolean;
}

export function useTintColors() {
  const { colors } = useTheme();
  return (tint: BubbleTint): { fg: string; bg: string } => {
    switch (tint) {
      case 'accent': return { fg: colors.accent, bg: colors.accentContainer };
      case 'success': return { fg: colors.success, bg: colors.successLight };
      case 'danger': return { fg: colors.danger, bg: colors.dangerLight };
      case 'warning': return { fg: colors.warning, bg: colors.warningLight };
      case 'violet': return { fg: colors.violet, bg: colors.violetContainer };
      case 'pink': return { fg: colors.pink, bg: colors.pinkContainer };
      case 'neutral': return { fg: colors.textSecondary, bg: colors.surfaceContainerHigh };
      case 'primary':
      default: return { fg: colors.primary, bg: colors.primaryContainer };
    }
  };
}

/** Tinted icon container used everywhere an icon sits in a bubble or tile. */
export const IconBubble: React.FC<IconBubbleProps> = ({ icon, tint = 'primary', size = 'md', round }) => {
  const tintColors = useTintColors();
  const { fg, bg } = tintColors(tint);
  const { box, icon: iconPx } = SIZES[size];
  return (
    <View
      style={[
        styles.base,
        { width: box, height: box, borderRadius: round ? box / 2 : Math.round(box * 0.32), backgroundColor: bg },
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Ionicons name={icon} size={iconPx} color={fg} />
    </View>
  );
};

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
