import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { initDatabase, closeDatabase } from '../../src/database/index.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

describe('GET /api/health', () => {
  let app;
  let tempDbPath;

  beforeAll(() => {
    tempDbPath = path.join(os.tmpdir(), `test-health-${Date.now()}.db`);
    initDatabase(tempDbPath);
    app = createApp();
  });

  afterAll(() => {
    closeDatabase();
    try {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    } catch (e) {}
  });

  it('returns comprehensive health and diagnostic data', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(['healthy', 'degraded']).toContain(res.body.status);

    // Node environment check
    expect(res.body.node).toHaveProperty('version');
    expect(res.body.node.compatible).toBe(true);

    // Database check
    expect(res.body.database).toHaveProperty('status');
    expect(res.body.database.status).toBe('connected');

    // Binaries check
    expect(res.body.binaries).toHaveProperty('ytdlp');
    expect(res.body.binaries).toHaveProperty('ffmpeg');
    expect(res.body.binaries).toHaveProperty('ffprobe');

    // Configuration check without secret leakage
    expect(res.body.configuration).toHaveProperty('allowedDomains');
    expect(res.body.configuration).toHaveProperty('maxPlaylistItems');
    expect(res.body.configuration).not.toHaveProperty('API_KEY');
    expect(res.body.configuration).not.toHaveProperty('apiKey');
  }, 20000);
});
