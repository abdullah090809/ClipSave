import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { getQueue } from '../storage/queueStore';

export const DOWNLOADS_TEMP_DIR = `${FileSystem.cacheDirectory}downloads/`;

export async function ensureTempDirectory(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(DOWNLOADS_TEMP_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(DOWNLOADS_TEMP_DIR, { intermediates: true });
  }
}

/**
 * Returns a set of temporary file URIs and filenames that currently belong to
 * active, paused, finalizing, or retryable download jobs.
 */
export function getActiveTempFilePaths(): Set<string> {
  const protectedSet = new Set<string>();
  const queue = getQueue();

  for (const job of queue) {
    // Protect files belonging to:
    // 1. In-flight downloads (DOWNLOADING, FINALIZING, PENDING)
    // 2. Paused downloads (PAUSED)
    // 3. Resumable interrupted downloads (FAILED with isRetryable)
    const isProtected =
      job.state === 'DOWNLOADING' ||
      job.state === 'PAUSED' ||
      job.state === 'FINALIZING' ||
      job.state === 'QUEUED' ||
      (job.state === 'FAILED' && job.isRetryable);

    if (isProtected && job.tempFilePath) {
      protectedSet.add(job.tempFilePath);
      protectedSet.add(job.tempFilePath.replace(/^file:\/\//, ''));
      // Also extract the basename (e.g. "job_123.tmp")
      const basename = job.tempFilePath.split('/').pop();
      if (basename) {
        protectedSet.add(basename);
      }
    }
  }

  return protectedSet;
}

/**
 * Cleans temporary stream files that are genuinely unreferenced by any active,
 * paused, or resumable download job and have aged beyond the safety window.
 */
export async function cleanOrphanedTempFiles(
  explicitProtectedPaths?: Set<string>
): Promise<number> {
  try {
    await ensureTempDirectory();
    const files = await FileSystem.readDirectoryAsync(DOWNLOADS_TEMP_DIR);
    let cleaned = 0;

    const protectedPaths = explicitProtectedPaths ?? getActiveTempFilePaths();

    for (const f of files) {
      const fullPath = `${DOWNLOADS_TEMP_DIR}${f}`;
      const normalizedPath = fullPath.replace(/^file:\/\//, '');

      // Check if file is referenced by an active, paused, or resumable job
      if (
        protectedPaths.has(fullPath) ||
        protectedPaths.has(normalizedPath) ||
        protectedPaths.has(f)
      ) {
        continue; // PROTECTED: Active/paused/resumable download in progress
      }

      const info = await FileSystem.getInfoAsync(fullPath);
      if (info.exists) {
        const modTimeMs = (info.modificationTime || 0) * 1000;
        const ageMinutes = (Date.now() - modTimeMs) / (1000 * 60);

        // Clean if genuinely unreferenced AND older than 5 minutes (or lacking modification timestamp)
        if (ageMinutes > 5 || !info.modificationTime) {
          await FileSystem.deleteAsync(fullPath, { idempotent: true });
          cleaned++;
        }
      }
    }
    return cleaned;
  } catch {
    return 0;
  }
}

export interface SaveMediaResult {
  success: boolean;
  finalUri: string;
  savedToGallery: boolean;
  message?: string | undefined;
}

/**
 * Requests device media library / gallery permissions upfront with granular support.
 * Returns true if permission is granted.
 */
export async function ensureMediaLibraryPermissions(): Promise<boolean> {
  try {
    const perm = await MediaLibrary.getPermissionsAsync();
    if (perm?.granted || perm?.status === 'granted') {
      return true;
    }
    const requested = await MediaLibrary.requestPermissionsAsync();
    return requested?.granted || requested?.status === 'granted';
  } catch (err) {
    console.warn('ensureMediaLibraryPermissions failed:', err);
    return false;
  }
}

export async function saveCompletedMedia(
  sourceTempPath: string,
  sanitizedFilename: string,
  requestGallery: boolean = true
): Promise<SaveMediaResult> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(sourceTempPath);
    if (!fileInfo.exists || !fileInfo.size || fileInfo.size < 1000) {
      return {
        success: false,
        finalUri: sourceTempPath,
        savedToGallery: false,
        message: 'Download produced zero or invalid byte count.',
      };
    }

    // Move from .tmp to permanent app storage with resilient fallback
    let destinationPath = `${FileSystem.documentDirectory}${sanitizedFilename}`;
    try {
      await FileSystem.moveAsync({
        from: sourceTempPath,
        to: destinationPath,
      });
    } catch (moveErr) {
      console.warn('Initial moveAsync failed, falling back to safe timestamp filename:', moveErr);
      const fallbackFilename = `ClipSave_${Date.now()}.mp4`;
      destinationPath = `${FileSystem.documentDirectory}${fallbackFilename}`;
      try {
        await FileSystem.moveAsync({
          from: sourceTempPath,
          to: destinationPath,
        });
      } catch (fallbackMoveErr) {
        console.warn('Fallback moveAsync failed, attempting copy and delete:', fallbackMoveErr);
        await FileSystem.copyAsync({
          from: sourceTempPath,
          to: destinationPath,
        });
        await FileSystem.deleteAsync(sourceTempPath, { idempotent: true });
      }
    }

    if (!requestGallery) {
      return {
        success: true,
        finalUri: destinationPath,
        savedToGallery: false,
      };
    }

    // Save to device Gallery / MediaStore
    let savedToGallery = false;
    let permExplicitlyDenied = false;
    try {
      const perm = await MediaLibrary.getPermissionsAsync();
      if (!perm?.granted && perm?.status !== 'granted') {
        const requested = await MediaLibrary.requestPermissionsAsync();
        if (requested?.status === 'denied' && !requested?.granted) {
          permExplicitlyDenied = true;
        }
      }
    } catch {
      // In Expo Go or sandboxed environments, getPermissionsAsync throws.
      // Allow best-effort attempt with createAssetAsync / saveToLibraryAsync.
      permExplicitlyDenied = false;
    }

    if (!permExplicitlyDenied) {
      try {
        const asset = await MediaLibrary.createAssetAsync(destinationPath);
        if (asset) {
          savedToGallery = true;
          try {
            const album = await MediaLibrary.getAlbumAsync('ClipSave');
            if (album) {
              await MediaLibrary.addAssetsToAlbumAsync([asset], album, true);
            } else {
              await MediaLibrary.createAlbumAsync('ClipSave', asset, true);
            }
          } catch {
            // Album grouping optional; asset is already in MediaStore
          }
        }
      } catch (assetErr) {
        console.warn('createAssetAsync failed, trying saveToLibraryAsync fallback:', assetErr);
        try {
          await MediaLibrary.saveToLibraryAsync(destinationPath);
          savedToGallery = true;
        } catch (saveErr) {
          console.warn('saveToLibraryAsync failed:', saveErr);
        }
      }
    }

    return {
      success: true,
      finalUri: destinationPath,
      savedToGallery,
      message: savedToGallery ? 'Saved to Gallery.' : 'Saved to app local storage. Use Share to export to gallery.',
    };
  } catch (error: any) {
    return {
      success: false,
      finalUri: sourceTempPath,
      savedToGallery: false,
      message: error?.message || 'Failed to save downloaded file.',
    };
  }
}

/**
 * Directly opens the downloaded video in the user's default Video Player or Gallery app
 * using Android's native android.intent.action.VIEW intent.
 */
export async function playVideo(fileUri: string): Promise<boolean> {
  try {
    let targetUri = fileUri;

    // Resolve content:// URI from MediaStore to local file:// path if needed
    if (targetUri.startsWith('content://')) {
      try {
        const assetInfo = await MediaLibrary.getAssetInfoAsync(targetUri);
        if (assetInfo?.localUri) {
          targetUri = assetInfo.localUri;
        }
      } catch {
        // Fallback below
      }
    }

    // Ensure URI is properly prefixed
    if (!targetUri.startsWith('file://') && !targetUri.startsWith('content://')) {
      targetUri = `file://${targetUri}`;
    }

    // Verify file exists on local storage
    const info = await FileSystem.getInfoAsync(targetUri);
    if (!info.exists) {
      const filename = targetUri.split('/').pop();
      if (filename) {
        const docPath = `${FileSystem.documentDirectory}${filename}`;
        const docInfo = await FileSystem.getInfoAsync(docPath);
        if (docInfo.exists) {
          targetUri = docPath;
        } else {
          Alert.alert('File Not Found', 'The downloaded video file could not be found on storage.');
          return false;
        }
      } else {
        Alert.alert('File Not Found', 'The downloaded video file could not be found on storage.');
        return false;
      }
    }

    if (Platform.OS === 'android') {
      try {
        // Convert to content:// URI using Expo FileProvider so external video players/gallery apps have read access
        const contentUri = await FileSystem.getContentUriAsync(targetUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          type: 'video/mp4',
          flags: 1, // Intent.FLAG_GRANT_READ_URI_PERMISSION
        });
        return true;
      } catch (intentErr) {
        console.warn('IntentLauncher.startActivityAsync failed, falling back to shareAsync:', intentErr);
        return shareSavedMedia(targetUri);
      }
    } else {
      // iOS / other
      return shareSavedMedia(targetUri);
    }
  } catch (err: any) {
    console.warn('playVideo failed:', err);
    return shareSavedMedia(fileUri);
  }
}

