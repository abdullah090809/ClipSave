import React, { useEffect, useRef, memo } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';

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
          <View
            style={[
              styles.fill,
              {
                backgroundColor: colors.primary,
                width: `${percentageInt}%`,
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
