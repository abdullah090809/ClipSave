import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import { StartupAnimationMode } from '../types';

interface LaunchAnimationProps {
  mode: StartupAnimationMode;
  onFinish: () => void;
}

// Module-level guard: ensures animation only ever plays once per cold start
let hasPlayedColdStartAnimation = false;

export function resetColdStartAnimationForTesting() {
  hasPlayedColdStartAnimation = false;
}

export const LaunchAnimation: React.FC<LaunchAnimationProps> = ({ mode, onFinish }) => {
  const { colors } = useTheme();
  const shouldPlay = mode !== 'off' && !hasPlayedColdStartAnimation;
  const [visible, setVisible] = useState(shouldPlay);

  const opacityAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(mode === 'subtle' ? 1 : 0.94)).current;

  useEffect(() => {
    if (!shouldPlay) {
      onFinish();
      return;
    }

    hasPlayedColdStartAnimation = true;

    if (mode === 'subtle') {
      // Short restrained fade (180ms)
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
        onFinish();
      });
    } else {
      // Standard tasteful entrance (380ms)
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setVisible(false);
        onFinish();
      });
    }
  }, [mode, onFinish, opacityAnim, scaleAnim, shouldPlay]);

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
