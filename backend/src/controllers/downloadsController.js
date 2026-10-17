import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import {
  createJob,
  getJob,
  listJobs,
  deleteJob,
  cancelJob,
  retryJob,
  processAudioJob,
  processVideoJob,
  processPlaylistAudioJob,
  processPlaylistVideoJob,
  getPlaylistItems,
} from '../services/jobManager.js';
import { streamPlaylistZip } from '../services/zipService.js';
import { getEnv } from '../config/env.js';
import { logger } from '../middleware/logger.js';

const createDownloadSchema = z.object({
  url: z.string().url('A valid URL is required'),
  type: z.enum(['audio', 'video']).default('audio'),
  scope: z.enum(['single', 'playlist']).default('single'),
  format: z.string().default('mp3'),
  quality: z.string().default('best'),
  authorized: z.boolean().refine((val) => val === true, {
    message: 'You must declare authorization to download this media',
  }),
  title: z.string().optional(),
  thumbnail: z.string().nullable().optional(),
  duration: z.number().nullable().optional(),
});

export async function createDownloadHandler(req, res) {
  try {
    const parseResult = createDownloadSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0]?.message || 'Invalid request body',
        },
      });
    }

    const payload = parseResult.data;
    const targetUrl = req.validatedMedia?.url || payload.url;

    const env = getEnv();

    // Check concurrency limit
    const allJobs = listJobs(100);
    const activeJobs = allJobs.filter((j) =>
      ['downloading', 'processing', 'zipping'].includes(j.state)
    );

    if (activeJobs.length >= env.MAX_CONCURRENT_JOBS) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'MAX_CONCURRENT_JOBS_EXCEEDED',
          message: `Server reached max concurrent job limit (${env.MAX_CONCURRENT_JOBS}). Please wait for active jobs to complete.`,
        },
      });
    }

    // Create job record in SQLite
    const job = createJob({
      ...payload,
      url: targetUrl,
    });

    logger.info({ jobId: job.id, type: job.type, scope: job.scope }, 'Created download job');

    // Launch background processing
    if (job.type === 'audio' && job.scope === 'single') {
      processAudioJob(job.id).catch((err) => {
        logger.error({ jobId: job.id, err: err.message }, 'Unhandled error in processAudioJob');
      });
    } else if (job.type === 'video' && job.scope === 'single') {
      processVideoJob(job.id).catch((err) => {
        logger.error({ jobId: job.id, err: err.message }, 'Unhandled error in processVideoJob');
      });
    } else if (job.type === 'audio' && job.scope === 'playlist') {
      processPlaylistAudioJob(job.id).catch((err) => {
        logger.error({ jobId: job.id, err: err.message }, 'Unhandled error in processPlaylistAudioJob');
      });
    } else if (job.type === 'video' && job.scope === 'playlist') {
      processPlaylistVideoJob(job.id).catch((err) => {
        logger.error({ jobId: job.id, err: err.message }, 'Unhandled error in processPlaylistVideoJob');
      });
    }

    return res.status(201).json({
      success: true,
      data: job,
    });
  } catch (err) {
    logger.error({ err }, 'Error in createDownloadHandler');
    return res.status(500).json({
      success: false,
      error: {
        code: 'JOB_CREATION_FAILED',
        message: err.message || 'Failed to initialize download job',
      },
    });
  }
}

export function listDownloadsHandler(req, res) {
  const jobs = listJobs(50);
  return res.status(200).json({
    success: true,
    data: jobs,
  });
}

export function getDownloadStatusHandler(req, res) {
  const { id } = req.params;
  const job = getJob(id);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: { code: 'JOB_NOT_FOUND', message: `Job with ID ${id} was not found` },
    });
  }

  return res.status(200).json({
    success: true,
    data: job,
  });
}

export function downloadFileHandler(req, res) {
  const { id } = req.params;
  const job = getJob(id);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: { code: 'JOB_NOT_FOUND', message: `Job ${id} not found` },
    });
  }

  if (job.state !== 'completed') {
    return res.status(400).json({
      success: false,
      error: { code: 'JOB_NOT_COMPLETED', message: `Job is in '${job.state}' state and not ready for download` },
    });
  }

  if (!job.output_path || !fs.existsSync(job.output_path)) {
    return res.status(404).json({
      success: false,
      error: { code: 'FILE_NOT_FOUND_ON_DISK', message: 'The completed output file was not found on disk' },
    });
  }

  const stat = fs.statSync(job.output_path);
  const fileSize = stat.size;
  const range = req.headers.range;

  // Determine MIME type
  const ext = path.extname(job.output_filename).toLowerCase();
  const mimeTypes = {
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.webm': 'audio/webm',
    '.mp4': 'video/mp4',
  };
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(job.output_filename)}"`);
  res.setHeader('Accept-Ranges', 'bytes');

  // Handle HTTP Range Requests for streaming media players
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', chunkSize);
    res.setHeader('Content-Type', contentType);

    const stream = fs.createReadStream(job.output_path, { start, end });
    stream.pipe(res);
  } else {
    res.status(200);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Type', contentType);

    const stream = fs.createReadStream(job.output_path);
    stream.pipe(res);
  }
}

