import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
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

    // Move from .tmp to permanent app storage
    const destinationPath = `${FileSystem.documentDirectory}${sanitizedFilename}`;
    await FileSystem.moveAsync({
      from: sourceTempPath,
      to: destinationPath,
    });

    if (!requestGallery) {
      return {
        success: true,
        finalUri: destinationPath,
        savedToGallery: false,
      };
    }

    // Try saving to device MediaLibrary / Scoped Storage (Gallery)
    try {
      let perm = await MediaLibrary.getPermissionsAsync();
      if (perm.status !== 'granted') {
        perm = await MediaLibrary.requestPermissionsAsync();
      }
      if (perm.status !== 'granted') {
        perm = await MediaLibrary.requestPermissionsAsync(true);
      }

      if (perm.status === 'granted') {
        const asset = await MediaLibrary.createAssetAsync(destinationPath);
        try {
          const album = await MediaLibrary.getAlbumAsync('ClipSave');
          if (album) {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
          } else {
            await MediaLibrary.createAlbumAsync('ClipSave', asset, false);
          }
        } catch {
          // Album grouping can fail on some Android versions due to scoped storage, but asset is already created in MediaStore!
        }

        return {
          success: true,
          finalUri: asset.uri || destinationPath,
          savedToGallery: true,
          message: 'Saved to Gallery.',
        };
      }
    } catch {
      // Permission denied or limited environment (e.g. Expo Go)
    }

    return {
      success: true,
      finalUri: destinationPath,
      savedToGallery: false,
      message: 'Saved to app local storage. Use Share to export to gallery.',
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

export async function shareSavedMedia(fileUri: string): Promise<boolean> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    return false;
  }
  await Sharing.shareAsync(fileUri, {
    mimeType: 'video/mp4',
    dialogTitle: 'Share ClipSave Video',
  });
  return true;
}
