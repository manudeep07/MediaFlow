import { spawn } from 'node:child_process';
import { getEnv } from '../config/env.js';
import { logger } from '../middleware/logger.js';

export function parseFormats(formats = []) {
  const resolutionsMap = new Map();
  const audioCodecs = new Set();
  let maxAudioBitrate = 0;

  for (const fmt of formats) {
    // Collect audio info
    if (fmt.acodec && fmt.acodec !== 'none') {
      audioCodecs.add(fmt.acodec.split('.')[0]);
      if (fmt.abr && fmt.abr > maxAudioBitrate) {
        maxAudioBitrate = Math.round(fmt.abr);
      }
    }

    // Collect video resolutions
    if (fmt.vcodec && fmt.vcodec !== 'none' && fmt.height) {
      const height = fmt.height;
      const resKey = `${height}p`;
      
      const existing = resolutionsMap.get(resKey);
      const filesize = fmt.filesize || fmt.filesize_approx || null;
      
      if (!existing || (filesize && (!existing.filesize || filesize > existing.filesize))) {
        resolutionsMap.set(resKey, {
          resolution: resKey,
          height: height,
          width: fmt.width || null,
          fps: fmt.fps || null,
          vcodec: fmt.vcodec.split('.')[0],
          container: fmt.ext || 'mp4',
          filesize: filesize,
          formatId: fmt.format_id,
        });
      }
    }
  }

  // Sort resolutions descending (e.g., 2160p, 1080p, 720p, 480p, 360p...)
  const availableResolutions = Array.from(resolutionsMap.values()).sort(
    (a, b) => b.height - a.height
  );

  return {
    resolutions: availableResolutions,
    audioCodecs: Array.from(audioCodecs),
    maxAudioBitrate: maxAudioBitrate || 192,
  };
}

export async function inspectMedia(url) {
  const env = getEnv();
  const ytdlpPath = env.YT_DLP_PATH;

  // Security hardened arguments
  const args = [
    '--dump-single-json',
    '--flat-playlist',
    '--no-exec',
    '--ignore-config',
    '--socket-timeout',
    '30',
    '--',
    url,
  ];

  logger.info({ ytdlpPath, url }, 'Inspecting media via yt-dlp');

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let exited = false;

    const child = spawn(ytdlpPath, args, {
      windowsHide: true,
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large playlist dumps
    });

    const timeout = setTimeout(() => {
      if (!exited) {
        exited = true;
        try {
          child.kill();
        } catch (e) {}
        reject(new Error('Media inspection timed out after 30 seconds'));
      }
    }, 35000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      if (exited) return;
      exited = true;
      clearTimeout(timeout);
      logger.error({ err, url }, 'Failed to spawn yt-dlp for inspection');
      reject(new Error(`Failed to start media inspector: ${err.message}`));
    });

    child.on('close', (code) => {
      if (exited) return;
      exited = true;
      clearTimeout(timeout);

      if (code !== 0) {
        const errorClean = stderr.trim() || `Inspection process exited with code ${code}`;
        logger.warn({ code, stderr: errorClean, url }, 'Media inspection failed in yt-dlp');
        return reject(new Error(`Source inspection error: ${errorClean}`));
      }

      try {
        const data = JSON.parse(stdout);
        const isPlaylist = data._type === 'playlist' || Array.isArray(data.entries);

        if (isPlaylist) {
          const rawEntries = data.entries || [];
          const entries = rawEntries.slice(0, env.MAX_PLAYLIST_ITEMS).map((entry, idx) => ({
            index: idx + 1,
            id: entry.id || `item-${idx + 1}`,
            title: entry.title || `Item ${idx + 1}`,
            url: entry.url || entry.webpage_url || url,
            duration: entry.duration || null,
          }));

          const result = {
            isPlaylist: true,
            id: data.id || 'playlist',
            title: data.title || 'Untitled Playlist',
            description: data.description || '',
            thumbnail: data.thumbnails?.[0]?.url || rawEntries[0]?.thumbnails?.[0]?.url || null,
            uploader: data.uploader || data.channel || 'Unknown Uploader',
            itemCount: rawEntries.length,
            entries,
            // Standard choices for playlists
            availableAudioFormats: ['mp3', 'm4a', 'webm'],
            availableResolutions: [
              { resolution: 'best', height: 9999, label: 'Best Available Quality' },
              { resolution: '1080p', height: 1080, label: '1080p (FHD)' },
              { resolution: '720p', height: 720, label: '720p (HD)' },
              { resolution: '480p', height: 480, label: '480p (SD)' },
              { resolution: '360p', height: 360, label: '360p' },
            ],
            audioBitrates: [320, 256, 192, 128],
          };

          return resolve(result);
        }

        // Single media item
        const formatInfo = parseFormats(data.formats || []);
        
        // Add "Best Available" resolution option at the top if resolutions exist
        const resolutions = formatInfo.resolutions.map(r => ({
          ...r,
          label: `${r.resolution} (${r.container.toUpperCase()}${r.fps ? `, ${r.fps}fps` : ''})`,
        }));

        const result = {
          isPlaylist: false,
          id: data.id || 'media',
          title: data.title || 'Untitled Media',
          description: data.description || '',
          thumbnail: data.thumbnail || data.thumbnails?.[0]?.url || null,
          duration: data.duration || null,
          uploader: data.uploader || data.channel || 'Unknown Creator',
          webpageUrl: data.webpage_url || url,
          availableAudioFormats: ['mp3', 'm4a', 'webm'],
          audioBitrates: [320, 256, 192, 128],
          maxSourceAudioBitrate: formatInfo.maxAudioBitrate,
          availableResolutions: resolutions,
        };

        resolve(result);
      } catch (parseErr) {
        logger.error({ parseErr, stdoutSnippet: stdout.slice(0, 200) }, 'Failed to parse yt-dlp JSON output');
        reject(new Error(`Failed to parse media metadata: ${parseErr.message}`));
      }
    });
  });
}

