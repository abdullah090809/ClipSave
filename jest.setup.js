// Jest setup file for ClipSave
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo-file-system/legacy
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock/documents/',
  cacheDirectory: 'file:///mock/cache/',
  getInfoAsync: jest.fn(async (uri) => ({ exists: true, size: 5000000, uri })),
  deleteAsync: jest.fn(async () => {}),
  makeDirectoryAsync: jest.fn(async () => {}),
  readDirectoryAsync: jest.fn(async () => []),
  moveAsync: jest.fn(async () => {}),
  copyAsync: jest.fn(async () => {}),
  getContentUriAsync: jest.fn(async (uri) => `content://mock/${uri}`),
  createDownloadResumable: jest.fn(() => ({
    downloadAsync: jest.fn(async () => ({ status: 200, uri: 'file:///mock/downloaded.mp4' })),
    pauseAsync: jest.fn(async () => {}),
    resumeAsync: jest.fn(async () => {}),
    cancelAsync: jest.fn(async () => {}),
  })),
}));

// Mock expo-media-library and expo-media-library/legacy
const mockMediaLibrary = {
  getPermissionsAsync: jest.fn(async () => ({ status: 'undetermined' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  createAssetAsync: jest.fn(async (uri) => ({ uri })),
  saveToLibraryAsync: jest.fn(async () => {}),
  getAlbumAsync: jest.fn(async () => null),
  createAlbumAsync: jest.fn(async () => {}),
  addAssetsToAlbumAsync: jest.fn(async () => {}),
  getAssetInfoAsync: jest.fn(async (uri) => ({ localUri: uri })),
};
jest.mock('expo-media-library', () => mockMediaLibrary);
jest.mock('expo-media-library/legacy', () => mockMediaLibrary);

// Mock expo-sharing
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));

// Mock expo-intent-launcher
jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: jest.fn(async () => ({ resultCode: -1 })),
}));
