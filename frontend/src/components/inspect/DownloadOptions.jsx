import React from 'react';
import { Music, Video, ListMusic, FileAudio, AlertCircle, ShieldCheck, Download } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';

export function DownloadOptions({
  mediaData,
  mode,
  setMode,
  scope,
  setScope,
  format,
  setFormat,
  quality,
  setQuality,
  authorized,
  setAuthorized,
  onStartDownload,
  downloadDisabled = false,
}) {
  if (!mediaData) return null;

  const isPlaylist = !!mediaData.isPlaylist;
  const resolutions = mediaData.availableResolutions || [];
  const maxSourceBitrate = mediaData.maxSourceAudioBitrate || 192;

  // Handle Mode Change (adjust default format and quality)
  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (newMode === 'audio') {
      setFormat('mp3');
      setQuality('best');
    } else {
      setFormat('mp4');
      setQuality('best');
    }
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
        <div>
          <h3 className="text-base font-semibold text-white">Download & Conversion Settings</h3>
          <p className="text-xs text-zinc-400 mt-0.5">Configure media mode, target format, and quality parameters.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Mode Selection (Audio vs Video) */}
        <div>
          <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
            1. Media Mode
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleModeChange('audio')}
              className={`flex items-center justify-center gap-2.5 p-3 rounded-xl border text-sm font-medium transition cursor-pointer ${
                mode === 'audio'
                  ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200 shadow-sm shadow-cyan-950'
                  : 'bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              <Music className={`w-4 h-4 ${mode === 'audio' ? 'text-cyan-400' : 'text-zinc-500'}`} />
              <span>Audio Only</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('video')}
              className={`flex items-center justify-center gap-2.5 p-3 rounded-xl border text-sm font-medium transition cursor-pointer ${
                mode === 'video'
                  ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200 shadow-sm shadow-cyan-950'
                  : 'bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              <Video className={`w-4 h-4 ${mode === 'video' ? 'text-cyan-400' : 'text-zinc-500'}`} />
              <span>Video & Audio</span>
            </button>
          </div>
        </div>

        {/* 2. Scope Selection (Single Item vs Playlist) */}
        <div>
          <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
            2. Scope
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setScope('single')}
              className={`flex items-center justify-center gap-2.5 p-3 rounded-xl border text-sm font-medium transition cursor-pointer ${
                scope === 'single'
                  ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200 shadow-sm shadow-cyan-950'
                  : 'bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              <FileAudio className={`w-4 h-4 ${scope === 'single' ? 'text-cyan-400' : 'text-zinc-500'}`} />
              <span>Single Item</span>
            </button>

            <button
              type="button"
              disabled={!isPlaylist}
              onClick={() => setScope('playlist')}
              title={!isPlaylist ? 'Source is not a playlist' : ''}
              className={`flex items-center justify-center gap-2.5 p-3 rounded-xl border text-sm font-medium transition cursor-pointer ${
                scope === 'playlist'
                  ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200 shadow-sm shadow-cyan-950'
                  : 'bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              } ${!isPlaylist ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <ListMusic className={`w-4 h-4 ${scope === 'playlist' ? 'text-cyan-400' : 'text-zinc-500'}`} />
              <span>Full Playlist</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* 3. Output Format */}
        <div>
          <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
            3. Output Container Format
          </label>
          <div className="flex flex-wrap gap-2">
            {mode === 'audio' ? (
              ['mp3', 'm4a', 'webm'].map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormat(fmt)}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-mono font-medium uppercase transition cursor-pointer ${
                    format === fmt
                      ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200'
                      : 'bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  {fmt}
                </button>
              ))
            ) : (
              ['mp4'].map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormat(fmt)}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-mono font-medium uppercase transition cursor-pointer ${
                    format === fmt
                      ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200'
                      : 'bg-zinc-950/50 border-zinc-800 text-zinc-400'
                  }`}
                >
                  {fmt} (H.264 / AAC)
                </button>
              ))
            )}
          </div>
        </div>

        {/* 4. Target Quality / Bitrate / Resolution */}
        <div>
          <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
            4. Quality Selection
          </label>

          {mode === 'audio' ? (
            <div className="space-y-2">
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700/80 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 outline-none cursor-pointer"
              >
                <option value="best">Best Available Source Audio (Recommended)</option>
                <option value="320">320 kbps CBR (Extreme MP3)</option>
                <option value="256">256 kbps CBR (High Quality)</option>
                <option value="192">192 kbps CBR (Standard Quality)</option>
                <option value="128">128 kbps CBR (Compact / Voice)</option>
              </select>

              {/* Informative Quality Note */}
              <div className="bg-amber-950/20 border border-amber-800/40 rounded-lg p-2.5 flex items-start gap-2 text-[11px] text-amber-300">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p>
                  Converting lossy audio to a higher bitrate does not restore lost acoustic fidelity. 
                  {maxSourceBitrate > 0 && ` Source audio estimated at ~${maxSourceBitrate} kbps.`}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700/80 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 outline-none cursor-pointer"
              >
                <option value="best">Best Available Resolution</option>
                {resolutions.map((r) => (
                  <option key={r.resolution} value={r.resolution}>
                    {r.resolution} {r.fps ? `(${r.fps}fps)` : ''} {r.filesize ? `— ~${formatBytes(r.filesize)}` : ''}
                  </option>
                ))}
              </select>

              <p className="text-[11px] text-zinc-400">
                Resolution fallback: If exact resolution cannot be delivered, the next lower compatible resolution is selected.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 5. Authorization Confirmation & Download Trigger */}
      <div className="pt-4 border-t border-zinc-800/80 space-y-4">
        <label className="flex items-start gap-3 p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 cursor-pointer hover:border-zinc-700 transition">
          <input
            type="checkbox"
            checked={authorized}
            onChange={(e) => setAuthorized(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-zinc-700 text-cyan-600 focus:ring-cyan-500/30 cursor-pointer"
          />
          <div className="text-xs">
            <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              Download Authorization Declaration
            </span>
            <p className="text-zinc-400 mt-0.5 leading-relaxed">
              I declare that I have lawful authority, permission, or licensing to download and convert this media item in accordance with applicable terms and copyright.
            </p>
          </div>
        </label>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onStartDownload}
            disabled={!authorized || downloadDisabled}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-sm transition shadow-lg shadow-emerald-950/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>
              Queue {mode === 'audio' ? 'Audio' : 'Video'} {scope === 'playlist' ? 'Playlist' : 'Download'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
