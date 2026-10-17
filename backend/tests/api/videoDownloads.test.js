import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { initDatabase, closeDatabase } from '../../src/database/index.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

describe('Video Downloads API', () => {
  let app;
  let tempDbPath;

  beforeAll(() => {
    tempDbPath = path.join(os.tmpdir(), `test-video-${Date.now()}.db`);
    initDatabase(tempDbPath);
    app = createApp();
  });

  afterAll(() => {
    closeDatabase();
    try {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    } catch (e) {}
  });

  it('creates a single video download job with requested resolution', async () => {
    const res = await request(app)
      .post('/api/downloads')
      .send({
        url: 'https://archive.org/details/test_video',
        type: 'video',
        scope: 'single',
        format: 'mp4',
        quality: '1080p',
        authorized: true,
        title: 'Open Source Video Sample',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.type).toBe('video');
    expect(res.body.data.format).toBe('mp4');
    expect(res.body.data.quality).toBe('1080p');
    expect(res.body.data.title).toBe('Open Source Video Sample');

    const jobId = res.body.data.id;
    const getRes = await request(app).get(`/api/downloads/${jobId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(jobId);
    expect(getRes.body.data.type).toBe('video');
  });
});
