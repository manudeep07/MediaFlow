import { describe, it, expect } from 'vitest';
import { parseFormats } from '../../src/adapters/ytdlpAdapter.js';

describe('parseFormats helper', () => {
  it('correctly extracts unique resolutions and sorts them descending', () => {
    const rawFormats = [
      { format_id: '1', vcodec: 'avc1', acodec: 'none', height: 360, width: 640, fps: 30, ext: 'mp4', filesize: 5000000 },
      { format_id: '2', vcodec: 'avc1', acodec: 'none', height: 1080, width: 1920, fps: 60, ext: 'mp4', filesize: 25000000 },
      { format_id: '3', vcodec: 'vp9', acodec: 'none', height: 720, width: 1280, fps: 30, ext: 'webm', filesize: 12000000 },
      { format_id: '4', vcodec: 'avc1', acodec: 'none', height: 720, width: 1280, fps: 30, ext: 'mp4', filesize: 14000000 }, // Duplicate 720p, larger filesize
      { format_id: '5', vcodec: 'none', acodec: 'mp4a.40.2', abr: 128, ext: 'm4a' },
      { format_id: '6', vcodec: 'none', acodec: 'opus', abr: 160, ext: 'webm' },
    ];

    const result = parseFormats(rawFormats);

    expect(result.resolutions).toHaveLength(3);
    expect(result.resolutions[0].height).toBe(1080);
    expect(result.resolutions[0].resolution).toBe('1080p');
    expect(result.resolutions[1].height).toBe(720);
    expect(result.resolutions[1].resolution).toBe('720p');
    expect(result.resolutions[2].height).toBe(360);
    expect(result.resolutions[2].resolution).toBe('360p');

    expect(result.audioCodecs).toContain('mp4a');
    expect(result.audioCodecs).toContain('opus');
    expect(result.maxAudioBitrate).toBe(160);
  });

  it('handles empty or audio-only streams safely', () => {
    const emptyResult = parseFormats([]);
    expect(emptyResult.resolutions).toEqual([]);
    expect(emptyResult.audioCodecs).toEqual([]);
    expect(emptyResult.maxAudioBitrate).toBe(192); // default fallback
  });
});
