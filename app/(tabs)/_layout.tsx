import { useState, useEffect } from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { borderRadius, elevation } from '../../src/theme/spacing';
import { subscribeQueue } from '../../src/storage/queueStore';

export default function TabLayout() {
  const { colors } = useTheme();
  const [activeDownloadCount, setActiveDownloadCount] = useState(0);

  useEffect(() => {
    return subscribeQueue((jobs) => {
      const active = jobs.filter((j) => j.state === 'DOWNLOADING' || j.state === 'FINALIZING').length;
      setActiveDownloadCount((prev) => (prev !== active ? active : prev));
    });
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.outlineVariant || colors.tabBarBorder,
          borderTopWidth: 1,
          height: Platform.OS === 'android' ? 68 : 64,
          paddingBottom: Platform.OS === 'android' ? 10 : 8,
          paddingTop: 8,
          ...(Platform.OS === 'android' ? elevation.level2 : {}),
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Download',
          tabBarAccessibilityLabel: 'Download tab, paste and resolve TikTok videos',
          tabBarIcon: ({ color, focused }: { color: any; focused: boolean }) => (
            <View
              style={[
                styles.iconWrapper,
                focused && {
                  backgroundColor: colors.primaryContainer || colors.primaryLight,
                },
              ]}
            >
              <Ionicons
                name={focused ? 'arrow-down-circle' : 'arrow-down-circle-outline'}
                size={22}
                color={focused ? colors.primary : color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{
          title: 'Queue',
          tabBarAccessibilityLabel: `Download queue tab, ${activeDownloadCount} active downloads`,
          ...(activeDownloadCount > 0
            ? {
                tabBarBadge: activeDownloadCount,
                tabBarBadgeStyle: {
                  backgroundColor: colors.primary,
                  color: '#FFFFFF',
                  fontSize: 11,
                  fontWeight: '700',
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  lineHeight: 18,
                },
              }
            : {}),
          tabBarIcon: ({ color, focused }: { color: any; focused: boolean }) => (
            <View
              style={[
                styles.iconWrapper,
                focused && {
                  backgroundColor: colors.primaryContainer || colors.primaryLight,
                },
              ]}
            >
              <Ionicons
                name={focused ? 'layers' : 'layers-outline'}
                size={22}
                color={focused ? colors.primary : color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarAccessibilityLabel: 'Saved video history tab',
          tabBarIcon: ({ color, focused }: { color: any; focused: boolean }) => (
            <View
              style={[
                styles.iconWrapper,
                focused && {
                  backgroundColor: colors.primaryContainer || colors.primaryLight,
                },
              ]}
            >
              <Ionicons
                name={focused ? 'time' : 'time-outline'}
                size={22}
                color={focused ? colors.primary : color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarAccessibilityLabel: 'Application settings tab',
          tabBarIcon: ({ color, focused }: { color: any; focused: boolean }) => (
            <View
              style={[
                styles.iconWrapper,
                focused && {
                  backgroundColor: colors.primaryContainer || colors.primaryLight,
                },
              ]}
            >
              <Ionicons
                name={focused ? 'settings-sharp' : 'settings-outline'}
                size={22}
                color={focused ? colors.primary : color}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    width: 44,
    height: 28,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
