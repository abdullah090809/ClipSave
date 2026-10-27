import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../src/theme/ThemeContext';
import { subscribeQueue } from '../../src/storage/queueStore';
import { jobBucket } from '../../src/utils/jobDisplay';

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon({
  focused,
  activeIcon,
  inactiveIcon,
  color,
}: {
  focused: boolean;
  activeIcon: IconName;
  inactiveIcon: IconName;
  color: any;
}) {
  return (
    <View style={styles.iconContainer}>
      <Ionicons
        name={focused ? activeIcon : inactiveIcon}
        size={23}
        color={color}
      />
      {focused ? (
        <View style={[styles.activeIndicator, { backgroundColor: color }]} />
      ) : (
        <View style={styles.inactiveSpacer} />
      )}
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
    ios: 58 + insets.bottom,
    android: 62 + bottomInset,
    default: 60,
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
          elevation: 12,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.2,
          marginTop: -2,
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
            />
          ),
          ...(activeCount > 0
            ? {
                tabBarBadge: activeCount,
                tabBarBadgeStyle: {
                  backgroundColor: colors.primary,
                  color: '#FFFFFF',
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
              activeIcon="time"
              inactiveIcon="time-outline"
              color={color}
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
    height: 32,
    width: 44,
  },
  activeIndicator: {
    width: 18,
    height: 3,
    borderRadius: 2,
    marginTop: 3,
  },
  inactiveSpacer: {
    height: 3,
    marginTop: 3,
  },
});
