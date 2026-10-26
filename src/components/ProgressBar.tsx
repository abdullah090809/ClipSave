import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';

export interface ProgressBarProps {
  progress?: number | undefined; // 0.0 to 1.0; undefined/null for indeterminate
  showPercentage?: boolean | undefined;
  statusLabel?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  showPercentage = true,
  statusLabel,
}) => {
  const { colors } = useTheme();
  const indeterminateAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(progress ?? 0)).current;

  const isIndeterminate = progress === undefined || progress === null;

  useEffect(() => {
    if (isIndeterminate) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(indeterminateAnim, {
            toValue: 1,
            duration: 1100,
            useNativeDriver: false,
          }),
          Animated.timing(indeterminateAnim, {
            toValue: 0,
            duration: 1100,
            useNativeDriver: false,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      Animated.timing(progressAnim, {
        toValue: Math.min(Math.max(progress, 0), 1),
        duration: 250,
        useNativeDriver: false,
      }).start();
    }
  }, [isIndeterminate, progress]);

  const clampedProgress = Math.min(Math.max(progress ?? 0, 0), 1);
  const percentageInt = Math.round(clampedProgress * 100);
  const percentageString = isIndeterminate ? 'Streaming...' : `${percentageInt}%`;

  const widthInterpolated = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

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
                left: indeterminateAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['-10%', '80%'],
                }),
              },
            ]}
          />
        ) : (
          <Animated.View
            style={[
              styles.fill,
              {
                backgroundColor: colors.primary,
                width: widthInterpolated,
              },
            ]}
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
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  track: {
    height: 7,
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
    width: '35%',
    borderRadius: borderRadius.full,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs + 2,
  },
});
