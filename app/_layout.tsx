import { useEffect, useState } from 'react';
import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { loadQueueFromStorage } from '../src/storage/queueStore';
import { cleanOrphanedTempFiles } from '../src/services/mediaManager';
import { getSettings } from '../src/storage/settingsStore';
import { checkAndWarmBackend } from '../src/services/apiClient';
import { LaunchAnimation } from '../src/components/LaunchAnimation';

import { StartupAnimationMode } from '../src/types';

// Hold native splash screen until theme and initial settings are fully hydrated
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigation() {
  const { isDark, colors, isThemeReady } = useTheme();
  const [appReady, setAppReady] = useState(false);
  const [startupAnimation, setStartupAnimation] = useState<StartupAnimationMode>('standard');

  useEffect(() => {
    async function initialize() {
      try {
        // One-shot silent pre-warm on app launch (boots sleeping backend in parallel)
        checkAndWarmBackend().catch(() => {});

        const [settings] = await Promise.all([
          getSettings(),
          loadQueueFromStorage(),
          cleanOrphanedTempFiles(),
        ]);
        const mode: StartupAnimationMode =
          settings.startupAnimation || (settings.enableLaunchAnimation !== false ? 'standard' : 'off');
        setStartupAnimation(mode);
      } catch {
        // Fallback safely
      } finally {
        setAppReady(true);
      }
    }
    initialize();
  }, []);

  const handleAnimationFinish = () => {
    SplashScreen.hideAsync().catch(() => {});
  };

  // If startup animation is off, reveal app immediately once theme & initial state are hydrated
  useEffect(() => {
    if (appReady && isThemeReady && startupAnimation === 'off') {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [appReady, isThemeReady, startupAnimation]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="about" options={{ headerShown: false, gestureEnabled: true }} />
      </Stack>

      {appReady && isThemeReady && startupAnimation !== 'off' && (
        <LaunchAnimation
          mode={startupAnimation}
          onFinish={handleAnimationFinish}
        />
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootNavigation />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
