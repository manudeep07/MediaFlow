import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { initDatabase, closeDatabase, getDatabase } from '../../src/database/index.js';
import { createJob, updateJob, recoverInterruptedJobs } from '../../src/services/jobManager.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

describe('Job Cancellation, Retries, and Recovery (/api/downloads/:id/cancel & retry)', () => {
  let app;
  let tempDbPath;

  beforeAll(() => {
    tempDbPath = path.join(os.tmpdir(), `test-cancel-retry-${Date.now()}.db`);
    initDatabase(tempDbPath);
    app = createApp();
  });

  afterAll(() => {
    closeDatabase();
    try {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    } catch (e) {}
  });

  it('returns 404 when cancelling a non-existent job', async () => {
    const res = await request(app).post('/api/downloads/non-existent-job-uuid/cancel');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('successfully cancels a queued job', async () => {
    const job = createJob({
      url: 'https://archive.org/details/test_cancel',
      type: 'audio',
      format: 'mp3',
      quality: '320',
      title: 'Job To Cancel',
    });

    const res = await request(app).post(`/api/downloads/${job.id}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.state).toBe('cancelled');
    expect(res.body.data.error_message).toBe('Job cancelled by user');
  });

  it('rejects cancelling an already completed job with 400', async () => {
    const job = createJob({
      url: 'https://archive.org/details/test_completed',
      type: 'audio',
      title: 'Completed Job',
    });
    updateJob(job.id, { state: 'completed' });

    const res = await request(app).post(`/api/downloads/${job.id}/cancel`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('completed');
  });

  it('returns 404 when retrying a non-existent job', async () => {
    const res = await request(app).post('/api/downloads/non-existent-uuid/retry');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('rejects retrying an active or completed job with 400', async () => {
    const job = createJob({
      url: 'https://archive.org/details/test_active',
      type: 'audio',
      title: 'Active Job',
    });
    updateJob(job.id, { state: 'downloading' });

    const res = await request(app).post(`/api/downloads/${job.id}/retry`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('downloading');
  });

  it('successfully retries a cancelled or failed job', async () => {
    const job = createJob({
      url: 'https://archive.org/details/test_failed_retry',
      type: 'audio',
      title: 'Failed Job',
    });
    updateJob(job.id, {
      state: 'failed',
      error_message: 'Simulated network timeout',
      progress_percent: 45,
    });

    const res = await request(app).post(`/api/downloads/${job.id}/retry`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.state).toBe('queued');
    expect(res.body.data.error_message).toBeNull();
    expect(res.body.data.progress_percent).toBe(0);
  });

  it('recovers interrupted jobs left in active states on restart', () => {
    const job1 = createJob({ url: 'https://archive.org/details/job1', title: 'Interrupted 1' });
    const job2 = createJob({ url: 'https://archive.org/details/job2', title: 'Interrupted 2' });
    updateJob(job1.id, { state: 'downloading', progress_percent: 30 });
    updateJob(job2.id, { state: 'processing', progress_percent: 80 });

    recoverInterruptedJobs();

    const db = getDatabase();
    const updated1 = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job1.id);
    const updated2 = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job2.id);

    expect(updated1.state).toBe('failed');
    expect(updated1.error_message).toBe('Interrupted due to server restart');
    expect(updated2.state).toBe('failed');
    expect(updated2.error_message).toBe('Interrupted due to server restart');
  });
});
