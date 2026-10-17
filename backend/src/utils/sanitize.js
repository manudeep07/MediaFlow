import path from 'node:path';

/**
 * Sanitizes a filename string to prevent directory traversal, control characters,
 * Windows forbidden characters, and reserved device names.
 */
export function sanitizeFilename(filename, fallback = 'download') {
  if (!filename || typeof filename !== 'string') {
    return fallback;
  }

  // 1. Strip path components (directory traversal)
  let clean = path.basename(filename)
    .replace(/[/\\]/g, '_')
    .replace(/\0/g, '')
    .trim();

  // 2. Remove Windows forbidden characters: < > : " / \ | ? *
  clean = clean.replace(/[<>:"/\\|?*]/g, '_');

  // 3. Collapse multiple underscores into one
  clean = clean.replace(/_+/g, '_');

  // 4. Remove non-printable / control ASCII characters (0x00 - 0x1F, 0x7F)
  clean = clean.replace(/[\x00-\x1F\x7F]/g, '');

  // 4. Disallow filenames that start or end with dots or spaces
  clean = clean.replace(/^[. ]+|[. ]+$/g, '');

  // 5. Check against Windows reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
  const baseWithoutExt = path.parse(clean).name.toUpperCase();
  const reservedNames = [
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
  ];

  if (reservedNames.includes(baseWithoutExt)) {
    clean = `_${clean}`;
  }

  // 6. Limit max length to avoid MAX_PATH issues (max 120 chars for filename)
  if (clean.length > 120) {
    const ext = path.extname(clean);
    const base = path.basename(clean, ext);
    clean = `${base.slice(0, 120 - ext.length)}${ext}`;
  }

  return clean || fallback;
}
