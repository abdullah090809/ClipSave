const MAX_FILENAME_LENGTH = 120;

// Reserved Windows filenames
const RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

export function sanitizeFilename(title: string | undefined, defaultPrefix: string = 'ClipSave_video'): string {
  if (!title || typeof title !== 'string') {
    return `${defaultPrefix}_${Date.now()}.mp4`;
  }

  // Remove control characters (\x00-\x1f, \x7f)
  let clean = title.replace(/[\x00-\x1F\x7F]/g, '');

  // Remove path traversal characters and illegal filesystem characters: \ / : * ? " < > |
  clean = clean.replace(/[\\/:*?"<>|]/g, '_');

  // Replace multiple underscores or spaces with a single space/underscore
  clean = clean.replace(/_{2,}/g, '_').trim();

  // If title was only invalid characters or whitespace
  if (!clean || clean === '.' || clean === '..') {
    clean = `${defaultPrefix}_${Date.now()}`;
  }

  // Check against reserved Windows names
  const upperBase = clean.split('.')[0]?.toUpperCase() || '';
  if (RESERVED_NAMES.has(upperBase)) {
    clean = `${clean}_safe`;
  }

  // Truncate to safe length
  if (clean.length > MAX_FILENAME_LENGTH) {
    clean = clean.slice(0, MAX_FILENAME_LENGTH).trim();
  }

  // Ensure .mp4 extension
  if (!clean.toLowerCase().endsWith('.mp4')) {
    clean = `${clean}.mp4`;
  }

  return clean;
}
