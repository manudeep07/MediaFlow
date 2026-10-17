/**
 * API integration tests for Phase 5 — Playlist Download Endpoints.
 * Tests cover: job creation with scope=playlist, /items, and /archive guard conditions.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../../src/app.js';
import { initDatabase, closeDatabase, getDatabase } from '../../src/database/index.js';
import { createJob, updateJob, createPlaylistItem, updatePlaylistItem } from '../../src/services/jobManager.js';

let app;
let dbPath;

beforeAll(() => {
  dbPath = path.join(os.tmpdir(), `mf_plt_api_${Date.now()}.db`);
  initDatabase(dbPath);
  app = createApp();
});

afterAll(() => {
  closeDatabase();
});

// ─── POST /api/downloads — Playlist Job Creation ──────────────────────────────

describe('POST /api/downloads — playlist scope', () => {
  it('creates a playlist audio job (scope=playlist) and returns 201', async () => {
    const res = await request(app)
      .post('/api/downloads')
      .set('Content-Type', 'application/json')
      .send({
        url: 'https://archive.org/details/test-playlist',
        type: 'audio',
        scope: 'playlist',
        format: 'mp3',
        quality: '192',
        authorized: true,
        title: 'Test Playlist',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scope).toBe('playlist');
    expect(res.body.data.type).toBe('audio');
    expect(res.body.data.state).toBe('queued');
  });

  it('creates a playlist video job (scope=playlist, type=video)', async () => {
    const res = await request(app)
      .post('/api/downloads')
      .set('Content-Type', 'application/json')
      .send({
        url: 'https://archive.org/details/test-video-playlist',
        type: 'video',
        scope: 'playlist',
        quality: '720',
        authorized: true,
        title: 'Video Playlist',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('video');
    expect(res.body.data.scope).toBe('playlist');
  });

  it('rejects playlist job without authorized=true', async () => {
    const res = await request(app)
      .post('/api/downloads')
      .set('Content-Type', 'application/json')
      .send({
        url: 'https://archive.org/details/test-playlist',
        type: 'audio',
        scope: 'playlist',
        authorized: false,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─── GET /api/downloads/:id/items ────────────────────────────────────────────

describe('GET /api/downloads/:id/items', () => {
  it('returns 404 for unknown job id', async () => {
    const res = await request(app).get('/api/downloads/nonexistent-id/items');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('JOB_NOT_FOUND');
  });

  it('returns 400 for a single-item (non-playlist) job', async () => {
    const job = createJob({
      url: 'https://archive.org/details/single-item',
      type: 'audio',
      scope: 'single',
      format: 'mp3',
      quality: '192',
    });

    const res = await request(app).get(`/api/downloads/${job.id}/items`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NOT_A_PLAYLIST_JOB');
  });

  it('returns empty array when no playlist items seeded', async () => {
    const job = createJob({
      url: 'https://archive.org/details/my-playlist',
      type: 'audio',
      scope: 'playlist',
      format: 'mp3',
      quality: '192',
    });

    const res = await request(app).get(`/api/downloads/${job.id}/items`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns seeded playlist items in index order', async () => {
    const job = createJob({
      url: 'https://archive.org/details/ordered-playlist',
      type: 'audio',
      scope: 'playlist',
      format: 'mp3',
      quality: '192',
      itemCount: 2,
    });

    createPlaylistItem({ jobId: job.id, itemIndex: 1, title: 'Track 1', url: 'https://archive.org/watch?v=1' });
    createPlaylistItem({ jobId: job.id, itemIndex: 2, title: 'Track 2', url: 'https://archive.org/watch?v=2' });

    const res = await request(app).get(`/api/downloads/${job.id}/items`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].title).toBe('Track 1');
    expect(res.body.data[1].title).toBe('Track 2');
  });
});

// ─── GET /api/downloads/:id/archive ──────────────────────────────────────────

describe('GET /api/downloads/:id/archive', () => {
  it('returns 404 for unknown job id', async () => {
    const res = await request(app).get('/api/downloads/bad-id/archive');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('JOB_NOT_FOUND');
  });

  it('returns 400 for single-item job', async () => {
    const job = createJob({
      url: 'https://archive.org/details/single',
      type: 'audio',
      scope: 'single',
      format: 'mp3',
      quality: '192',
    });

    const res = await request(app).get(`/api/downloads/${job.id}/archive`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NOT_A_PLAYLIST_JOB');
  });

  it('returns 400 when job is still downloading (not yet finished)', async () => {
    const job = createJob({
      url: 'https://archive.org/details/in-progress-playlist',
      type: 'audio',
      scope: 'playlist',
      format: 'mp3',
      quality: '192',
    });
    updateJob(job.id, { state: 'downloading' });

    const res = await request(app).get(`/api/downloads/${job.id}/archive`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('JOB_NOT_READY');
  });

  it('returns 404 with NO_FILES_TO_ZIP when job is completed but has no completed items', async () => {
    const job = createJob({
      url: 'https://archive.org/details/empty-playlist',
      type: 'audio',
      scope: 'playlist',
      format: 'mp3',
      quality: '192',
    });
    updateJob(job.id, { state: 'completed_with_errors', completed_item_count: 0 });

    const res = await request(app).get(`/api/downloads/${job.id}/archive`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NO_FILES_TO_ZIP');
  });
});
