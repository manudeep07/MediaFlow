import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { initDatabase, closeDatabase } from '../../src/database/index.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

describe('Downloads API (/api/downloads)', () => {
  let app;
  let tempDbPath;

  beforeAll(() => {
    tempDbPath = path.join(os.tmpdir(), `test-downloads-${Date.now()}.db`);
    initDatabase(tempDbPath);
    app = createApp();
  });

  afterAll(() => {
    closeDatabase();
    try {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    } catch (e) {}
  });

  it('rejects job creation if authorization declaration is false', async () => {
    const res = await request(app)
      .post('/api/downloads')
      .send({
        url: 'https://archive.org/details/test',
        type: 'audio',
        scope: 'single',
        format: 'mp3',
        quality: '320',
        authorized: false,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('authorization');
  });

  it('creates and lists a single audio download job', async () => {
    const res = await request(app)
      .post('/api/downloads')
      .send({
        url: 'https://archive.org/details/test_audio',
        type: 'audio',
        scope: 'single',
        format: 'mp3',
        quality: '320',
        authorized: true,
        title: 'Test Audio Track',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.format).toBe('mp3');
    expect(res.body.data.quality).toBe('320');

    const jobId = res.body.data.id;

    // Retrieve by ID
    const getRes = await request(app).get(`/api/downloads/${jobId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(jobId);
    expect(getRes.body.data.title).toBe('Test Audio Track');

    // List jobs
    const listRes = await request(app).get('/api/downloads');
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);
    expect(listRes.body.data.some((j) => j.id === jobId)).toBe(true);
  });

  it('returns 400 when attempting to download an uncompleted file', async () => {
    // Create an uncompleted job
    const createRes = await request(app)
      .post('/api/downloads')
      .send({
        url: 'https://archive.org/details/test_uncompleted',
        type: 'audio',
        scope: 'single',
        format: 'mp3',
        quality: '256',
        authorized: true,
      });

    const jobId = createRes.body.data.id;

    const fileRes = await request(app).get(`/api/downloads/${jobId}/file`);
    expect(fileRes.status).toBe(400);
    expect(fileRes.body.error.code).toBe('JOB_NOT_COMPLETED');
  });

  it('returns 404 for nonexistent job file download', async () => {
    const fileRes = await request(app).get('/api/downloads/nonexistent-id-000/file');
    expect(fileRes.status).toBe(404);
  });
});
