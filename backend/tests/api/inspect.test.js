import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { initDatabase, closeDatabase } from '../../src/database/index.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

describe('POST /api/media/inspect', () => {
  let app;
  let tempDbPath;

  beforeAll(() => {
    tempDbPath = path.join(os.tmpdir(), `test-inspect-${Date.now()}.db`);
    initDatabase(tempDbPath);
    app = createApp();
  });

  afterAll(() => {
    closeDatabase();
    try {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    } catch (e) {}
  });

  it('rejects missing URL with 400 validation error', async () => {
    const res = await request(app)
      .post('/api/media/inspect')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects disallowed domain through SSRF guard', async () => {
    const res = await request(app)
      .post('/api/media/inspect')
      .send({ url: 'https://malicious-site.example.com/video.mp4' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SSRF_OR_DOMAIN_VALIDATION_ERROR');
    expect(res.body.error.message).toContain('is not in the allowed source domains');
  });

  it('rejects local IP and loopback destinations', async () => {
    const res = await request(app)
      .post('/api/media/inspect')
      .send({ url: 'https://127.0.0.1/video' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SSRF_OR_DOMAIN_VALIDATION_ERROR');
  });
});
