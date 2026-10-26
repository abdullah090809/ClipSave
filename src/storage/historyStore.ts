import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { HistoryItem } from '../types';

const HISTORY_KEY = '@clipsave_history_v1';

export const getHistory = async (): Promise<HistoryItem[]> => {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const items: HistoryItem[] = JSON.parse(raw);
    
    // Check file existence asynchronously without blocking
    const verifiedItems = await Promise.all(
      items.map(async (item) => {
        try {
          const info = await FileSystem.getInfoAsync(item.fileUri);
          return { ...item, fileExists: info.exists };
        } catch {
          return { ...item, fileExists: false };
        }
      })
    );
    return verifiedItems;
  } catch {
    return [];
  }
};

export const addHistoryItem = async (item: HistoryItem): Promise<HistoryItem[]> => {
  const current = await getHistory();
  // Filter duplicate ID if exists
  const filtered = current.filter((h) => h.id !== item.id);
  const updated = [item, ...filtered];
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return updated;
};

export const removeHistoryEntryOnly = async (id: string): Promise<HistoryItem[]> => {
  const current = await getHistory();
  const updated = current.filter((h) => h.id !== id);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return updated;
};

export const deleteHistoryEntryAndFile = async (id: string): Promise<HistoryItem[]> => {
  const current = await getHistory();
  const target = current.find((h) => h.id === id);
  if (target && target.fileUri) {
    try {
      await FileSystem.deleteAsync(target.fileUri, { idempotent: true });
    } catch {
      // Ignore if file was already removed
    }
  }
  return removeHistoryEntryOnly(id);
};

export const clearHistoryEntriesOnly = async (): Promise<void> => {
  await AsyncStorage.removeItem(HISTORY_KEY);
};

export const clearHistoryAndFiles = async (): Promise<void> => {
  const current = await getHistory();
  for (const item of current) {
    try {
      if (item.fileUri) {
        await FileSystem.deleteAsync(item.fileUri, { idempotent: true });
      }
    } catch {
      // Ignore
    }
  }
  await AsyncStorage.removeItem(HISTORY_KEY);
};
