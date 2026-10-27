import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../src/theme/ThemeContext';
import { subscribeQueue } from '../../src/storage/queueStore';
import { jobBucket } from '../../src/utils/jobDisplay';

type IconName = keyof typeof Ionicons.glyphMap;

const icon =
  (on: IconName, off: IconName) =>
  ({ color, focused }: { color: any; focused: boolean }) =>
    <Ionicons name={focused ? on : off} size={23} color={color} />;

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

  // Safe bottom padding guarantees the navigation bar is elevated completely
  // above Android system navigation bars and gesture pill bars on any device
  const bottomInset = Math.max(insets.bottom, 12);
  const barHeight = 54 + bottomInset;

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
          elevation: 10,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Downloader',
          tabBarAccessibilityLabel: 'Central downloader orb',
          tabBarIcon: icon('disc', 'disc-outline'),
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{
          title: 'Activity',
          tabBarAccessibilityLabel: `Activity and transfer queue, ${activeCount} active`,
          tabBarIcon: icon('swap-vertical', 'swap-vertical-outline'),
          ...(activeCount > 0
            ? {
                tabBarBadge: activeCount,
                tabBarBadgeStyle: { backgroundColor: colors.primary, color: '#FFFFFF', fontSize: 11 },
              }
            : {}),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Videos',
          tabBarAccessibilityLabel: 'Saved video library',
          tabBarIcon: icon('film', 'film-outline'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarAccessibilityLabel: 'Settings and preferences',
          tabBarIcon: icon('settings', 'settings-outline'),
        }}
      />
    </Tabs>
  );
}
