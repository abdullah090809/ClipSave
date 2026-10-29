import {
  ensureTempDirectory,
  cleanOrphanedTempFiles,
  saveCompletedMedia,
  shareSavedMedia,
  playVideo,
  saveOrExportToGallery,
  showFileLocationInfo,
  DOWNLOADS_TEMP_DIR,
} from './mediaManager';
import {
  addJobToQueue,
  clearTerminalJobs,
  loadQueueFromStorage,
  getQueue,
} from '../storage/queueStore';
import { DownloadJob } from '../types';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('mediaManager', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    (MediaLibrary.getPermissionsAsync as jest.Mock).mockReset();
    (MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
    (MediaLibrary.requestPermissionsAsync as jest.Mock).mockReset();
    (MediaLibrary.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (MediaLibrary.createAssetAsync as jest.Mock).mockReset();
    (MediaLibrary.createAssetAsync as jest.Mock).mockResolvedValue({ uri: 'file:///gallery/saved.mp4' });
    await AsyncStorage.clear();
    clearTerminalJobs();
    // Clear in-memory queue jobs
    const currentQueue = getQueue();
    currentQueue.forEach((j) => {
      j.state = 'CANCELLED';
    });
    clearTerminalJobs();
  });

  test('UT-MM-01: ensureTempDirectory creates directory when it does not exist', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: false });

    await ensureTempDirectory();

    expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(DOWNLOADS_TEMP_DIR, {
      intermediates: true,
    });
  });

  test('UT-MM-02: cleanOrphanedTempFiles deletes files older than threshold', async () => {
    (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValueOnce([
      'old_stream.tmp',
      'recent_stream.tmp',
    ]);

    const oldTimestampSeconds = (Date.now() - 3600 * 1000) / 1000; // 1 hour ago
    const newTimestampSeconds = (Date.now() - 60 * 1000) / 1000; // 1 minute ago

    (FileSystem.getInfoAsync as jest.Mock).mockImplementation(async (uri: string) => {
      if (uri === DOWNLOADS_TEMP_DIR) {
        return { exists: true, isDirectory: true };
      }
      if (uri.includes('old_stream.tmp')) {
        return { exists: true, modificationTime: oldTimestampSeconds };
      }
      if (uri.includes('recent_stream.tmp')) {
        return { exists: true, modificationTime: newTimestampSeconds };
      }
      return { exists: true, modificationTime: oldTimestampSeconds };
    });

    const cleanedCount = await cleanOrphanedTempFiles();

    expect(cleanedCount).toBe(1);
    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      `${DOWNLOADS_TEMP_DIR}old_stream.tmp`,
      { idempotent: true }
    );
  });

  test('UT-MM-03: saveCompletedMedia rejects corrupted or zero-byte file', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
      exists: true,
      size: 50, // Less than 1000 bytes
    });

    const result = await saveCompletedMedia('file:///tmp/zero.tmp', 'video.mp4', true);
    expect(result.success).toBe(false);
    expect(result.message).toContain('zero or invalid byte count');
  });

  test('UT-MM-04: saveCompletedMedia saves to gallery when permissions granted', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
      exists: true,
      size: 5000000,
    });

    (MediaLibrary.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'granted',
    });

    const result = await saveCompletedMedia('file:///tmp/good.tmp', 'video.mp4', true);
    expect(result.success).toBe(true);
    expect(result.savedToGallery).toBe(true);
    expect(MediaLibrary.createAssetAsync).toHaveBeenCalled();
  });

  test('UT-MM-05: saveCompletedMedia falls back to document storage when gallery denied', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
      exists: true,
      size: 5000000,
    });

    (MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
    });
    (MediaLibrary.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
    });
    (MediaLibrary.createAssetAsync as jest.Mock).mockRejectedValueOnce(new Error('Permission denied'));
    (MediaLibrary.saveToLibraryAsync as jest.Mock).mockRejectedValueOnce(new Error('Permission denied'));

    const result = await saveCompletedMedia('file:///tmp/good.tmp', 'video.mp4', true);
    expect(result.success).toBe(true);
    expect(result.savedToGallery).toBe(false);
    expect(result.message).toContain('Saved to app local storage');
  });

  test('UT-MM-06: shareSavedMedia invokes native share dialog', async () => {
    const success = await shareSavedMedia('file:///documents/video.mp4');
    expect(success).toBe(true);
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'file:///documents/video.mp4',
      expect.objectContaining({ mimeType: 'video/mp4' })
    );
  });

  test('UT-MM-07: falls back to safe timestamp filename if initial moveAsync fails', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
      exists: true,
      size: 5000000,
    });

    // Mock initial moveAsync failing, subsequent moveAsync succeeding
    (FileSystem.moveAsync as jest.Mock)
      .mockRejectedValueOnce(new Error("Call to function 'ExponentFileSystem.moveAsync' has been rejected."))
      .mockResolvedValueOnce(undefined);

    const result = await saveCompletedMedia('file:///tmp/download.tmp', 'broken#name.mp4', false);
    expect(result.success).toBe(true);
    expect(result.finalUri).toMatch(/ClipSave_\d+\.mp4$/);
    expect(FileSystem.moveAsync).toHaveBeenCalledTimes(2);
  });

  test('UT-MM-08: attempts MediaStore asset creation even if permissions check throws in Expo Go', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
      exists: true,
      size: 5000000,
    });

    // Simulate Expo Go throwing PermissionsException
    (MediaLibrary.getPermissionsAsync as jest.Mock).mockRejectedValueOnce(
      new Error("Due to changes in Android's permission requirements, Expo Go can no longer provide full access...")
    );
    (MediaLibrary.createAssetAsync as jest.Mock).mockResolvedValueOnce({
      uri: 'file:///gallery/saved.mp4',
    });

    const result = await saveCompletedMedia('file:///tmp/good.tmp', 'video.mp4', true);
    expect(result.success).toBe(true);
    expect(result.savedToGallery).toBe(true);
    expect(MediaLibrary.createAssetAsync).toHaveBeenCalled();
  });

  test('UT-MM-09: playVideo launches native android.intent.action.VIEW intent on Android', async () => {
    Platform.OS = 'android';
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
      exists: true,
      size: 5000000,
    });
    (FileSystem.getContentUriAsync as jest.Mock).mockResolvedValueOnce(
      'content://com.clipsave.app.provider/documents/video.mp4'
    );

    const success = await playVideo('file:///documents/video.mp4');
    expect(success).toBe(true);
    expect(FileSystem.getContentUriAsync).toHaveBeenCalledWith('file:///documents/video.mp4');
    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith(
      'android.intent.action.VIEW',
      expect.objectContaining({
        data: 'content://com.clipsave.app.provider/documents/video.mp4',
        type: 'video/mp4',
        flags: 1,
      })
    );
  });

  test('UT-MM-10: playVideo falls back to shareSavedMedia when intent launcher fails', async () => {
    Platform.OS = 'android';
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
      exists: true,
      size: 5000000,
    });
    (FileSystem.getContentUriAsync as jest.Mock).mockResolvedValueOnce(
      'content://com.clipsave.app.provider/documents/video.mp4'
    );
    (IntentLauncher.startActivityAsync as jest.Mock).mockRejectedValueOnce(
      new Error('No Activity found to handle Intent')
    );

    const success = await playVideo('file:///documents/video.mp4');
    expect(success).toBe(true);
    expect(Sharing.shareAsync).toHaveBeenCalled();
  });

  test('UT-MM-11: playVideo alerts when target file does not exist on storage', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
      exists: false,
    });

    const success = await playVideo('file:///documents/missing.mp4');
    expect(success).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith(
      'File Not Found',
      expect.stringContaining('could not be found')
    );
  });

  test('UT-MM-12: saveOrExportToGallery creates asset when permissions granted', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (MediaLibrary.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'granted',
      granted: true,
    });
    (MediaLibrary.createAssetAsync as jest.Mock).mockResolvedValueOnce({
      uri: 'file:///gallery/saved.mp4',
    });

    const success = await saveOrExportToGallery('file:///documents/video.mp4');
    expect(success).toBe(true);
    expect(MediaLibrary.createAssetAsync).toHaveBeenCalledWith('file:///documents/video.mp4');
    expect(Alert.alert).toHaveBeenCalledWith('Saved to Gallery', expect.stringContaining('successfully'));
  });

  test('UT-MM-13: saveOrExportToGallery falls back to Sharing.shareAsync when media library throws', async () => {
    (MediaLibrary.requestPermissionsAsync as jest.Mock).mockRejectedValueOnce(new Error('Permission denied'));
    (MediaLibrary.createAssetAsync as jest.Mock).mockRejectedValueOnce(new Error('Asset creation failed'));
    (MediaLibrary.saveToLibraryAsync as jest.Mock).mockRejectedValueOnce(new Error('Save failed'));

    const success = await saveOrExportToGallery('file:///documents/video.mp4');
    expect(success).toBe(true);
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'file:///documents/video.mp4',
      expect.objectContaining({ mimeType: 'video/mp4' })
    );
  });

  test('UT-MM-14: showFileLocationInfo displays Alert with clean file path and actions', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    showFileLocationInfo('file:///data/user/0/com.clipsave.app/files/video.mp4', 'Test Video');

    expect(alertSpy).toHaveBeenCalledWith(
      'File Storage Location',
      expect.stringContaining('/data/user/0/com.clipsave.app/files/video.mp4'),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Save to Device' }),
        expect.objectContaining({ text: 'Share' }),
        expect.objectContaining({ text: 'Close' }),
      ])
    );
  });

  test('UT-MM-REG-01: does NOT delete active downloading file even if older than 15 minutes', async () => {
    const activeJob: DownloadJob = {
      id: 'job_active_123',
      sourceUrl: 'https://tiktok.com/@user/video/1',
      media: {
        id: 'vid1',
        sourceUrl: 'https://tiktok.com/@user/video/1',
        title: 'Long Active Download',
        author: 'Creator',
        mediaUrl: 'https://cdn.example.com/stream.mp4',
        format: 'mp4',
        isCleanSourceVerified: true,
      },
      state: 'DOWNLOADING',
      bytesDownloaded: 500000,
      retryCount: 0,
      supportsResume: true,
      statusMessage: 'Downloading...',
      tempFilePath: `${DOWNLOADS_TEMP_DIR}active_old.tmp`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addJobToQueue(activeJob);

    (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValueOnce(['active_old.tmp']);
    // File is 25 minutes old
    const modTime = (Date.now() - 25 * 60 * 1000) / 1000;
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
      exists: true,
      modificationTime: modTime,
    });

    const cleaned = await cleanOrphanedTempFiles();
    expect(cleaned).toBe(0);
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });

  test('UT-MM-REG-02: does NOT delete paused or resumable download files even if older than 15 minutes', async () => {
    const pausedJob: DownloadJob = {
      id: 'job_paused_456',
      sourceUrl: 'https://tiktok.com/@user/video/2',
      media: {
        id: 'vid2',
        sourceUrl: 'https://tiktok.com/@user/video/2',
        title: 'Paused Download',
        author: 'Creator',
        mediaUrl: 'https://cdn.example.com/stream2.mp4',
        format: 'mp4',
        isCleanSourceVerified: true,
      },
      state: 'PAUSED',
      bytesDownloaded: 2000000,
      retryCount: 0,
      supportsResume: true,
      statusMessage: 'Paused by user',
      tempFilePath: `${DOWNLOADS_TEMP_DIR}paused_old.tmp`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const retryableJob: DownloadJob = {
      id: 'job_retryable_789',
      sourceUrl: 'https://tiktok.com/@user/video/3',
      media: {
        id: 'vid3',
        sourceUrl: 'https://tiktok.com/@user/video/3',
        title: 'Recoverable Interrupted Download',
        author: 'Creator',
        mediaUrl: 'https://cdn.example.com/stream3.mp4',
        format: 'mp4',
        isCleanSourceVerified: true,
      },
      state: 'FAILED',
      isRetryable: true,
      bytesDownloaded: 1500000,
      retryCount: 1,
      supportsResume: true,
      statusMessage: 'Interrupted',
      tempFilePath: `${DOWNLOADS_TEMP_DIR}resumable_old.tmp`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addJobToQueue(pausedJob);
    addJobToQueue(retryableJob);

    (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValueOnce([
      'paused_old.tmp',
      'resumable_old.tmp',
    ]);

    // Both files are 45 minutes old
    const modTime = (Date.now() - 45 * 60 * 1000) / 1000;
    (FileSystem.getInfoAsync as jest.Mock)
      .mockResolvedValueOnce({ exists: true, modificationTime: modTime })
      .mockResolvedValueOnce({ exists: true, modificationTime: modTime });

    const cleaned = await cleanOrphanedTempFiles();
    expect(cleaned).toBe(0);
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });

  test('UT-MM-REG-03: cleans genuinely unreferenced stale file', async () => {
    (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValueOnce([
      'unreferenced_garbage.tmp',
    ]);

    // 30 minutes old, not referenced in queue
    const modTime = (Date.now() - 30 * 60 * 1000) / 1000;
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
      exists: true,
      modificationTime: modTime,
    });

    const cleaned = await cleanOrphanedTempFiles();
    expect(cleaned).toBe(1);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      `${DOWNLOADS_TEMP_DIR}unreferenced_garbage.tmp`,
      { idempotent: true }
    );
  });

  test('UT-MM-REG-04: startup reconciliation reconciles active jobs and cleans only unreferenced files', async () => {
    // Setup persisted queue state in AsyncStorage before startup
    const interruptedJob: DownloadJob = {
      id: 'job_startup_interrupted',
      sourceUrl: 'https://tiktok.com/@user/video/4',
      media: {
        id: 'vid4',
        sourceUrl: 'https://tiktok.com/@user/video/4',
        title: 'Interrupted Download',
        author: 'Creator',
        mediaUrl: 'https://cdn.example.com/stream4.mp4',
        format: 'mp4',
        isCleanSourceVerified: true,
      },
      state: 'DOWNLOADING', // Interrupted by unexpected crash
      bytesDownloaded: 1200000,
      retryCount: 0,
      supportsResume: true,
      statusMessage: 'Downloading...',
      tempFilePath: `${DOWNLOADS_TEMP_DIR}interrupted.tmp`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem('@clipsave_queue_v1', JSON.stringify([interruptedJob]));

    // Reconcile on startup
    const loadedQueue = await loadQueueFromStorage();
    const reconciledJob = loadedQueue.find((j) => j.id === 'job_startup_interrupted');
    expect(reconciledJob?.state).toBe('FAILED');
    expect(reconciledJob?.isRetryable).toBe(true);
    expect(reconciledJob?.statusMessage).toContain('Interrupted');

    // On disk: the interrupted job's temp file + an unreferenced stray file
    (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValueOnce([
      'interrupted.tmp',
      'stray_abandoned.tmp',
    ]);

    const oldModTime = (Date.now() - 60 * 60 * 1000) / 1000;
    (FileSystem.getInfoAsync as jest.Mock)
      .mockResolvedValueOnce({ exists: true, modificationTime: oldModTime })
      .mockResolvedValueOnce({ exists: true, modificationTime: oldModTime });

    // Cleanup runs right after startup reconciliation
    const cleaned = await cleanOrphanedTempFiles();

    expect(cleaned).toBe(1);
    // Only stray_abandoned.tmp was deleted
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      `${DOWNLOADS_TEMP_DIR}stray_abandoned.tmp`,
      { idempotent: true }
    );
    expect(FileSystem.deleteAsync).not.toHaveBeenCalledWith(
      `${DOWNLOADS_TEMP_DIR}interrupted.tmp`,
      expect.anything()
    );
  });
});
