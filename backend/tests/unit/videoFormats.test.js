import { describe, it, expect } from 'vitest';
import { buildVideoFormatSpec } from '../../src/adapters/ytdlpAdapter.js';

describe('Video Format Spec Builder & Fallback Policy', () => {
  it('returns best available format spec for best quality', () => {
    expect(buildVideoFormatSpec('best')).toBe('bestvideo+bestaudio/best');
    expect(buildVideoFormatSpec('')).toBe('bestvideo+bestaudio/best');
    expect(buildVideoFormatSpec(null)).toBe('bestvideo+bestaudio/best');
  });

  it('builds exact or next lower compatible resolution spec for 1080p', () => {
    const spec = buildVideoFormatSpec('1080p');
    expect(spec).toBe('bestvideo[height<=1080]+bestaudio/best[height<=1080]/best');
  });

  it('builds exact or next lower compatible resolution spec for 720p and 480p', () => {
    expect(buildVideoFormatSpec('720p'))
      .toBe('bestvideo[height<=720]+bestaudio/best[height<=720]/best');

    expect(buildVideoFormatSpec('480p'))
      .toBe('bestvideo[height<=480]+bestaudio/best[height<=480]/best');
  });

  it('handles custom resolution numbers gracefully', () => {
    expect(buildVideoFormatSpec('2160'))
      .toBe('bestvideo[height<=2160]+bestaudio/best[height<=2160]/best');
  });
});
