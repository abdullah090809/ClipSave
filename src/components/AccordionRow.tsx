import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  LayoutAnimation,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';

interface AccordionRowProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBgColor?: string;
  initiallyExpanded?: boolean;
  expanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  children: React.ReactNode;
}

export const AccordionRow: React.FC<AccordionRowProps> = ({
  title,
  subtitle,
  icon,
  iconColor,
  iconBgColor,
  initiallyExpanded = false,
  expanded: controlledExpanded,
  onToggle,
  children,
}) => {
  const { colors } = useTheme();
  const [internalExpanded, setInternalExpanded] = useState(initiallyExpanded);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !isExpanded;
    if (controlledExpanded === undefined) {
      setInternalExpanded(next);
    }
    onToggle?.(next);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceContainer,
          borderColor: colors.surfaceBorder,
        },
      ]}
    >
      <Pressable
        onPress={handleToggle}
        android_ripple={{ color: colors.ripple, borderless: false }}
        style={styles.header}
        accessibilityRole="button"
        accessibilityLabel={`${title}, accordion`}
        accessibilityState={{ expanded: isExpanded }}
      >
        <View style={styles.headerLeft}>
          {icon ? (
            <View
              style={[
                styles.iconBubble,
                {
                  backgroundColor: iconBgColor || colors.primaryContainer,
                },
              ]}
            >
              <Ionicons
                name={icon}
                size={16}
                color={iconColor || colors.primary}
              />
            </View>
          ) : null}
          <View style={styles.titleArea}>
            <Text
              style={[
                typography.titleSmall,
                { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={[
                  typography.caption,
                  { color: colors.textMuted, marginTop: 1, fontSize: 11 },
                ]}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>

      {isExpanded ? (
        <View
          style={[
            styles.body,
            {
              borderTopColor: colors.outlineVariant,
            },
          ]}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 50,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleArea: {
    flex: 1,
    justifyContent: 'center',
  },
  body: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
});