export async function shareSavedMedia(fileUri: string): Promise<boolean> {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Sharing Unavailable', 'Video playback or sharing is not supported on this device.');
      return false;
    }

    let targetUri = fileUri;

    // Resolve content:// URI from MediaStore to local file:// path if needed
    if (targetUri.startsWith('content://')) {
      try {
        const assetInfo = await MediaLibrary.getAssetInfoAsync(targetUri);
        if (assetInfo?.localUri) {
          targetUri = assetInfo.localUri;
        }
      } catch {
        // Fallback below
      }
    }

    // Ensure URI is properly prefixed
    if (!targetUri.startsWith('file://') && !targetUri.startsWith('content://')) {
      targetUri = `file://${targetUri}`;
    }

    // Verify file exists on local storage
    const info = await FileSystem.getInfoAsync(targetUri);
    if (!info.exists) {
      const filename = targetUri.split('/').pop();
      if (filename) {
        const docPath = `${FileSystem.documentDirectory}${filename}`;
        const docInfo = await FileSystem.getInfoAsync(docPath);
        if (docInfo.exists) {
          targetUri = docPath;
        } else {
          Alert.alert('File Not Found', 'The downloaded video file could not be found on storage.');
          return false;
        }
      } else {
        Alert.alert('File Not Found', 'The downloaded video file could not be found on storage.');
        return false;
      }
    }

    await Sharing.shareAsync(targetUri, {
      mimeType: 'video/mp4',
      dialogTitle: 'Play Video',
    });
    return true;
  } catch (err: any) {
    console.warn('shareSavedMedia failed:', err);
    Alert.alert('Playback Error', 'Could not open video player.');
    return false;
  }
}
