CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('audio', 'video')),
  scope TEXT NOT NULL CHECK(scope IN ('single', 'playlist')),
  format TEXT NOT NULL,
  quality TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN (
    'queued',
    'inspecting',
    'downloading',
    'processing',
    'zipping',
    'completed',
    'completed_with_errors',
    'failed',
    'cancelled',
    'interrupted',
    'expired'
  )),
  progress_percent REAL DEFAULT 0,
  downloaded_bytes INTEGER DEFAULT 0,
  total_bytes INTEGER DEFAULT 0,
  speed TEXT,
  eta TEXT,
  title TEXT,
  thumbnail TEXT,
  duration REAL,
  item_count INTEGER DEFAULT 1,
  current_item_index INTEGER DEFAULT 0,
  completed_item_count INTEGER DEFAULT 0,
  failed_item_count INTEGER DEFAULT 0,
  output_filename TEXT,
  output_path TEXT,
  archive_filename TEXT,
  archive_path TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs(state);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);

CREATE TABLE IF NOT EXISTS playlist_items (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  item_index INTEGER NOT NULL,
  media_id TEXT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  duration REAL,
  state TEXT NOT NULL CHECK(state IN (
    'pending',
    'downloading',
    'processing',
    'completed',
    'failed',
    'skipped'
  )),
  progress_percent REAL DEFAULT 0,
  output_filename TEXT,
  output_path TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_playlist_items_job_id ON playlist_items(job_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_index ON playlist_items(job_id, item_index);
