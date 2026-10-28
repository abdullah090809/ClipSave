import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform, Animated } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../src/theme/ThemeContext';
import { ThemeColors } from '../../src/theme/colors';
import { subscribeQueue } from '../../src/storage/queueStore';
import { jobBucket } from '../../src/utils/jobDisplay';
import { motion, isReduceMotion } from '../../src/theme/motion';

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon({
  focused,
  activeIcon,
  inactiveIcon,
  color,
  colors,
}: {
  colors: ThemeColors;
  focused: boolean;
  activeIcon: IconName;
  inactiveIcon: IconName;
  color: any;
}) {
  const focus = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    if (isReduceMotion()) {
      focus.setValue(focused ? 1 : 0);
      return;
    }
    const anim = Animated.timing(focus, {
      toValue: focused ? 1 : 0,
      duration: motion.duration.base,
      easing: motion.easing.enter,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [focused, focus]);

  return (
    <View style={styles.iconContainer}>
      {/* Pill grows out from the centre and fades in behind the icon. */}
      <Animated.View
        style={[
          styles.pill,
          {
            backgroundColor: colors.primaryContainer,
            opacity: focus,
            transform: [{ scaleX: focus.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
          },
        ]}
      />
      <Animated.View
        style={{
          transform: [{ scale: focus.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
        }}
      >
        <Ionicons
          name={focused ? activeIcon : inactiveIcon}
          size={22}
          color={color}
        />
      </Animated.View>
    </View>
  );
}

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeCount, setActiveCount] = useState(0);
  const lastCount = useRef(0);

  useEffect(() => {
    return subscribeQueue((jobs) => {
      const n = jobs.filter((j) => jobBucket(j) === 'active').length;
      if (n !== lastCount.current) {
        lastCount.current = n;
        setActiveCount(n);
      }
    });
  }, []);

  // Safe bottom padding ensures elevation above Android 3-button & gesture pill bars
  const bottomInset = Math.max(insets.bottom, 10);
  const barHeight = Platform.select({
    ios: 64 + insets.bottom,
    android: 68 + bottomInset,
    default: 64,
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        freezeOnBlur: false,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.outlineVariant,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: barHeight,
          paddingBottom: bottomInset,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 0.1,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home and video downloader',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              activeIcon="home"
              inactiveIcon="home-outline"
              color={color}
              colors={colors}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{
          title: 'Queue',
          tabBarAccessibilityLabel: `Download Queue, ${activeCount} active`,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              activeIcon="download"
              inactiveIcon="download-outline"
              color={color}
              colors={colors}
            />
          ),
          ...(activeCount > 0
            ? {
                tabBarBadge: activeCount,
                tabBarBadgeStyle: {
                  backgroundColor: colors.primary,
                  color: colors.onPrimary,
                  fontSize: 11,
                  fontWeight: '700',
                },
              }
            : {}),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarAccessibilityLabel: 'Downloaded videos history',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              activeIcon="library"
              inactiveIcon="library-outline"
              color={color}
              colors={colors}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarAccessibilityLabel: 'Preferences and settings',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              activeIcon="settings"
              inactiveIcon="settings-outline"
              color={color}
              colors={colors}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    width: 64,
  },
  pill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
  },
});
