import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { getDatabase } from '../database/index.js';
import { createJobDirectory, getJobDirectory, cleanupJobDirectory } from './storageService.js';
import { downloadAudioStream, downloadVideoStream } from '../adapters/ytdlpAdapter.js';
import { convertAudio, remuxToMp4 } from '../adapters/ffmpegAdapter.js';
import { probeMedia } from '../adapters/ffprobeAdapter.js';
import { sanitizeFilename } from '../utils/sanitize.js';
import { logger } from '../middleware/logger.js';
import { inspectMedia } from '../adapters/ytdlpAdapter.js';
import { broadcastJobEvent } from './sseManager.js';


export function createJob(data) {
  const db = getDatabase();
  const id = crypto.randomUUID();

  const stmt = db.prepare(`
    INSERT INTO jobs (
      id, url, type, scope, format, quality, state,
      title, thumbnail, duration, item_count, current_item_index
    ) VALUES (
      ?, ?, ?, ?, ?, ?, 'queued',
      ?, ?, ?, ?, ?
    )
  `);

  stmt.run(
    id,
    data.url,
    data.type || 'audio',
    data.scope || 'single',
    data.format || 'mp3',
    data.quality || '320',
    data.title || null,
    data.thumbnail || null,
    data.duration || null,
    data.itemCount || 1,
    0
  );

  return getJob(id);
}

export function getJob(id) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM jobs WHERE id = ?');
  return stmt.get(id);
}

export function listJobs(limit = 50) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?');
  return stmt.all(limit);
}

export function updateJob(id, fields = {}) {
  const db = getDatabase();
  const keys = Object.keys(fields);
  if (keys.length === 0) return getJob(id);

  const setClauses = keys.map((k) => `${k} = ?`).join(', ');
  const values = Object.values(fields);
  values.push(id);

  const query = `UPDATE jobs SET ${setClauses}, updated_at = (datetime('now')) WHERE id = ?`;
  db.prepare(query).run(...values);

  const updated = getJob(id);

  // Broadcast SSE event based on new state
  if (updated) {
    const state = updated.state;
    let eventType = 'job:progress';
    if (state === 'completed' || state === 'completed_with_errors') eventType = 'job:completed';
    else if (state === 'failed') eventType = 'job:failed';
    else if (state === 'cancelled') eventType = 'job:cancelled';
    broadcastJobEvent(id, eventType, updated);
  }

  return updated;
}

export async function deleteJob(id) {
  const db = getDatabase();
  await cleanupJobDirectory(id);
  db.prepare('DELETE FROM jobs WHERE id = ?').run(id);
  return { success: true, id };
}

// ─── Playlist Item Helpers ──────────────────────────────────────────────────

export function createPlaylistItem(data) {
  const db = getDatabase();
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO playlist_items
      (id, job_id, item_index, media_id, title, url, duration, state)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(id, data.jobId, data.itemIndex, data.mediaId || null, data.title, data.url, data.duration || null);
  return id;
}

export function updatePlaylistItem(id, fields = {}) {
  const db = getDatabase();
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const setClauses = keys.map((k) => `${k} = ?`).join(', ');
  const values = [...Object.values(fields), id];
  db.prepare(`UPDATE playlist_items SET ${setClauses}, updated_at = (datetime('now')) WHERE id = ?`).run(...values);
}

export function getPlaylistItems(jobId) {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM playlist_items WHERE job_id = ? ORDER BY item_index ASC')
    .all(jobId);
}

/**
 * Background worker executing single-item audio download & transcode workflow.
 */
