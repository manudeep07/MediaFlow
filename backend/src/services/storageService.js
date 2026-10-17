import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { getEnv } from '../config/env.js';
import { logger } from '../middleware/logger.js';

export function getStorageRoot() {
  const env = getEnv();
  const dir = path.resolve(env.STORAGE_DIR);
  if (!fsSync.existsSync(dir)) {
    fsSync.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function createJobDirectory(jobId) {
  const root = getStorageRoot();
  const jobDir = path.join(root, jobId);
  await fs.mkdir(jobDir, { recursive: true });
  return jobDir;
}

export function getJobDirectory(jobId) {
  const root = getStorageRoot();
  return path.join(root, jobId);
}

export async function cleanupJobDirectory(jobId) {
  const jobDir = getJobDirectory(jobId);
  try {
    if (fsSync.existsSync(jobDir)) {
      await fs.rm(jobDir, { recursive: true, force: true });
      logger.info({ jobId, jobDir }, 'Cleaned up job storage directory');
    }
  } catch (err) {
    logger.warn({ jobId, err: err.message }, 'Failed to remove job storage directory');
  }
}

export async function getStorageUsage() {
  const root = getStorageRoot();
  let totalBytes = 0;

  async function calculateDirSize(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await calculateDirSize(fullPath);
        } else if (entry.isFile()) {
          const stat = await fs.stat(fullPath);
          totalBytes += stat.size;
        }
      }
    } catch (e) {
      // Ignore unreadable entries
    }
  }

  await calculateDirSize(root);
  return totalBytes;
}
