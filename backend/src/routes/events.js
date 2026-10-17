/**
 * SSE Routes
 * GET /api/events        — subscribe to all job events (wildcard channel)
 * GET /api/events/:jobId — subscribe to a specific job's events
 */
import { Router } from 'express';
import { addSseClient, removeSseClient } from '../services/sseManager.js';
import { getJob } from '../services/jobManager.js';
import { logger } from '../middleware/logger.js';

export const eventsRouter = Router();

function setupSseConnection(jobId, req, res) {
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  // Send an immediate connected event
  res.write(`event: connected\ndata: ${JSON.stringify({ jobId, time: Date.now() })}\n\n`);

  // Register this response stream
  addSseClient(jobId, res);

  // Heartbeat every 20 seconds to keep the TCP connection alive through proxies
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (e) {
      clearInterval(heartbeat);
    }
  }, 20_000);

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    removeSseClient(jobId, res);
    logger.debug({ jobId }, 'SSE client closed connection');
  });
}

// All-jobs event stream
eventsRouter.get('/events', (req, res) => {
  setupSseConnection('*', req, res);
});

// Per-job event stream
eventsRouter.get('/events/:jobId', (req, res) => {
  const { jobId } = req.params;

  // Validate the job exists before establishing the SSE stream
  const job = getJob(jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      error: { code: 'JOB_NOT_FOUND', message: `Job ${jobId} not found` },
    });
  }

  // If job is already terminal, send a final snapshot and close immediately
  const terminalStates = ['completed', 'completed_with_errors', 'failed', 'cancelled'];
  if (terminalStates.includes(job.state)) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders();
    const eventType = job.state === 'completed' || job.state === 'completed_with_errors'
      ? 'job:completed'
      : 'job:failed';
    res.write(`event: ${eventType}\ndata: ${JSON.stringify(job)}\n\n`);
    res.end();
    return;
  }

  setupSseConnection(jobId, req, res);
});
