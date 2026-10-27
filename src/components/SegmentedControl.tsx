import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  selectedValue: T;
  onSelect: (value: T) => void;
  accessibilityLabel?: string;
}

export function SegmentedControl<T extends string>({
  options,
  selectedValue,
  onSelect,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceContainerLow || colors.surfaceContainer || colors.surfaceElevated,
          borderColor: colors.outlineVariant || colors.surfaceBorder,
        },
      ]}
      accessible={true}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((opt) => {
        const isSelected = selectedValue === opt.value;

        return (
          <Pressable
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            android_ripple={{ color: colors.ripple, borderless: false }}
            style={[
              styles.segment,
              isSelected && [
                styles.selectedSegment,
                {
                  backgroundColor: colors.primaryContainer || colors.primaryLight,
                  borderColor: colors.primary,
                },
              ],
            ]}
            accessible={true}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${opt.label} option`}
          >
            {opt.icon && (
              <Ionicons
                name={opt.icon}
                size={16}
                color={isSelected ? colors.primary : colors.textSecondary}
                style={styles.segmentIcon}
              />
            )}
            <Text
              style={[
                typography.labelMedium,
                {
                  color: isSelected ? colors.primary : colors.textPrimary,
                  fontWeight: isSelected ? '700' : '500',
                },
              ]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 3,
    width: '100%',
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.xs,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  selectedSegment: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentIcon: {
    marginRight: 6,
  },
});
