import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';

interface LaunchAnimationProps {
  enabled: boolean;
  onFinish: () => void;
}

// Module-level guard: ensures animation only ever plays once per cold start
let hasPlayedColdStartAnimation = false;

export function resetColdStartAnimationForTesting() {
  hasPlayedColdStartAnimation = false;
}

export const LaunchAnimation: React.FC<LaunchAnimationProps> = ({ enabled, onFinish }) => {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(enabled && !hasPlayedColdStartAnimation);

  const opacityAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    // If disabled or already played in this process, finish immediately
    if (!enabled || hasPlayedColdStartAnimation) {
      onFinish();
      return;
    }

    hasPlayedColdStartAnimation = true;

    // Smooth, restrained Android entrance (450ms total) with native driver
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      onFinish();
    });
  }, [enabled, onFinish, opacityAnim, scaleAnim]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          backgroundColor: colors.background,
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          styles.contentBox,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: colors.primaryContainer || colors.primaryLight,
              borderColor: colors.primary,
            },
          ]}
        >
          <Ionicons name="film" size={36} color={colors.primary} />
        </View>
        <Text style={[typography.headlineMedium, { color: colors.textPrimary, marginTop: 12, letterSpacing: -0.3 }]}>
          ClipSave
        </Text>
        <Text style={[typography.micro, { color: colors.textMuted, marginTop: 2, letterSpacing: 0.5 }]}>
          TIKTOK MEDIA DOWNLOADER
        </Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
