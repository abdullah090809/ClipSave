import React, { useCallback, useRef } from 'react';
import { Animated, GestureResponderEvent, Pressable, PressableProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { motion, isReduceMotion } from '../theme/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed. Defaults to motion.pressScale. */
  scaleTo?: number;
  children?: React.ReactNode;
}

/**
 * Pressable that shrinks slightly and dims while held. Replaces the instant
 * opacity flip so taps feel physical. Keeps the Android ripple untouched.
 */
export function PressableScale({
  scaleTo = motion.pressScale,
  style,
  onPressIn,
  onPressOut,
  disabled,
  children,
  ...rest
}: PressableScaleProps) {
  const pressed = useRef(new Animated.Value(0)).current;
  const baseOpacity = StyleSheet.flatten(style)?.opacity;
  const baseOpacityNum = typeof baseOpacity === 'number' ? baseOpacity : 1;

  const run = useCallback(
    (to: number) => {
      if (isReduceMotion()) {
        pressed.setValue(to);
        return;
      }
      Animated.timing(pressed, {
        toValue: to,
        duration: motion.duration.press,
        easing: motion.easing.move,
        useNativeDriver: true,
      }).start();
    },
    [pressed],
  );

  const handleIn = useCallback(
    (e: GestureResponderEvent) => {
      if (!disabled) run(1);
      onPressIn?.(e);
    },
    [disabled, run, onPressIn],
  );
  const handleOut = useCallback(
    (e: GestureResponderEvent) => {
      run(0);
      onPressOut?.(e);
    },
    [run, onPressOut],
  );

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={handleIn}
      onPressOut={handleOut}
      style={[
        style,
        {
          opacity: Animated.multiply(
            pressed.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] }),
            baseOpacityNum,
          ),
          transform: [{ scale: pressed.interpolate({ inputRange: [0, 1], outputRange: [1, scaleTo] }) }],
        },
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}
