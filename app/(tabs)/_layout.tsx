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
        freezeOnBlur: false,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.outlineVariant,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
          elevation: 0,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Download',
          tabBarAccessibilityLabel: 'Download hub, paste or detect a link',
          tabBarIcon: icon('download', 'download-outline'),
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
          title: 'Library',
          tabBarAccessibilityLabel: 'Saved video library',
          tabBarIcon: icon('film', 'film-outline'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarAccessibilityLabel: 'Settings and configuration',
          tabBarIcon: icon('settings', 'settings-outline'),
        }}
      />
    </Tabs>
  );
}
