/**
 * Server-Sent Events manager.
 *
 * Maintains a registry of connected SSE client response streams, keyed by jobId.
 * Provides broadcastJobEvent() to push typed events to all clients watching a job,
 * and a wildcard channel ('*') for clients listening to all jobs.
 */
import { logger } from '../middleware/logger.js';

// Map<jobId, Set<res>> — one job may have multiple browser tabs watching it
const clients = new Map();

/**
 * Register a new SSE client response stream for the given job (or '*' for all).
 *
 * @param {string} jobId
 * @param {import('express').Response} res
 */
export function addSseClient(jobId, res) {
  if (!clients.has(jobId)) {
    clients.set(jobId, new Set());
  }
  clients.get(jobId).add(res);
  logger.debug({ jobId, total: clients.get(jobId).size }, 'SSE client connected');
}

/**
 * Remove a client from the registry (called on close/error).
 *
 * @param {string} jobId
 * @param {import('express').Response} res
 */
export function removeSseClient(jobId, res) {
  const set = clients.get(jobId);
  if (set) {
    set.delete(res);
    if (set.size === 0) clients.delete(jobId);
    logger.debug({ jobId }, 'SSE client disconnected');
  }
}

/**
 * Send a typed SSE event to all clients watching a specific job,
 * and also to all clients on the wildcard channel ('*').
 *
 * @param {string} jobId
 * @param {string} eventType - e.g. 'job:progress', 'job:completed', 'job:failed'
 * @param {object} payload
 */
export function broadcastJobEvent(jobId, eventType, payload) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify({ jobId, ...payload })}\n\n`;

  // Broadcast to clients watching this specific job
  const specific = clients.get(jobId);
  if (specific) {
    for (const res of specific) {
      try {
        res.write(message);
      } catch (err) {
        removeSseClient(jobId, res);
      }
    }
  }

  // Also broadcast to wildcard listeners (e.g. job list panel)
  const wildcard = clients.get('*');
  if (wildcard) {
    for (const res of wildcard) {
      try {
        res.write(message);
      } catch (err) {
        removeSseClient('*', res);
      }
    }
  }
}

/**
 * Returns the number of currently connected SSE clients.
 */
export function getSseClientCount() {
  let total = 0;
  for (const set of clients.values()) {
    total += set.size;
  }
  return total;
}
