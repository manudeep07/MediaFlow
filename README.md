# MediaFlow — Local Media Downloader & Transcoder

**MediaFlow** is a secure, local-first, full-stack media downloading and format conversion application. It supports audio transcoding, high-definition video merging, playlist batch processing with on-the-fly ZIP generation, real-time progress streaming via Server-Sent Events (SSE), cancellation, and retry capabilities.

---

## Features

- **Single Audio Extraction & Transcoding**: Extract audio from supported media sources and transcode into **MP3** (up to 320kbps), **M4A/AAC**, or **WebM/Opus** using FFmpeg.
- **Single Video Download & Merging**: Stream high-definition video + audio tracks, multiplex them into **MP4** containers, and optimize them with faststart flags for progressive web playback.
- **Playlist Audio & Video Processing**: Batch process entire playlists sequentially with per-item progress tracking and resilience against individual item failures (`completed_with_errors`).
- **Instant ZIP Archive Export**: Package completed playlist media into compressed ZIP archives on-the-fly (`archiver` stream) directly from the browser.
- **Real-Time SSE Progress Updates**: Full duplex event-driven status tracking (`job:progress`, `job:completed`, `job:failed`, `job:cancelled`) without heavy client polling.
- **Job Cancellation & Retry**: Immediate child process termination via `AbortController` signals when cancelled, and full reset & re-dispatch for failed or cancelled jobs.
- **Crash & Restart Recovery**: Automatic database scan on server boot to gracefully mark interrupted active jobs as failed, avoiding indefinite orphan states.
- **Security Hardening**:
  - SSRF guard validating media hosts against an allowlist (`archive.org`, `commons.wikimedia.org`, `youtube.com`, etc.) and resolving DNS to block private IP spaces (`127.0.0.0/8`, `10.0.0.0/8`, `192.168.0.0/16`, `169.254.0.0/16`).
  - Strict filename sanitization (`sanitizeFilename`) stripping directory traversal sequences (`..`), null bytes, control characters, and special shell punctuation.
  - Subprocess argument encapsulation via `node:child_process` `spawn` with array arguments to prevent shell command injection.
  - Rate limiting via `express-rate-limit` and security HTTP headers via `helmet`.

---

## Tech Stack

- **Frontend**: React 19, Vite 6, Tailwind CSS v4, Lucide React, native `fetch` + `EventSource` (SSE).
- **Backend**: Express 5, Node.js 22 LTS, SQLite (`better-sqlite3`), `archiver`, Pino logging, Zod validation.
- **External Binaries**: `yt-dlp`, `ffmpeg`, and `ffprobe`.

---

## Prerequisites & Installation

### 1. External Binaries

Ensure `yt-dlp` and `ffmpeg` / `ffprobe` are installed on your system PATH or configured via environment variables:

- **Windows (Winget)**:
  ```powershell
  winget install yt-dlp
  winget install Gyan.FFmpeg
  ```
- **macOS (Homebrew)**:
  ```bash
  brew install yt-dlp ffmpeg
  ```
- **Linux (Debian/Ubuntu)**:
  ```bash
  sudo apt update && sudo apt install ffmpeg
  pip install --user yt-dlp
  ```

### 2. Dependencies Installation

Install root, backend, and frontend dependencies:

```bash
# Root
npm install

# Backend
cd backend
npm install
cd ..

# Frontend
cd frontend
npm install
cd ..
```

---

## Configuration (`.env`)

Create a `.env` file in the `backend/` directory or root based on `.env.example`:

```env
PORT=3000
HOST=127.0.0.1
FRONTEND_ORIGIN=http://localhost:5173
ALLOWED_DOMAINS=archive.org,commons.wikimedia.org,youtube.com,www.youtube.com,music.youtube.com
MAX_PLAYLIST_ITEMS=100
MAX_CONCURRENT_JOBS=2
MAX_FILE_SIZE_MB=1024
MAX_STORAGE_GB=10
YT_DLP_PATH=yt-dlp
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe
```

---

## Running the Application

### Option A: Run Both Together (Recommended)

From the project root:

```bash
npm run dev
```

### Option B: Run Services Separately

1. **Backend Server**:
   ```bash
   cd backend
   npm start        # Production mode
   # or
   npm run dev      # Watch mode
   ```
   *Runs at `http://127.0.0.1:3000`*

2. **Frontend Development Server**:
   ```bash
   cd frontend
   npm run dev
   ```
   *Runs at `http://localhost:5173`*

---

## Automated Test Suites

Run the backend test suite covering API endpoints, SSRF protection, sanitization, playlist processing, video format parsing, health checks, cancellation, and recovery:

```bash
cd backend
npm test
```

### Test Coverage Summary:
- **`tests/api/cancelAndRetry.test.js`**: Job cancellation, retry transitions, and startup crash recovery.
- **`tests/api/playlistApi.test.js`**: Playlist iteration, partial failure tolerance, item listings, and ZIP streaming.
- **`tests/api/downloads.test.js`**: Single audio job validation, authorization declarations, concurrency limits.
- **`tests/api/videoDownloads.test.js`**: MP4 format specification, quality matching, and multiplexing.
- **`tests/api/inspect.test.js`**: Media metadata and format enumeration.
- **`tests/api/health.test.js`**: Diagnostic system health reporting, binary checks, and database validation.
- **`tests/unit/ssrf.test.js`**: DNS lookup validation and private IP blocking.
- **`tests/unit/sanitize.test.js`**: Path traversal and malicious character stripping.
- **`tests/unit/playlistJobs.test.js`**: Playlist worker error handling and item state transitions.
- **`tests/unit/parseFormats.test.js`**: yt-dlp format tree extraction and resolution deduplication.
- **`tests/unit/videoFormats.test.js`**: yt-dlp format selector generation.

---

## Production Build

To bundle the frontend for production:

```bash
cd frontend
npm run build
```
Vite outputs the optimized assets to `frontend/dist`.
