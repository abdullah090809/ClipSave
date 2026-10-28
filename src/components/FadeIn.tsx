import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { motion, useReducedMotion } from '../theme/motion';

interface FadeInProps {
  children: React.ReactNode;
  /** Position among siblings; later siblings start slightly later (capped). */
  index?: number;
  /** Extra delay in ms on top of the stagger. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

/** Fades and lifts its children into place once, when first mounted. */
export function FadeIn({ children, index = 0, delay = 0, style }: FadeInProps) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: motion.duration.slow,
      delay: Math.min(index, motion.maxStagger) * motion.stagger + delay,
      easing: motion.easing.enter,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [reduced, progress, index, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [motion.rise, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
