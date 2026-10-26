import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';

export interface ProgressBarProps {
  progress?: number | undefined; // 0.0 to 1.0; undefined for indeterminate
  showPercentage?: boolean | undefined;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  showPercentage = true,
}) => {
  const { colors } = useTheme();
  const indeterminateAnim = useRef(new Animated.Value(0)).current;

  const isIndeterminate = progress === undefined || progress === null;

  useEffect(() => {
    if (isIndeterminate) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(indeterminateAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: false,
          }),
          Animated.timing(indeterminateAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: false,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [isIndeterminate]);

  const clampedProgress = Math.min(Math.max(progress ?? 0, 0), 1);
  const percentageString = isIndeterminate ? 'Stream In Progress...' : `${Math.round(clampedProgress * 100)}%`;

  return (
    <View style={styles.container}>
      <View style={[styles.track, { backgroundColor: colors.surfaceBorder }]}>
        {isIndeterminate ? (
          <Animated.View
            style={[
              styles.indeterminateBar,
              {
                backgroundColor: colors.primary,
                left: indeterminateAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '70%'],
                }),
              },
            ]}
          />
        ) : (
          <View
            style={[
              styles.fill,
              {
                backgroundColor: colors.primary,
                width: `${clampedProgress * 100}%`,
              },
            ]}
          />
        )}
      </View>
      {showPercentage && (
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
          {percentageString}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  track: {
    height: 6,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  fill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  indeterminateBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '30%',
    borderRadius: borderRadius.full,
  },
});
