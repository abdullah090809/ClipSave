import { useEffect, useRef, useState } from 'react';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../src/theme/ThemeContext';
import { subscribeQueue } from '../../src/storage/queueStore';
import { jobBucket } from '../../src/utils/jobDisplay';

type IconName = keyof typeof Ionicons.glyphMap;

const icon =
  (on: IconName, off: IconName) =>
  ({ color, focused }: { color: any; focused: boolean }) =>
    <Ionicons name={focused ? on : off} size={24} color={color} />;

export default function TabLayout() {
  const { colors } = useTheme();
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

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.outlineVariant,
          borderTopWidth: 1,
          elevation: 0,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home tab, paste a link to download',
          tabBarIcon: icon('home', 'home-outline'),
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{
          title: 'Queue',
          tabBarAccessibilityLabel: `Download queue tab, ${activeCount} active`,
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
          title: 'History',
          tabBarAccessibilityLabel: 'Saved video history tab',
          tabBarIcon: icon('albums', 'albums-outline'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarAccessibilityLabel: 'Settings tab',
          tabBarIcon: icon('settings', 'settings-outline'),
        }}
      />
    </Tabs>
  );
}
