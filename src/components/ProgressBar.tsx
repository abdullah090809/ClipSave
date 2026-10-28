import React, { useEffect, useRef, memo } from 'react';
import { View, StyleSheet, Animated, Text, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';
import { motion, isReduceMotion } from '../theme/motion';

/**
 * Bar fill that glides to its new width instead of jumping. `percent` is 0-100.
 * Width cannot use the native driver, but it only runs while progress changes.
 */
export const AnimatedFill: React.FC<{ percent: number; style?: StyleProp<ViewStyle> }> = ({ percent, style }) => {
  const value = useRef(new Animated.Value(percent)).current;

  useEffect(() => {
    if (isReduceMotion()) {
      value.setValue(percent);
      return;
    }
    const anim = Animated.timing(value, {
      toValue: percent,
      duration: motion.duration.progress,
      easing: motion.easing.move,
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [percent, value]);

  const width = value.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return <Animated.View style={[style, { width }]} />;
};

export interface ProgressBarProps {
  progress?: number | undefined; // 0.0 to 1.0; undefined/null for indeterminate
  showPercentage?: boolean | undefined;
  statusLabel?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = memo(({
  progress,
  showPercentage = true,
  statusLabel,
}) => {
  const { colors } = useTheme();
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const isIndeterminate = progress === undefined || progress === null;

  useEffect(() => {
    if (isIndeterminate) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.35,
            duration: 750,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [isIndeterminate]);

  const clampedProgress = Math.min(Math.max(progress ?? 0, 0), 1);
  const percentageInt = Math.round(clampedProgress * 100);
  const percentageString = isIndeterminate ? 'Streaming...' : `${percentageInt}%`;

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="progressbar"
      accessibilityValue={
        isIndeterminate
          ? { text: 'Streaming in progress' }
          : { min: 0, max: 100, now: percentageInt }
      }
    >
      <View
        style={[
          styles.track,
          { backgroundColor: colors.outlineVariant || colors.surfaceBorder },
        ]}
      >
        {isIndeterminate ? (
          <Animated.View
            style={[
              styles.indeterminateBar,
              {
                backgroundColor: colors.primary,
                opacity: pulseAnim,
              },
            ]}
          />
        ) : (
          <AnimatedFill
            percent={percentageInt}
            style={[styles.fill, { backgroundColor: colors.primary }]}
          />
        )}
      </View>

      {(showPercentage || statusLabel) && (
        <View style={styles.labelRow}>
          {statusLabel ? (
            <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>
              {statusLabel}
            </Text>
          ) : (
            <View />
          )}
          {showPercentage && (
            <Text style={[typography.labelMedium, { color: colors.primary }]}>
              {percentageString}
            </Text>
          )}
        </View>
      )}
    </View>
  );
});

ProgressBar.displayName = 'ProgressBar';

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
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.full,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
});
