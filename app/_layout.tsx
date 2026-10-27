import { useEffect, useState } from 'react';
import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { loadQueueFromStorage } from '../src/storage/queueStore';
import { cleanOrphanedTempFiles } from '../src/services/mediaManager';
import { getSettings } from '../src/storage/settingsStore';
import { LaunchAnimation } from '../src/components/LaunchAnimation';

// Hold native splash screen until theme and initial settings are fully hydrated
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigation() {
  const { isDark, colors, isThemeReady } = useTheme();
  const [appReady, setAppReady] = useState(false);
  const [enableLaunchAnimation, setEnableLaunchAnimation] = useState(true);

  useEffect(() => {
    async function initialize() {
      try {
        const [settings] = await Promise.all([
          getSettings(),
          loadQueueFromStorage(),
          cleanOrphanedTempFiles(),
        ]);
        setEnableLaunchAnimation(settings.enableLaunchAnimation !== false);
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

  // If launch animation is disabled, reveal app as soon as theme & initial state are hydrated
  useEffect(() => {
    if (appReady && isThemeReady && !enableLaunchAnimation) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [appReady, isThemeReady, enableLaunchAnimation]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade_from_bottom',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="preview"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen name="about" options={{ headerShown: false }} />
      </Stack>

      {appReady && isThemeReady && enableLaunchAnimation && (
        <LaunchAnimation
          enabled={enableLaunchAnimation}
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