export async function processAudioJob(jobId) {
  const job = getJob(jobId);
  if (!job) {
    logger.error({ jobId }, 'Cannot process audio job: not found in database');
    return;
  }

  logger.info({ jobId, url: job.url, format: job.format, quality: job.quality }, 'Processing audio job');

  try {
    // 1. Create dedicated job directory
    const jobDir = await createJobDirectory(jobId);

    // 2. Mark state as downloading
    updateJob(jobId, { state: 'downloading', progress_percent: 5 });

    // 3. Download source stream to temporary raw file
    const rawTemplate = path.join(jobDir, 'raw_source.%(ext)s');
    await downloadAudioStream(job.url, rawTemplate, (progress) => {
      if (progress.percent) {
        updateJob(jobId, {
          progress_percent: Math.min(85, Math.round(progress.percent * 0.85)),
          speed: progress.speed || null,
          eta: progress.eta || null,
        });
      }
    });

    // Locate the downloaded raw file in jobDir
    const files = await fs.readdir(jobDir);
    const rawFile = files.find((f) => f.startsWith('raw_source.'));
    if (!rawFile) {
      throw new Error('Downloaded source file was not found on disk');
    }

    const rawFilePath = path.join(jobDir, rawFile);

    // 4. Update state to processing (transcoding)
    updateJob(jobId, { state: 'processing', progress_percent: 88, speed: null, eta: null });

    const safeBaseName = sanitizeFilename(job.title || `audio_${job.id.slice(0, 8)}`);
    const outputFilename = `${safeBaseName}.${job.format}`;
    const outputFilePath = path.join(jobDir, outputFilename);

    // Check if source file already matches target format and quality is "best" (passthrough)
    const rawExt = path.extname(rawFile).replace('.', '').toLowerCase();
    const isPassthrough = rawExt === job.format && job.quality === 'best';

    await convertAudio(rawFilePath, outputFilePath, {
      format: job.format,
      bitrate: job.quality,
      passthrough: isPassthrough,
    });

    // 5. Verify output file with FFprobe
    const probe = await probeMedia(outputFilePath);

    // 6. Delete temporary raw source file to save disk space
    try {
      await fs.unlink(rawFilePath);
    } catch (e) {}

    // 7. Update job state to completed
    const completedJob = updateJob(jobId, {
      state: 'completed',
      progress_percent: 100,
      output_filename: outputFilename,
      output_path: outputFilePath,
      total_bytes: probe.size,
      duration: probe.duration || job.duration,
      completed_at: new Date().toISOString(),
    });

    logger.info({ jobId, outputFilename, size: probe.size }, 'Audio job completed successfully');
    return completedJob;
  } catch (err) {
    logger.error({ jobId, err: err.message }, 'Audio job failed');
    updateJob(jobId, {
      state: 'failed',
      error_message: err.message,
    });
  }
}

/**
 * Background worker executing single-item video download & merge workflow.
 */