export async function deleteDownloadHandler(req, res) {
  const { id } = req.params;
  const job = getJob(id);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: { code: 'JOB_NOT_FOUND', message: `Job ${id} not found` },
    });
  }

  await deleteJob(id);
  return res.status(200).json({
    success: true,
    message: `Job ${id} and associated storage files deleted`,
  });
}

/**
 * GET /api/downloads/:id/items
 * Returns all playlist_items for a playlist job.
 */
export function getPlaylistItemsHandler(req, res) {
  const { id } = req.params;
  const job = getJob(id);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: { code: 'JOB_NOT_FOUND', message: `Job ${id} not found` },
    });
  }

  if (job.scope !== 'playlist') {
    return res.status(400).json({
      success: false,
      error: { code: 'NOT_A_PLAYLIST_JOB', message: 'This job is not a playlist download' },
    });
  }

  const items = getPlaylistItems(id);
  return res.status(200).json({ success: true, data: items });
}

/**
 * GET /api/downloads/:id/archive
 * Streams a ZIP of all completed playlist item files.
 */
export async function downloadArchiveHandler(req, res) {
  const { id } = req.params;
  const job = getJob(id);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: { code: 'JOB_NOT_FOUND', message: `Job ${id} not found` },
    });
  }

  if (job.scope !== 'playlist') {
    return res.status(400).json({
      success: false,
      error: { code: 'NOT_A_PLAYLIST_JOB', message: 'Archive download is only available for playlist jobs' },
    });
  }

  const readyStates = ['completed', 'completed_with_errors'];
  if (!readyStates.includes(job.state)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'JOB_NOT_READY',
        message: `Job is in '${job.state}' state. Archive is only available after the job finishes.`,
      },
    });
  }

  try {
    const archiveName = job.title || `playlist_${job.id.slice(0, 8)}`;
    await streamPlaylistZip(id, archiveName, res);
  } catch (err) {
    if (err.code === 'NO_FILES_TO_ZIP') {
      return res.status(404).json({
        success: false,
        error: { code: 'NO_FILES_TO_ZIP', message: err.message },
      });
    }
    logger.error({ jobId: id, err: err.message }, 'Error streaming playlist ZIP');
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: { code: 'ARCHIVE_STREAM_ERROR', message: 'Failed to stream ZIP archive' },
      });
    }
  }
}

/**
 * POST /api/downloads/:id/cancel
 * Cancels an in-progress or queued download job.
 */
export async function cancelDownloadHandler(req, res) {
  const { id } = req.params;
  const job = getJob(id);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: { code: 'JOB_NOT_FOUND', message: `Job ${id} not found` },
    });
  }

  const nonCancellableStates = ['completed', 'completed_with_errors', 'failed', 'cancelled'];
  if (nonCancellableStates.includes(job.state)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_STATE',
        message: `Cannot cancel job in '${job.state}' state`,
      },
    });
  }

  try {
    const cancelledJob = await cancelJob(id);
    return res.status(200).json({
      success: true,
      data: cancelledJob,
    });
  } catch (err) {
    logger.error({ id, err: err.message }, 'Failed to cancel job');
    return res.status(err.status || 500).json({
      success: false,
      error: { code: 'CANCEL_ERROR', message: err.message },
    });
  }
}

/**
 * POST /api/downloads/:id/retry
 * Retries a failed or cancelled job.
 */
export async function retryDownloadHandler(req, res) {
  const { id } = req.params;
  const job = getJob(id);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: { code: 'JOB_NOT_FOUND', message: `Job ${id} not found` },
    });
  }

  if (job.state !== 'failed' && job.state !== 'cancelled') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_STATE',
        message: `Only failed or cancelled jobs can be retried (current state: '${job.state}')`,
      },
    });
  }

  try {
    const retriedJob = await retryJob(id);
    return res.status(200).json({
      success: true,
      data: retriedJob,
    });
  } catch (err) {
    logger.error({ id, err: err.message }, 'Failed to retry job');
    return res.status(err.status || 500).json({
      success: false,
      error: { code: 'RETRY_ERROR', message: err.message },
    });
  }
}

