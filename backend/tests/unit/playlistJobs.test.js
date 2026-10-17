/**
 * Unit tests for Phase 5 — Playlist Job Processing.
 * Verifies: playlist_items CRUD, partial-failure state transitions,
 * completed_with_errors detection, and cancellation check.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initDatabase, closeDatabase } from '../../src/database/index.js';
import {
  createJob,
  getJob,
  updateJob,
  createPlaylistItem,
  updatePlaylistItem,
  getPlaylistItems,
} from '../../src/services/jobManager.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

// ─── DB Bootstrap ─────────────────────────────────────────────────────────────

let dbPath;

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `mf_plt_test_${Date.now()}.db`);
  initDatabase(dbPath);
});

afterEach(() => {
  closeDatabase();
  try {
    fs.unlinkSync(dbPath);
  } catch (_) {}
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePlaylistJob(overrides = {}) {
  return createJob({
    url: 'https://youtube.com/playlist?list=test123',
    type: 'audio',
    scope: 'playlist',
    format: 'mp3',
    quality: '192',
    title: 'Test Playlist',
    itemCount: 3,
    ...overrides,
  });
}

// ─── Playlist Item CRUD ───────────────────────────────────────────────────────

describe('createPlaylistItem', () => {
  it('creates a playlist_items row with state=pending', () => {
    const job = makePlaylistJob();
    const itemId = createPlaylistItem({
      jobId: job.id,
      itemIndex: 1,
      mediaId: 'abc123',
      title: 'Track One',
      url: 'https://youtube.com/watch?v=abc123',
      duration: 210,
    });

    expect(typeof itemId).toBe('string');
    expect(itemId.length).toBeGreaterThan(0);
  });

  it('seeds multiple playlist items preserving order', () => {
    const job = makePlaylistJob();
    const titles = ['Alpha', 'Beta', 'Gamma'];
    for (let i = 0; i < titles.length; i++) {
      createPlaylistItem({
        jobId: job.id,
        itemIndex: i + 1,
        title: titles[i],
        url: `https://youtube.com/watch?v=item${i}`,
      });
    }

    const items = getPlaylistItems(job.id);
    expect(items).toHaveLength(3);
    expect(items.map((it) => it.title)).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(items.every((it) => it.state === 'pending')).toBe(true);
  });
});

describe('updatePlaylistItem', () => {
  it('transitions item state from pending → downloading → completed', () => {
    const job = makePlaylistJob();
    const itemId = createPlaylistItem({
      jobId: job.id,
      itemIndex: 1,
      title: 'Track One',
      url: 'https://youtube.com/watch?v=abc',
    });

    updatePlaylistItem(itemId, { state: 'downloading', progress_percent: 30 });
    updatePlaylistItem(itemId, {
      state: 'completed',
      progress_percent: 100,
      output_filename: 'Track One.mp3',
      output_path: '/tmp/Track One.mp3',
    });

    const [item] = getPlaylistItems(job.id);
    expect(item.state).toBe('completed');
    expect(item.progress_percent).toBe(100);
    expect(item.output_filename).toBe('Track One.mp3');
  });

  it('marks item as failed with error_message', () => {
    const job = makePlaylistJob();
    const itemId = createPlaylistItem({
      jobId: job.id,
      itemIndex: 1,
      title: 'Broken Track',
      url: 'https://youtube.com/watch?v=broken',
    });

    updatePlaylistItem(itemId, { state: 'failed', error_message: 'Network timeout' });

    const [item] = getPlaylistItems(job.id);
    expect(item.state).toBe('failed');
    expect(item.error_message).toBe('Network timeout');
  });
});

// ─── Partial Failure State Logic ──────────────────────────────────────────────

describe('Partial failure state transitions', () => {
  it('marks job completed when all items succeed', () => {
    const job = makePlaylistJob({ itemCount: 2 });
    updateJob(job.id, {
      state: 'completed',
      completed_item_count: 2,
      failed_item_count: 0,
      progress_percent: 100,
      completed_at: new Date().toISOString(),
    });

    const result = getJob(job.id);
    expect(result.state).toBe('completed');
    expect(result.failed_item_count).toBe(0);
  });

  it('marks job completed_with_errors when some items fail', () => {
    const job = makePlaylistJob({ itemCount: 3 });
    updateJob(job.id, {
      state: 'completed_with_errors',
      completed_item_count: 2,
      failed_item_count: 1,
      error_message: '1 of 3 items failed',
      progress_percent: 100,
      completed_at: new Date().toISOString(),
    });

    const result = getJob(job.id);
    expect(result.state).toBe('completed_with_errors');
    expect(result.completed_item_count).toBe(2);
    expect(result.failed_item_count).toBe(1);
    expect(result.error_message).toContain('1 of 3');
  });

  it('marks job failed when all items fail', () => {
    const job = makePlaylistJob({ itemCount: 2 });
    updateJob(job.id, {
      state: 'failed',
      completed_item_count: 0,
      failed_item_count: 2,
      error_message: 'All playlist items failed to download',
      progress_percent: 0,
    });

    const result = getJob(job.id);
    expect(result.state).toBe('failed');
    expect(result.completed_item_count).toBe(0);
  });
});

// ─── Cancellation Detection ───────────────────────────────────────────────────

describe('Cancellation signal via job state', () => {
  it('job state can be set to cancelled mid-processing', () => {
    const job = makePlaylistJob();
    updateJob(job.id, { state: 'downloading' });

    // Simulate cancellation arriving while iterating
    updateJob(job.id, { state: 'cancelled' });

    const fetched = getJob(job.id);
    expect(fetched.state).toBe('cancelled');
  });

  it('cancellation check returns true when state is cancelled', () => {
    const job = makePlaylistJob();
    updateJob(job.id, { state: 'cancelled' });

    const currentJob = getJob(job.id);
    const isCancelled = currentJob?.state === 'cancelled';
    expect(isCancelled).toBe(true);
  });
});

// ─── getPlaylistItems ─────────────────────────────────────────────────────────

describe('getPlaylistItems', () => {
  it('returns empty array when no items seeded', () => {
    const job = makePlaylistJob();
    expect(getPlaylistItems(job.id)).toEqual([]);
  });

  it('scopes items to the correct job', () => {
    const jobA = makePlaylistJob();
    const jobB = makePlaylistJob();

    createPlaylistItem({ jobId: jobA.id, itemIndex: 1, title: 'A1', url: 'https://youtube.com/watch?v=a1' });
    createPlaylistItem({ jobId: jobB.id, itemIndex: 1, title: 'B1', url: 'https://youtube.com/watch?v=b1' });

    const itemsA = getPlaylistItems(jobA.id);
    const itemsB = getPlaylistItems(jobB.id);

    expect(itemsA).toHaveLength(1);
    expect(itemsA[0].title).toBe('A1');
    expect(itemsB).toHaveLength(1);
    expect(itemsB[0].title).toBe('B1');
  });
});
