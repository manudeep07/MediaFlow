import { spawn } from 'node:child_process';
import { getEnv } from '../config/env.js';
import { logger } from '../middleware/logger.js';

export function convertAudio(inputPath, outputPath, options = {}) {
  const env = getEnv();
  const ffmpegPath = env.FFMPEG_PATH;

  const {
    format = 'mp3',
    bitrate = '320',
    passthrough = false,
  } = options;

  const args = ['-y', '-i', inputPath, '-vn'];

  if (passthrough) {
    args.push('-c:a', 'copy');
  } else if (format === 'mp3') {
    args.push('-codec:a', 'libmp3lame');
    if (bitrate && bitrate !== 'best') {
      args.push('-b:a', `${bitrate}k`);
    } else {
      args.push('-q:a', '0'); // Best VBR
    }
  } else if (format === 'm4a') {
    args.push('-codec:a', 'aac');
    if (bitrate && bitrate !== 'best') {
      args.push('-b:a', `${bitrate}k`);
    }
  } else if (format === 'webm') {
    args.push('-codec:a', 'libopus');
    if (bitrate && bitrate !== 'best') {
      args.push('-b:a', `${bitrate}k`);
    }
  } else {
    // Default fallback
    args.push('-codec:a', 'libmp3lame', '-b:a', '192k');
  }

  args.push(outputPath);

  logger.info({ ffmpegPath, inputPath, outputPath, format, bitrate }, 'Running FFmpeg audio conversion');

  return new Promise((resolve, reject) => {
    let stderr = '';
    let exited = false;

    const child = spawn(ffmpegPath, args, {
      windowsHide: true,
    });

    const timeout = setTimeout(() => {
      if (!exited) {
        exited = true;
        try { child.kill(); } catch (e) {}
        reject(new Error('FFmpeg conversion timed out after 5 minutes'));
      }
    }, 300000);

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      if (exited) return;
      exited = true;
      clearTimeout(timeout);
      logger.error({ err }, 'Failed to start FFmpeg subprocess');
      reject(new Error(`Failed to start FFmpeg: ${err.message}`));
    });

    child.on('close', (code) => {
      if (exited) return;
      exited = true;
      clearTimeout(timeout);

      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg audio conversion completed successfully');
        resolve({ outputPath });
      } else {
        const errorMsg = stderr.slice(-400).trim() || `FFmpeg failed with exit code ${code}`;
        logger.error({ code, stderr: errorMsg }, 'FFmpeg conversion error');
        reject(new Error(`Audio conversion failed: ${errorMsg}`));
      }
    });
  });
}

export function mergeVideoAndAudio(videoPath, audioPath, outputPath) {
  const env = getEnv();
  const ffmpegPath = env.FFMPEG_PATH;

  const args = [
    '-y',
    '-i', videoPath,
    '-i', audioPath,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    outputPath,
  ];

  logger.info({ ffmpegPath, videoPath, audioPath, outputPath }, 'Merging video and audio streams via FFmpeg');

  return new Promise((resolve, reject) => {
    let stderr = '';
    let exited = false;

    const child = spawn(ffmpegPath, args, { windowsHide: true });

    const timeout = setTimeout(() => {
      if (!exited) {
        exited = true;
        try { child.kill(); } catch (e) {}
        reject(new Error('FFmpeg stream merging timed out'));
      }
    }, 600000);

    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => {
      if (exited) return;
      exited = true;
      clearTimeout(timeout);
      reject(err);
    });

    child.on('close', (code) => {
      if (exited) return;
      exited = true;
      clearTimeout(timeout);

      if (code === 0) {
        resolve({ outputPath });
      } else {
        const err = stderr.slice(-400).trim() || `FFmpeg failed with code ${code}`;
        reject(new Error(`Stream merge failed: ${err}`));
      }
    });
  });
}

export function remuxToMp4(inputPath, outputPath) {
  const env = getEnv();
  const ffmpegPath = env.FFMPEG_PATH;

  const args = [
    '-y',
    '-i', inputPath,
    '-c', 'copy',
    '-movflags', '+faststart',
    outputPath,
  ];

  logger.info({ inputPath, outputPath }, 'Remuxing MP4 with faststart flags');

  return new Promise((resolve, reject) => {
    let stderr = '';
    let exited = false;

    const child = spawn(ffmpegPath, args, { windowsHide: true });

    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => {
      if (exited) return;
      exited = true;
      reject(err);
    });

    child.on('close', (code) => {
      if (exited) return;
      exited = true;

      if (code === 0) {
        resolve({ outputPath });
      } else {
        const err = stderr.slice(-400).trim() || `FFmpeg remux exited with code ${code}`;
        reject(new Error(`Remux failed: ${err}`));
      }
    });
  });
}
