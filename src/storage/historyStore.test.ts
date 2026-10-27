import {
  getHistory,
  addHistoryItem,
  removeHistoryEntryOnly,
  clearHistoryEntriesOnly,
} from './historyStore';
import { HistoryItem } from '../types';

describe('historyStore', () => {
  beforeEach(async () => {
    await clearHistoryEntriesOnly();
  });

  const sampleItem: HistoryItem = {
    id: 'hist_101',
    sourceUrl: 'https://www.tiktok.com/@user/video/101',
    title: 'Saved Creative Video',
    author: 'Creator101',
    fileUri: 'file:///data/user/0/com.clipsave.app/files/Saved_Creative_Video.mp4',
    fileSizeBytes: 4200000,
    durationSeconds: 15,
    savedAt: new Date().toISOString(),
    fileExists: true,
  };

  test('adds history item and retrieves it', async () => {
    await addHistoryItem(sampleItem);
    const items = await getHistory();
    expect(items.length).toBe(1);
    expect(items[0]?.id).toBe('hist_101');
    expect(items[0]?.title).toBe('Saved Creative Video');
  });

  test('removes history entry without deleting file', async () => {
    await addHistoryItem(sampleItem);
    const updated = await removeHistoryEntryOnly('hist_101');
    expect(updated.length).toBe(0);

    const items = await getHistory();
    expect(items.length).toBe(0);
  });

  test('clearHistoryEntriesOnly clears all records', async () => {
    await addHistoryItem(sampleItem);
    await addHistoryItem({ ...sampleItem, id: 'hist_102' });
    await clearHistoryEntriesOnly();

    const items = await getHistory();
    expect(items.length).toBe(0);
  });
});

describe('checkHistoryFilesExist', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const FileSystem = require('expo-file-system/legacy');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { checkHistoryFilesExist } = require('./historyStore');

  test('reports existing, missing and throwing files individually', async () => {
    FileSystem.getInfoAsync.mockImplementation(async (uri: string) => {
      if (uri.includes('throws')) throw new Error('io');
      return { exists: !uri.includes('missing'), uri };
    });
    const result = await checkHistoryFilesExist([
      { id: 'a', fileUri: 'file:///ok.mp4' },
      { id: 'b', fileUri: 'file:///missing.mp4' },
      { id: 'c', fileUri: 'file:///throws.mp4' },
    ]);
    expect(result).toEqual({ a: true, b: false, c: false });
  });
});
