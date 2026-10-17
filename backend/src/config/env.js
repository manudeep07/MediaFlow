import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../');

export const envSchema = z.object({
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3000),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),

  // Security & Authentication
  API_KEY_ENABLED: z
    .string()
    .transform((val) => val === 'true' || val === '1')
    .default('false'),
  API_KEY: z.string().optional().default(''),

  // Allowed Domains (comma-separated list)
  ALLOWED_DOMAINS: z
    .string()
    .default('archive.org,commons.wikimedia.org,youtube.com,www.youtube.com,music.youtube.com')
    .transform((val) =>
      val
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean)
    ),

  // Storage & Paths
  STORAGE_DIR: z.string().default(path.join(projectRoot, 'data', 'downloads')),
  DB_PATH: z.string().default(path.join(projectRoot, 'data', 'mediaflow.db')),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(1024),
  MAX_STORAGE_GB: z.coerce.number().positive().default(10),
  FILE_TTL_HOURS: z.coerce.number().positive().default(24),
  CLEANUP_INTERVAL_MINUTES: z.coerce.number().positive().default(30),

  // Job Engine Limits
  MAX_PLAYLIST_ITEMS: z.coerce.number().int().positive().default(100),
  MAX_CONCURRENT_JOBS: z.coerce.number().int().positive().default(2),
  JOB_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(120),

  // External Executables
  YT_DLP_PATH: z.string().default('yt-dlp'),
  FFMPEG_PATH: z.string().default('ffmpeg'),
  FFPROBE_PATH: z.string().default('ffprobe'),
});

import fs from 'node:fs';

function resolveBinary(binaryName, fallback) {
  if (process.platform === 'win32' && fallback === binaryName) {
    const localAppData = process.env.LOCALAPPDATA || '';
    if (binaryName === 'yt-dlp') {
      const wingetYtdlp = path.join(
        localAppData,
        'Microsoft',
        'WinGet',
        'Packages',
        'yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe',
        'yt-dlp.exe'
      );
      if (fs.existsSync(wingetYtdlp)) return wingetYtdlp;
    }
  }
  return fallback;
}

let parsedEnv = null;

export function getEnv(overrideEnv = process.env) {
  if (!parsedEnv || overrideEnv !== process.env) {
    const result = envSchema.safeParse(overrideEnv);
    if (!result.success) {
      const formatted = result.error.format();
      console.error('Invalid environment configuration:', formatted);
      throw new Error(`Environment validation failed: ${JSON.stringify(formatted)}`);
    }
    const data = result.data;
    data.YT_DLP_PATH = resolveBinary('yt-dlp', data.YT_DLP_PATH);
    parsedEnv = data;
  }
  return parsedEnv;
}
