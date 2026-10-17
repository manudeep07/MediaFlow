import { spawn } from 'node:child_process';
import { getEnv } from '../config/env.js';
import { getDatabase } from '../database/index.js';

function execBinaryVersion(binaryPath, args) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let processExited = false;

    try {
      const child = spawn(binaryPath, args, {
        windowsHide: true,
      });

      const timeout = setTimeout(() => {
        if (!processExited) {
          try {
            child.kill();
          } catch (e) {}
          resolve({
            available: false,
            version: null,
            error: 'Process timed out after 4000ms',
          });
        }
      }, 4000);

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        if (processExited) return;
        processExited = true;
        clearTimeout(timeout);
        resolve({
          available: false,
          version: null,
          error: err.code === 'ENOENT' ? 'Executable not found in PATH' : err.message,
        });
      });

      child.on('close', (code) => {
        if (processExited) return;
        processExited = true;
        clearTimeout(timeout);
        if (code === 0) {
          const firstLine = (stdout || stderr).trim().split('\n')[0] || '';
          resolve({
            available: true,
            version: firstLine,
            error: null,
          });
        } else {
          resolve({
            available: false,
            version: null,
            error: `Process exited with code ${code}: ${stderr.trim()}`,
          });
        }
      });
    } catch (err) {
      resolve({
        available: false,
        version: null,
        error: err.message,
      });
    }
  });
}

export async function getHealth(req, res) {
  const env = getEnv();

  // 1. Check Node.js
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0], 10);
  const nodeStatus = {
    version: nodeVersion,
    compatible: majorVersion >= 20,
  };

  // 2. Check Database
  let dbStatus = { status: 'disconnected', error: null };
  try {
    const db = getDatabase();
    const row = db.prepare('SELECT 1 as alive').get();
    if (row && row.alive === 1) {
      dbStatus = { status: 'connected', path: env.DB_PATH };
    }
  } catch (err) {
    dbStatus = { status: 'error', error: err.message };
  }

  // 3. Check External Executables
  const [ytdlpRes, ffmpegRes, ffprobeRes] = await Promise.all([
    execBinaryVersion(env.YT_DLP_PATH, ['--version']),
    execBinaryVersion(env.FFMPEG_PATH, ['-version']),
    execBinaryVersion(env.FFPROBE_PATH, ['-version']),
  ]);

  const binaries = {
    ytdlp: {
      path: env.YT_DLP_PATH,
      ...ytdlpRes,
      installGuide: !ytdlpRes.available ? 'Install via: winget install yt-dlp OR pip install yt-dlp' : null,
    },
    ffmpeg: {
      path: env.FFMPEG_PATH,
      ...ffmpegRes,
      installGuide: !ffmpegRes.available ? 'Install via: winget install Gyan.FFmpeg' : null,
    },
    ffprobe: {
      path: env.FFPROBE_PATH,
      ...ffprobeRes,
      installGuide: !ffprobeRes.available ? 'Install via: winget install Gyan.FFmpeg' : null,
    },
  };

  const isHealthy =
    nodeStatus.compatible &&
    dbStatus.status === 'connected' &&
    binaries.ytdlp.available &&
    binaries.ffmpeg.available &&
    binaries.ffprobe.available;

  res.status(isHealthy ? 200 : 200).json({
    status: isHealthy ? 'healthy' : 'degraded',
    node: nodeStatus,
    database: dbStatus,
    binaries,
    configuration: {
      host: env.HOST,
      port: env.PORT,
      frontendOrigin: env.FRONTEND_ORIGIN,
      allowedDomains: env.ALLOWED_DOMAINS,
      maxPlaylistItems: env.MAX_PLAYLIST_ITEMS,
      maxConcurrentJobs: env.MAX_CONCURRENT_JOBS,
      maxFileSizeMb: env.MAX_FILE_SIZE_MB,
      maxStorageGb: env.MAX_STORAGE_GB,
      apiKeyEnabled: env.API_KEY_ENABLED,
    },
  });
}
