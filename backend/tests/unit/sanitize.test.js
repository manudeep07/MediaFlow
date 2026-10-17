import { describe, it, expect } from 'vitest';
import { sanitizeFilename } from '../../src/utils/sanitize.js';

describe('Filename Sanitization', () => {
  it('strips directory traversal and path separators', () => {
    expect(sanitizeFilename('../../../secret.mp3')).toBe('secret.mp3');
    expect(sanitizeFilename('folder/subfolder/song.mp3')).toBe('song.mp3');
  });

  it('removes Windows forbidden characters', () => {
    expect(sanitizeFilename('Song: Best *Ever* <Live>? | Part 1.mp3'))
      .toBe('Song_ Best _Ever_ _Live_ _ Part 1.mp3');
  });

  it('prefixes Windows reserved device names', () => {
    expect(sanitizeFilename('CON.mp3')).toBe('_CON.mp3');
    expect(sanitizeFilename('nul.mp3')).toBe('_nul.mp3');
    expect(sanitizeFilename('aux.wav')).toBe('_aux.wav');
    expect(sanitizeFilename('com1.mp3')).toBe('_com1.mp3');
  });

  it('limits excessive filename lengths', () => {
    const longName = 'a'.repeat(200) + '.mp3';
    const cleaned = sanitizeFilename(longName);
    expect(cleaned.length).toBeLessThanOrEqual(120);
    expect(cleaned.endsWith('.mp3')).toBe(true);
  });

  it('provides safe fallback for empty or invalid inputs', () => {
    expect(sanitizeFilename('')).toBe('download');
    expect(sanitizeFilename(null)).toBe('download');
    expect(sanitizeFilename('   ')).toBe('download');
  });
});