export async function processVideoJob(jobId) {
  const job = getJob(jobId);
  if (!job) {
    logger.error({ jobId }, 'Cannot process video job: not found in database');
    return;
  }

  logger.info({ jobId, url: job.url, quality: job.quality }, 'Processing video download job');

  try {
    // 1. Create dedicated job directory
    const jobDir = await createJobDirectory(jobId);

    // 2. Mark state as downloading
    updateJob(jobId, { state: 'downloading', progress_percent: 5 });

    // 3. Download best matching video + audio streams to MP4
    const rawTemplate = path.join(jobDir, 'raw_video.%(ext)s');
    await downloadVideoStream(job.url, rawTemplate, { quality: job.quality }, (progress) => {
      if (progress.percent) {
        updateJob(jobId, {
          progress_percent: Math.min(85, Math.round(progress.percent * 0.85)),
          speed: progress.speed || null,
          eta: progress.eta || null,
        });
      }
    });

    // Locate the downloaded video file in jobDir
    const files = await fs.readdir(jobDir);
    const downloadedVideo = files.find((f) => f.startsWith('raw_video.'));
    if (!downloadedVideo) {
      throw new Error('Downloaded video file was not found on disk');
    }

    const downloadedPath = path.join(jobDir, downloadedVideo);

    // 4. Mark state as processing (remuxing for faststart streaming)
    updateJob(jobId, { state: 'processing', progress_percent: 88, speed: null, eta: null });

    const safeBaseName = sanitizeFilename(job.title || `video_${job.id.slice(0, 8)}`);
    const outputFilename = `${safeBaseName}.mp4`;
    const outputFilePath = path.join(jobDir, outputFilename);

    // Run remux with faststart flags if not identical file path
    if (path.resolve(downloadedPath) !== path.resolve(outputFilePath)) {
      await remuxToMp4(downloadedPath, outputFilePath);
      try {
        await fs.unlink(downloadedPath);
      } catch (e) {}
    }

    // 5. Inspect final media file via FFprobe
    const probe = await probeMedia(outputFilePath);

    // 6. Update job state to completed
    const completedJob = updateJob(jobId, {
      state: 'completed',
      progress_percent: 100,
      output_filename: outputFilename,
      output_path: outputFilePath,
      total_bytes: probe.size,
      duration: probe.duration || job.duration,
      completed_at: new Date().toISOString(),
    });

    logger.info({ jobId, outputFilename, size: probe.size, resolution: probe.resolution }, 'Video job completed successfully');
    return completedJob;
  } catch (err) {
    logger.error({ jobId, err: err.message }, 'Video job failed');
    updateJob(jobId, {
      state: 'failed',
      error_message: err.message,
    });
  }
}

// ─── Playlist Workers ───────────────────────────────────────────────────────

/**
 * Processes a single playlist item as an audio download.
 * Returns { success: boolean, outputFilename?, outputPath?, error? }.
 */
