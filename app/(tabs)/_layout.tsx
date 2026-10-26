import { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { subscribeQueue } from '../../src/storage/queueStore';

export default function TabLayout() {
  const { colors } = useTheme();
  const [activeDownloadCount, setActiveDownloadCount] = useState(0);

  useEffect(() => {
    return subscribeQueue((jobs) => {
      const active = jobs.filter((j) => j.state === 'DOWNLOADING' || j.state === 'FINALIZING').length;
      setActiveDownloadCount(active);
    });
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.tabBarBorder,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Download',
          tabBarIcon: ({ color, size }: { color: any; size: number }) => (
            <Ionicons name="arrow-down-circle" size={size} color={color ?? colors.tabBarInactive} />
          ),
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{
          title: 'Queue',
          ...(activeDownloadCount > 0 ? { tabBarBadge: activeDownloadCount } : {}),
          tabBarIcon: ({ color, size }: { color: any; size: number }) => (
            <Ionicons name="layers" size={size} color={color ?? colors.tabBarInactive} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }: { color: any; size: number }) => (
            <Ionicons name="time" size={size} color={color ?? colors.tabBarInactive} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }: { color: any; size: number }) => (
            <Ionicons name="settings-sharp" size={size} color={color ?? colors.tabBarInactive} />
          ),
        }}
      />
    </Tabs>
  );
}
