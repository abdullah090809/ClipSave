import {
  ensureTempDirectory,
  cleanOrphanedTempFiles,
  saveCompletedMedia,
  shareSavedMedia,
  DOWNLOADS_TEMP_DIR,
} from './mediaManager';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

describe('mediaManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    (FileSystem.getInfoAsync as jest.Mock)
      .mockResolvedValueOnce({ exists: true, modificationTime: oldTimestampSeconds })
      .mockResolvedValueOnce({ exists: true, modificationTime: newTimestampSeconds });

    const cleanedCount = await cleanOrphanedTempFiles();

    expect(cleanedCount).toBe(1);
    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
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

    (MediaLibrary.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
    });

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
});