async function processOneAudioItem(itemId, itemUrl, itemTitle, jobId, jobDir, format, quality) {
  const safeBase = sanitizeFilename(itemTitle || `audio_${itemId.slice(0, 8)}`);
  try {
    updatePlaylistItem(itemId, { state: 'downloading' });

    const rawTemplate = path.join(jobDir, `item_${itemId}_raw.%(ext)s`);
    await downloadAudioStream(itemUrl, rawTemplate, (progress) => {
      if (progress.percent) {
        updatePlaylistItem(itemId, { progress_percent: Math.min(85, Math.round(progress.percent * 0.85)) });
      }
    });

    const dirFiles = await fs.readdir(jobDir);
    const rawFile = dirFiles.find((f) => f.startsWith(`item_${itemId}_raw.`));
    if (!rawFile) throw new Error('Downloaded audio source file not found on disk');

    const rawFilePath = path.join(jobDir, rawFile);

    updatePlaylistItem(itemId, { state: 'processing', progress_percent: 88 });

    const outputFilename = `${safeBase}.${format}`;
    const outputFilePath = path.join(jobDir, outputFilename);
    const rawExt = path.extname(rawFile).replace('.', '').toLowerCase();
    const isPassthrough = rawExt === format && quality === 'best';

    await convertAudio(rawFilePath, outputFilePath, { format, bitrate: quality, passthrough: isPassthrough });

    const probe = await probeMedia(outputFilePath);
    try { await fs.unlink(rawFilePath); } catch (e) {}

    updatePlaylistItem(itemId, {
      state: 'completed',
      progress_percent: 100,
      output_filename: outputFilename,
      output_path: outputFilePath,
    });

    return { success: true, outputFilename, outputPath: outputFilePath, size: probe.size };
  } catch (err) {
    updatePlaylistItem(itemId, { state: 'failed', error_message: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Processes a single playlist item as a video download.
 * Returns { success: boolean, outputFilename?, outputPath?, error? }.
 */
async function processOneVideoItem(itemId, itemUrl, itemTitle, jobId, jobDir, quality) {
  const safeBase = sanitizeFilename(itemTitle || `video_${itemId.slice(0, 8)}`);
  try {
    updatePlaylistItem(itemId, { state: 'downloading' });

    const rawTemplate = path.join(jobDir, `item_${itemId}_raw.%(ext)s`);
    await downloadVideoStream(itemUrl, rawTemplate, { quality }, (progress) => {
      if (progress.percent) {
        updatePlaylistItem(itemId, { progress_percent: Math.min(85, Math.round(progress.percent * 0.85)) });
      }
    });

    const dirFiles = await fs.readdir(jobDir);
    const rawFile = dirFiles.find((f) => f.startsWith(`item_${itemId}_raw.`));
    if (!rawFile) throw new Error('Downloaded video source file not found on disk');

    const rawFilePath = path.join(jobDir, rawFile);

    updatePlaylistItem(itemId, { state: 'processing', progress_percent: 88 });

    const outputFilename = `${safeBase}.mp4`;
    const outputFilePath = path.join(jobDir, outputFilename);

    if (path.resolve(rawFilePath) !== path.resolve(outputFilePath)) {
      await remuxToMp4(rawFilePath, outputFilePath);
      try { await fs.unlink(rawFilePath); } catch (e) {}
    }

    const probe = await probeMedia(outputFilePath);

    updatePlaylistItem(itemId, {
      state: 'completed',
      progress_percent: 100,
      output_filename: outputFilename,
      output_path: outputFilePath,
    });

    return { success: true, outputFilename, outputPath: outputFilePath, size: probe.size };
  } catch (err) {
    updatePlaylistItem(itemId, { state: 'failed', error_message: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Background worker for processing a playlist audio job.
 * Iterates all entries, processes each sequentially, tolerates partial failures.
 */
export async function processPlaylistAudioJob(jobId) {
  const job = getJob(jobId);
  if (!job) {
    logger.error({ jobId }, 'Cannot process playlist audio job: not found');
    return;
  }

  logger.info({ jobId, url: job.url }, 'Processing playlist audio job');

  try {
    const jobDir = await createJobDirectory(jobId);
    updateJob(jobId, { state: 'downloading', progress_percent: 2 });

    // Inspect playlist to enumerate entries
    const media = await inspectMedia(job.url);
    if (!media.isPlaylist) {
      throw new Error('URL does not resolve to a playlist');
    }

    const entries = media.entries || [];
    const totalItems = entries.length;

    updateJob(jobId, { item_count: totalItems, title: job.title || media.title });

    // Seed playlist_items rows
    const itemIds = [];
    for (const entry of entries) {
      const itemId = createPlaylistItem({
        jobId,
        itemIndex: entry.index,
        mediaId: entry.id,
        title: entry.title,
        url: entry.url,
        duration: entry.duration,
      });
      itemIds.push({ itemId, entry });
    }

    let completedCount = 0;
    let failedCount = 0;
    let totalBytes = 0;

    for (let i = 0; i < itemIds.length; i++) {
      const { itemId, entry } = itemIds[i];

      // Check for cancellation signal
      const currentJob = getJob(jobId);
      if (currentJob?.state === 'cancelled') {
        logger.info({ jobId }, 'Playlist audio job cancelled during item iteration');
        return;
      }

      updateJob(jobId, {
        current_item_index: i + 1,
        progress_percent: Math.round(((i) / totalItems) * 90),
      });

      const result = await processOneAudioItem(
        itemId, entry.url, entry.title, jobId, jobDir,
        job.format, job.quality
      );

      if (result.success) {
        completedCount += 1;
        totalBytes += result.size || 0;
      } else {
        failedCount += 1;
        logger.warn({ jobId, itemId, error: result.error }, 'Playlist audio item failed, continuing');
      }

      updateJob(jobId, {
        completed_item_count: completedCount,
        failed_item_count: failedCount,
      });
    }

    // Determine final job state
    const finalState =
      completedCount === 0
        ? 'failed'
        : failedCount > 0
        ? 'completed_with_errors'
        : 'completed';

    const errorMsg =
      finalState === 'failed'
        ? 'All playlist items failed to download'
        : failedCount > 0
        ? `${failedCount} of ${totalItems} items failed`
        : null;

    const completedJob = updateJob(jobId, {
      state: finalState,
      progress_percent: 100,
      total_bytes: totalBytes,
      completed_item_count: completedCount,
      failed_item_count: failedCount,
      error_message: errorMsg,
      completed_at: new Date().toISOString(),
    });

    logger.info(
      { jobId, finalState, completedCount, failedCount, totalItems },
      'Playlist audio job finished'
    );
    return completedJob;
  } catch (err) {
    logger.error({ jobId, err: err.message }, 'Playlist audio job failed');
    updateJob(jobId, { state: 'failed', error_message: err.message });
  }
}

/**
 * Background worker for processing a playlist video job.
 * Iterates all entries, processes each sequentially, tolerates partial failures.
 */
export async function processPlaylistVideoJob(jobId) {
  const job = getJob(jobId);
  if (!job) {
    logger.error({ jobId }, 'Cannot process playlist video job: not found');
    return;
  }

  logger.info({ jobId, url: job.url }, 'Processing playlist video job');

  try {
    const jobDir = await createJobDirectory(jobId);
    updateJob(jobId, { state: 'downloading', progress_percent: 2 });

    // Inspect playlist to enumerate entries
    const media = await inspectMedia(job.url);
    if (!media.isPlaylist) {
      throw new Error('URL does not resolve to a playlist');
    }

    const entries = media.entries || [];
    const totalItems = entries.length;

    updateJob(jobId, { item_count: totalItems, title: job.title || media.title });

    // Seed playlist_items rows
    const itemIds = [];
    for (const entry of entries) {
      const itemId = createPlaylistItem({
        jobId,
        itemIndex: entry.index,
        mediaId: entry.id,
        title: entry.title,
        url: entry.url,
        duration: entry.duration,
      });
      itemIds.push({ itemId, entry });
    }

    let completedCount = 0;
    let failedCount = 0;
    let totalBytes = 0;

    for (let i = 0; i < itemIds.length; i++) {
      const { itemId, entry } = itemIds[i];

      // Check for cancellation signal
      const currentJob = getJob(jobId);
      if (currentJob?.state === 'cancelled') {
        logger.info({ jobId }, 'Playlist video job cancelled during item iteration');
        return;
      }

      updateJob(jobId, {
        current_item_index: i + 1,
        progress_percent: Math.round(((i) / totalItems) * 90),
      });

      const result = await processOneVideoItem(
        itemId, entry.url, entry.title, jobId, jobDir, job.quality
      );

      if (result.success) {
        completedCount += 1;
        totalBytes += result.size || 0;
      } else {
        failedCount += 1;
        logger.warn({ jobId, itemId, error: result.error }, 'Playlist video item failed, continuing');
      }

      updateJob(jobId, {
        completed_item_count: completedCount,
        failed_item_count: failedCount,
      });
    }

    // Determine final job state
    const finalState =
      completedCount === 0
        ? 'failed'
        : failedCount > 0
        ? 'completed_with_errors'
        : 'completed';

    const errorMsg =
      finalState === 'failed'
        ? 'All playlist items failed to download'
        : failedCount > 0
        ? `${failedCount} of ${totalItems} items failed`
        : null;

    const completedJob = updateJob(jobId, {
      state: finalState,
      progress_percent: 100,
      total_bytes: totalBytes,
      completed_item_count: completedCount,
      failed_item_count: failedCount,
      error_message: errorMsg,
      completed_at: new Date().toISOString(),
    });

    logger.info(
      { jobId, finalState, completedCount, failedCount, totalItems },
      'Playlist video job finished'
    );
    return completedJob;
  } catch (err) {
    logger.error({ jobId, err: err.message }, 'Playlist video job failed');
    updateJob(jobId, { state: 'failed', error_message: err.message });
  }
}
