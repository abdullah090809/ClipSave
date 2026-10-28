import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Animated, Text, Image } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import { StartupAnimationMode } from '../types';
import { motion, isReduceMotion } from '../theme/motion';

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
  // Decided once on mount so a parent re-render mid-animation cannot cut it short.
  const shouldPlay = useRef(mode !== 'off' && !hasPlayedColdStartAnimation).current;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const [visible, setVisible] = useState(shouldPlay);

  const opacityAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(mode === 'subtle' ? 1 : 0.9)).current;
  const contentOpacity = useRef(new Animated.Value(mode === 'subtle' ? 1 : 0)).current;
  const taglineAnim = useRef(new Animated.Value(mode === 'subtle' ? 1 : 0)).current;

  useEffect(() => {
    if (!shouldPlay) {
      onFinishRef.current();
      return;
    }

    hasPlayedColdStartAnimation = true;

    const finish = () => {
      setVisible(false);
      onFinishRef.current();
    };

    if (mode === 'subtle' || isReduceMotion()) {
      // Short restrained fade (also used when the system asks to reduce motion)
      contentOpacity.setValue(1);
      taglineAnim.setValue(1);
      scaleAnim.setValue(1);
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: isReduceMotion() ? 120 : 180,
        useNativeDriver: true,
      }).start(finish);
    } else {
      // Standard: logo springs in, name settles, brief hold, then the whole
      // splash dissolves while drifting up a touch (~800ms in total).
      Animated.sequence([
        Animated.parallel([
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: motion.duration.base,
            easing: motion.easing.enter,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            damping: 14,
            stiffness: 180,
            mass: 0.8,
            useNativeDriver: true,
          }),
          Animated.timing(taglineAnim, {
            toValue: 1,
            duration: motion.duration.slow,
            delay: 120,
            easing: motion.easing.enter,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(140),
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 220,
            easing: motion.easing.move,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1.04,
            duration: 220,
            easing: motion.easing.move,
            useNativeDriver: true,
          }),
        ]),
      ]).start(finish);
    }
  }, [mode, opacityAnim, scaleAnim, contentOpacity, taglineAnim, shouldPlay]);

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
            opacity: contentOpacity,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image
          source={require('../../assets/clipsave-logo.png')}
          style={styles.launchLogoImg}
          resizeMode="contain"
        />
        <Text style={[typography.headlineMedium, { color: colors.textPrimary, marginTop: 12, letterSpacing: -0.3 }]}>
          ClipSave
        </Text>
        <Animated.Text
          style={[
            typography.micro,
            {
              color: colors.textMuted,
              marginTop: 2,
              letterSpacing: 0.5,
              opacity: taglineAnim,
              transform: [{ translateY: taglineAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
            },
          ]}
        >
          TIKTOK MEDIA DOWNLOADER
        </Animated.Text>
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
  launchLogoImg: {
    width: 72,
    height: 72,
    borderRadius: 18,
  },
});
