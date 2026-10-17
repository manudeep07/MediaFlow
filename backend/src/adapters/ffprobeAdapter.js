import { spawn } from 'node:child_process';
import { getEnv } from '../config/env.js';
import { logger } from '../middleware/logger.js';

export function probeMedia(filePath) {
  const env = getEnv();
  const ffprobePath = env.FFPROBE_PATH;

  const args = [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath,
  ];

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let exited = false;

    const child = spawn(ffprobePath, args, { windowsHide: true });

    const timeout = setTimeout(() => {
      if (!exited) {
        exited = true;
        try { child.kill(); } catch (e) {}
        reject(new Error('FFprobe inspection timed out'));
      }
    }, 15000);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
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

      if (code !== 0) {
        return reject(new Error(`FFprobe exited with code ${code}: ${stderr}`));
      }

      try {
        const metadata = JSON.parse(stdout);
        const format = metadata.format || {};
        const audioStream = metadata.streams?.find((s) => s.codec_type === 'audio');
        const videoStream = metadata.streams?.find((s) => s.codec_type === 'video');

        const width = videoStream?.width ? parseInt(videoStream.width, 10) : null;
        const height = videoStream?.height ? parseInt(videoStream.height, 10) : null;

        resolve({
          duration: parseFloat(format.duration || 0),
          size: parseInt(format.size || 0, 10),
          bitrate: parseInt(format.bit_rate || 0, 10),
          audioCodec: audioStream?.codec_name || null,
          videoCodec: videoStream?.codec_name || null,
          width,
          height,
          resolution: height ? `${height}p` : null,
          channels: audioStream?.channels || null,
          sampleRate: audioStream?.sample_rate || null,
        });
      } catch (err) {
        reject(new Error(`Failed to parse FFprobe output: ${err.message}`));
      }
    });
  });
}