export function downloadAudioStream(url, tempOutputPath, onProgress, options = {}) {
  const env = getEnv();
  const ytdlpPath = env.YT_DLP_PATH;

  const args = [
    '-f', 'bestaudio/best',
    '--no-playlist',
    '--no-exec',
    '--ignore-config',
    '--socket-timeout', '30',
    '-o', tempOutputPath,
    '--newline',
    '--',
    url,
  ];

  logger.info({ ytdlpPath, url, tempOutputPath }, 'Starting yt-dlp audio stream download');

  return new Promise((resolve, reject) => {
    let stderr = '';
    let exited = false;

    const child = spawn(ytdlpPath, args, { windowsHide: true, signal: options.signal });

    child.stdout.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        // Match: [download]  45.2% of ~12.34MiB at  2.15MiB/s ETA 00:03
        const match = trimmed.match(/\[download\]\s+([\d.]+)%\s+of\s+(?:~\s*)?([^\s]+)(?:\s+at\s+([^\s]+))?(?:\s+ETA\s+([^\s]+))?/i);
        if (match && onProgress) {
          const percent = parseFloat(match[1]);
          const total = match[2];
          const speed = match[3] || null;
          const eta = match[4] || null;
          onProgress({ percent, total, speed, eta });
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      if (exited) return;
      exited = true;
      logger.error({ err }, 'Failed to spawn yt-dlp for audio download');
      reject(err);
    });

    child.on('close', (code) => {
      if (exited) return;
      exited = true;

      if (code === 0) {
        logger.info({ tempOutputPath }, 'yt-dlp audio download finished successfully');
        resolve({ tempOutputPath });
      } else {
        const errorMsg = stderr.trim() || `yt-dlp exited with code ${code}`;
        logger.error({ code, stderr: errorMsg }, 'yt-dlp audio download failed');
        reject(new Error(`Download failed: ${errorMsg}`));
      }
    });
  });
}

export function buildVideoFormatSpec(quality) {
  if (!quality || quality === 'best') {
    return 'bestvideo+bestaudio/best';
  }
  const height = parseInt(quality, 10);
  if (!isNaN(height) && height > 0) {
    // Exact or next lower compatible resolution fallback
    return `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`;
  }
  return 'bestvideo+bestaudio/best';
}

export function downloadVideoStream(url, tempOutputPath, options = {}, onProgress) {
  const env = getEnv();
  const ytdlpPath = env.YT_DLP_PATH;
  const formatSpec = buildVideoFormatSpec(options.quality);

  const args = [
    '-f', formatSpec,
    '--no-playlist',
    '--no-exec',
    '--ignore-config',
    '--socket-timeout', '30',
    '--ffmpeg-location', env.FFMPEG_PATH,
    '--merge-output-format', 'mp4',
    '-o', tempOutputPath,
    '--newline',
    '--',
    url,
  ];

  logger.info({ ytdlpPath, url, formatSpec, tempOutputPath }, 'Starting yt-dlp video stream download and merge');

  return new Promise((resolve, reject) => {
    let stderr = '';
    let exited = false;

    const child = spawn(ytdlpPath, args, { windowsHide: true, signal: options.signal });

    child.stdout.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        const match = trimmed.match(/\[download\]\s+([\d.]+)%\s+of\s+(?:~\s*)?([^\s]+)(?:\s+at\s+([^\s]+))?(?:\s+ETA\s+([^\s]+))?/i);
        if (match && onProgress) {
          const percent = parseFloat(match[1]);
          const total = match[2];
          const speed = match[3] || null;
          const eta = match[4] || null;
          onProgress({ percent, total, speed, eta });
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      if (exited) return;
      exited = true;
      logger.error({ err }, 'Failed to spawn yt-dlp for video download');
      reject(err);
    });

    child.on('close', (code) => {
      if (exited) return;
      exited = true;

      if (code === 0) {
        logger.info({ tempOutputPath }, 'yt-dlp video download & merge finished successfully');
        resolve({ tempOutputPath });
      } else {
        const errorMsg = stderr.trim() || `yt-dlp exited with code ${code}`;
        logger.error({ code, stderr: errorMsg }, 'yt-dlp video download failed');
        reject(new Error(`Video download failed: ${errorMsg}`));
      }
    });
  });
}
