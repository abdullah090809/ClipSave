const MAX_FILENAME_LENGTH = 120;

// Reserved Windows filenames
const RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

export function sanitizeFilename(
  title: string | undefined,
  defaultPrefix: string = 'ClipSave_video',
  extension: string = 'mp4'
): string {
  const ext = (extension || 'mp4').toLowerCase().replace(/^\./, '');
  if (!title || typeof title !== 'string') {
    return `${defaultPrefix}_${Date.now()}.${ext}`;
  }

  // Remove control characters (\x00-\x1f, \x7f)
  let clean = title.replace(/[\x00-\x1F\x7F]/g, '');

  // Strip hashtags (#) - replace with empty string so #hashtag becomes hashtag
  clean = clean.replace(/#/g, '');

  // Remove path traversal and illegal filesystem / URI characters: \ / : * ? " < > | % & { } ~ ` ! @ $ = + ; , ^
  clean = clean.replace(/[\\/:*?"<>|%&{}~`!@$=+;,^]/g, '_');

  // Replace spaces and multiple underscores with a single underscore to guarantee valid URL/MIME parsing on Android
  clean = clean.replace(/[\s_]+/g, '_');

  // Strip leading and trailing periods, spaces, underscores, and dashes
  clean = clean.replace(/^[\s._-]+|[\s._-]+$/g, '');

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
    clean = clean.slice(0, MAX_FILENAME_LENGTH).trim().replace(/^[\s._-]+|[\s._-]+$/g, '');
  }

  // Ensure specified extension (e.g. .mp4, .mp3, .m4a)
  if (!clean.toLowerCase().endsWith(`.${ext}`)) {
    clean = `${clean}.${ext}`;
  }

  return clean;
}
