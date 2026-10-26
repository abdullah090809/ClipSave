import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

export const DOWNLOADS_TEMP_DIR = `${FileSystem.cacheDirectory}downloads/`;

export async function ensureTempDirectory(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(DOWNLOADS_TEMP_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(DOWNLOADS_TEMP_DIR, { intermediates: true });
  }
}

export async function cleanOrphanedTempFiles(): Promise<number> {
  try {
    await ensureTempDirectory();
    const files = await FileSystem.readDirectoryAsync(DOWNLOADS_TEMP_DIR);
    let cleaned = 0;
    for (const f of files) {
      const fullPath = `${DOWNLOADS_TEMP_DIR}${f}`;
      const info = await FileSystem.getInfoAsync(fullPath);
      // Clean partial or temporary files older than 15 minutes to prevent race conditions with active downloads
      if (info.exists) {
        const modTimeMs = (info.modificationTime || 0) * 1000;
        const ageMinutes = (Date.now() - modTimeMs) / (1000 * 60);
        if (ageMinutes > 15 || !info.modificationTime) {
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

    // Try saving to device MediaLibrary / Scoped Storage
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        const asset = await MediaLibrary.createAssetAsync(destinationPath);
        const album = await MediaLibrary.getAlbumAsync('ClipSave');
        if (album) {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        } else {
          await MediaLibrary.createAlbumAsync('ClipSave', asset, false);
        }

        return {
          success: true,
          finalUri: asset.uri || destinationPath,
          savedToGallery: true,
          message: 'Saved to Gallery in ClipSave album.',
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
