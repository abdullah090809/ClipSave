import * as Notifications from 'expo-notifications';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Platform } from 'react-native';

const KEEP_AWAKE_TAG = 'clipsave_download_tag';
let isChannelInitialized = false;
let activeDownloadsCount = 0;
const lastNotificationUpdate = new Map<string, number>();

// Configure foreground presentation behavior
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // Ignore in unsupported environments
}

export async function ensureNotificationChannel(): Promise<void> {
  if (isChannelInitialized || Platform.OS !== 'android') {
    return;
  }
  try {
    await Notifications.setNotificationChannelAsync('downloads', {
      name: 'Downloads',
      importance: Notifications.AndroidImportance.LOW,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FE2C55',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: false,
    });
    isChannelInitialized = true;
  } catch {
    // Ignore error
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch {
    return false;
  }
}

export async function notifyDownloadStarted(jobId: string, title: string): Promise<void> {
  activeDownloadsCount++;
  if (activeDownloadsCount === 1) {
    try {
      await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    } catch {
      // Ignore
    }
  }

  await ensureNotificationChannel();
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `download_${jobId}`,
      content: {
        title: 'ClipSave — Downloading',
        body: `${title.substring(0, 40)}... (Starting)`,
        data: { jobId },
        categoryIdentifier: 'downloads',
        sound: false,
      },
      trigger: null,
    });
  } catch {
    // Ignore notification failures
  }
}

export async function notifyDownloadProgress(
  jobId: string,
  title: string,
  percent: number,
  speedText?: string
): Promise<void> {
  const now = Date.now();
  const lastTime = lastNotificationUpdate.get(jobId) || 0;
  // Throttle updates to at most once every 1000ms to avoid flooding system IPC
  if (now - lastTime < 1000 && percent < 99) {
    return;
  }
  lastNotificationUpdate.set(jobId, now);

  await ensureNotificationChannel();
  try {
    const progressInt = Math.min(100, Math.max(0, Math.round(percent)));
    const speedInfo = speedText ? ` • ${speedText}` : '';
    await Notifications.scheduleNotificationAsync({
      identifier: `download_${jobId}`,
      content: {
        title: `ClipSave — Downloading (${progressInt}%)`,
        body: `${title.substring(0, 45)}\n${progressInt}% complete${speedInfo}`,
        data: { jobId, progress: progressInt },
        categoryIdentifier: 'downloads',
        sound: false,
      },
      trigger: null,
    });
  } catch {
    // Ignore
  }
}

export async function notifyDownloadCompleted(jobId: string, title: string): Promise<void> {
  lastNotificationUpdate.delete(jobId);
  activeDownloadsCount = Math.max(0, activeDownloadsCount - 1);
  if (activeDownloadsCount === 0) {
    try {
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    } catch {
      // Ignore
    }
  }

  await ensureNotificationChannel();
  try {
    // Dismiss the ongoing progress notification
    await Notifications.dismissNotificationAsync(`download_${jobId}`).catch(() => {});
    // Post completion notification
    await Notifications.scheduleNotificationAsync({
      identifier: `completed_${jobId}`,
      content: {
        title: 'ClipSave — Download Finished',
        body: `${title.substring(0, 50)} is saved to your gallery.`,
        data: { jobId },
        categoryIdentifier: 'downloads',
        sound: true,
      },
      trigger: null,
    });
  } catch {
    // Ignore
  }
}

export async function dismissDownloadNotification(jobId: string): Promise<void> {
  lastNotificationUpdate.delete(jobId);
  activeDownloadsCount = Math.max(0, activeDownloadsCount - 1);
  if (activeDownloadsCount === 0) {
    try {
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    } catch {
      // Ignore
    }
  }

  try {
    await Notifications.dismissNotificationAsync(`download_${jobId}`);
  } catch {
    // Ignore
  }
}
