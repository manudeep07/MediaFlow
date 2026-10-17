import archiver from 'archiver';
import fs from 'node:fs';
import path from 'node:path';
import { getDatabase } from '../database/index.js';
import { logger } from '../middleware/logger.js';
import { sanitizeFilename } from '../utils/sanitize.js';

/**
 * Retrieves all completed playlist_items for the given job.
 * Returns only items that have an output_path that exists on disk.
 *
 * @param {string} jobId
 * @returns {{ id, title, output_filename, output_path }[]}
 */
export function getCompletedPlaylistItems(jobId) {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT id, title, output_filename, output_path
       FROM playlist_items
       WHERE job_id = ? AND state = 'completed'
       ORDER BY item_index ASC`
    )
    .all(jobId);

  return rows.filter((row) => row.output_path && fs.existsSync(row.output_path));
}

/**
 * Streams a ZIP archive of all completed playlist items to an HTTP response.
 * Handles partial failures gracefully: missing files are skipped.
 *
 * @param {string} jobId       - Job ID used for logging.
 * @param {string} archiveName - Base filename (without .zip) for the archive.
 * @param {import('http').ServerResponse} res - Express response object to pipe into.
 * @returns {Promise<{ filesAdded: number, archiveSize: number }>}
 */
export function streamPlaylistZip(jobId, archiveName, res) {
  return new Promise((resolve, reject) => {
    const items = getCompletedPlaylistItems(jobId);

    if (items.length === 0) {
      reject(
        Object.assign(new Error('No completed files are available to archive'), {
          code: 'NO_FILES_TO_ZIP',
        })
      );
      return;
    }

    const safeName = sanitizeFilename(archiveName || `playlist_${jobId.slice(0, 8)}`);
    const zipFilename = `${safeName}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(zipFilename)}"`
    );
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-store');

    const archive = archiver('zip', {
      zlib: { level: 0 }, // Store-only — media files are already compressed
    });

    let filesAdded = 0;
    let archiveSize = 0;

    archive.on('entry', () => {
      filesAdded += 1;
    });

    archive.on('progress', (progress) => {
      archiveSize = progress.fs.processedBytes;
    });

    archive.on('warning', (warn) => {
      logger.warn(
        { jobId, warn: warn.message, code: warn.code },
        'archiver warning during ZIP stream'
      );
    });

    archive.on('error', (err) => {
      logger.error({ jobId, err: err.message }, 'archiver error during ZIP stream');
      reject(err);
    });

    archive.on('finish', () => {
      logger.info({ jobId, zipFilename, filesAdded, archiveSize }, 'ZIP archive stream completed');
      resolve({ filesAdded, archiveSize });
    });

    // Pipe archive output directly to the HTTP response
    archive.pipe(res);

    // Add each completed item file to the archive
    for (const item of items) {
      if (!fs.existsSync(item.output_path)) {
        logger.warn(
          { jobId, itemId: item.id, filePath: item.output_path },
          'Skipping missing file in ZIP'
        );
        continue;
      }

      const entryName = item.output_filename || path.basename(item.output_path);
      archive.file(item.output_path, { name: entryName });
    }

    archive.finalize();
  });
}
