import React, { useState, useEffect } from 'react';
import {
  Music, Video, Download, Archive, Trash2,
  AlertCircle, AlertTriangle, CheckCircle2,
  Clock, Loader2, HardDrive, ChevronDown, ChevronUp,
  ListMusic, Zap, XCircle, RotateCcw, Ban,
} from 'lucide-react';
import { formatBytes, formatDuration } from '../../utils/formatters';
import { getDownloadFileUrl, getArchiveUrl, getPlaylistItemsApi } from '../../services/api';

const ACTIVE_STATES = new Set(['queued', 'inspecting', 'downloading', 'processing', 'zipping']);

function StateBadge({ state, progress }) {
  const cfg = {
    queued: { label: 'Queued', cls: 'bg-zinc-800 text-zinc-300 border-zinc-700', icon: <Clock className="w-3 h-3" /> },
    inspecting: { label: 'Inspecting', cls: 'bg-amber-950/60 text-amber-300 border-amber-800', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    downloading: { label: `Downloading ${progress ? `${Math.round(progress)}%` : ''}`, cls: 'bg-cyan-950/60 text-cyan-300 border-cyan-800', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    processing: { label: 'Processing', cls: 'bg-purple-950/60 text-purple-300 border-purple-800', icon: <Zap className="w-3 h-3 animate-pulse" /> },
    zipping: { label: 'Zipping', cls: 'bg-indigo-950/60 text-indigo-300 border-indigo-800', icon: <Archive className="w-3 h-3 animate-spin" /> },
    completed: { label: 'Completed', cls: 'bg-emerald-950/60 text-emerald-300 border-emerald-800', icon: <CheckCircle2 className="w-3 h-3" /> },
    completed_with_errors: { label: 'Partial', cls: 'bg-amber-950/60 text-amber-300 border-amber-800', icon: <AlertTriangle className="w-3 h-3" /> },
    failed: { label: 'Failed', cls: 'bg-rose-950/60 text-rose-300 border-rose-800', icon: <AlertCircle className="w-3 h-3" /> },
    cancelled: { label: 'Cancelled', cls: 'bg-zinc-800 text-zinc-400 border-zinc-700', icon: <XCircle className="w-3 h-3" /> },
  };
  const c = cfg[state] || cfg.queued;
  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium shrink-0 ${c.cls}`}>
      {c.icon}{c.label}
    </span>
  );
}

function PlaylistItemRow({ item, idx }) {
  const dot = {
    pending: 'text-zinc-600', downloading: 'text-cyan-400',
    processing: 'text-purple-400', completed: 'text-emerald-400',
    failed: 'text-rose-400', skipped: 'text-zinc-700',
  };
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-zinc-800/40 last:border-0">
      <span className="text-[10px] font-mono text-zinc-700 w-4 text-right shrink-0">{idx + 1}</span>
      <span className={`text-[10px] shrink-0 ${dot[item.state] || 'text-zinc-600'}`}>●</span>
      <span className="text-xs text-zinc-300 truncate flex-1" title={item.title}>{item.title}</span>
      {item.state === 'completed' && item.output_filename && (
        <span className="text-[10px] text-zinc-600 font-mono shrink-0">{item.output_filename.split('.').pop()?.toUpperCase()}</span>
      )}
      {item.state === 'failed' && (
        <span className="text-[10px] text-rose-400 shrink-0" title={item.error_message}>ERR</span>
      )}
      {item.progress_percent > 0 && !['completed','failed'].includes(item.state) && (
        <span className="text-[10px] font-mono text-zinc-600 shrink-0">{Math.round(item.progress_percent)}%</span>
      )}
    </div>
  );
}

export function JobCard({ job, onRemove, onCancel, onRetry }) {
  const [expanded, setExpanded] = useState(false);
  const [playlistItems, setPlaylistItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const isPlaylist = job.scope === 'playlist';
  const isActive = ACTIVE_STATES.has(job.state);
  const isCompleted = job.state === 'completed';
  const isPartial = job.state === 'completed_with_errors';
  const isFailed = job.state === 'failed';
  const isDone = isCompleted || isPartial;

  useEffect(() => {
    if (!expanded || !isPlaylist) return;
    setItemsLoading(true);
    getPlaylistItemsApi(job.id)
      .then(setPlaylistItems)
      .catch(() => {})
      .finally(() => setItemsLoading(false));
  }, [expanded, job.id, isPlaylist, job.completed_item_count]);

  const iconCls = isCompleted
    ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-400'
    : isPartial ? 'bg-amber-950/40 border-amber-700/50 text-amber-400'
    : isFailed ? 'bg-rose-950/40 border-rose-700/50 text-rose-400'
    : 'bg-zinc-800/60 border-zinc-700/50 text-cyan-400';

  const barColor = ['processing','zipping'].includes(job.state)
    ? 'from-purple-500 to-indigo-500'
    : 'from-cyan-500 to-blue-500';

  const borderCls = isActive ? 'border-zinc-700'
    : isCompleted ? 'border-zinc-700/50'
    : isPartial ? 'border-amber-900/40'
    : isFailed ? 'border-rose-900/30'
    : 'border-zinc-800';

  return (
    <div className={`bg-zinc-900/60 border rounded-2xl overflow-hidden transition-all shadow-lg shadow-black/20 ${borderCls}`}>
      {/* Top progress strip */}
      {isActive && (
        <div className="h-0.5 bg-zinc-800">
          <div
            className={`h-full bg-gradient-to-r ${barColor} transition-all duration-700 ease-out`}
            style={{ width: `${Math.max(3, job.progress_percent || 0)}%` }}
          />
        </div>
      )}

      <div className="p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Left: icon + info */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${iconCls}`}>
              {job.type === 'audio' ? <Music className="w-4 h-4" /> : <Video className="w-4 h-4" />}
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-white truncate" title={job.title || job.url}>
                {job.title || job.output_filename || `Job ${job.id.slice(0, 8)}`}
              </h4>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span className="px-1.5 py-0.5 rounded bg-zinc-800/80 text-cyan-300 font-mono font-medium uppercase text-[10px] border border-zinc-700/50">
                  {job.type === 'video' ? 'MP4' : (job.format || 'mp3').toUpperCase()}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 font-mono text-[10px] border border-zinc-700/50">
                  {job.quality === 'best' ? 'Best' : `${job.quality}${job.type === 'audio' ? 'kbps' : ''}`}
                </span>
                {isPlaylist && (
                  <span className="px-1.5 py-0.5 rounded bg-indigo-950/60 text-indigo-300 font-mono text-[10px] border border-indigo-900/50 flex items-center gap-1">
                    <ListMusic className="w-2.5 h-2.5" />
                    {isDone
                      ? `${job.completed_item_count || 0}/${job.item_count || '?'} done`
                      : `Playlist · ${job.item_count || '?'} items`}
                  </span>
                )}
                {job.duration && !isPlaylist && (
                  <span className="text-zinc-500 font-mono text-[10px] flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />{formatDuration(job.duration)}
                  </span>
                )}
                {job.total_bytes > 0 && (
                  <span className="text-zinc-500 font-mono text-[10px] flex items-center gap-0.5">
                    <HardDrive className="w-3 h-3" />{formatBytes(job.total_bytes)}
                  </span>
                )}
                {isActive && isPlaylist && job.current_item_index > 0 && (
                  <span className="text-zinc-500 font-mono text-[10px]">item {job.current_item_index}/{job.item_count}</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: badge + actions */}
          <div className="flex items-center gap-2 shrink-0">
            <StateBadge state={job.state} progress={job.progress_percent} />

            {isCompleted && !isPlaylist && (
              <a href={getDownloadFileUrl(job.id)} download={job.output_filename}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition cursor-pointer">
                <Download className="w-3.5 h-3.5" />Save
              </a>
            )}

            {isDone && isPlaylist && (job.completed_item_count || 0) > 0 && (
              <a href={getArchiveUrl(job.id)} download
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition cursor-pointer">
                <Archive className="w-3.5 h-3.5" />ZIP
              </a>
            )}

            {isActive && onCancel && (
              <button
                type="button"
                onClick={() => onCancel(job.id)}
                title="Cancel download"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-rose-950/60 hover:text-rose-400 text-zinc-400 text-xs font-medium border border-zinc-700/60 hover:border-rose-800 transition cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            )}

            {(isFailed || job.state === 'cancelled') && onRetry && (
              <button
                type="button"
                onClick={() => onRetry(job.id)}
                title="Retry download"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 text-xs font-medium border border-cyan-800 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            )}

            {isPlaylist && (
              <button type="button" onClick={() => setExpanded(v => !v)}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition cursor-pointer"
                title={expanded ? 'Collapse' : 'Show items'}>
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}

            <button type="button" onClick={() => onRemove(job.id)} title="Delete job"
              className="p-1.5 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-zinc-800 transition cursor-pointer">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress detail row */}
        {isActive && (
          <div className="mt-4 pt-3 border-t border-zinc-800/60 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span>
                {job.state === 'downloading' && 'Retrieving media stream…'}
                {job.state === 'processing' && (job.type === 'audio' ? 'Transcoding with FFmpeg…' : 'Remuxing video…')}
                {job.state === 'zipping' && 'Building ZIP archive…'}
                {job.state === 'queued' && 'Waiting in queue…'}
                {job.state === 'inspecting' && 'Inspecting playlist…'}
              </span>
              <span className="text-zinc-200">{Math.round(job.progress_percent || 0)}%</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
              <div className={`h-full bg-gradient-to-r ${barColor} transition-all duration-700 rounded-full`}
                style={{ width: `${Math.max(3, job.progress_percent || 0)}%` }} />
            </div>
            {(job.speed || job.eta) && (
              <div className="flex justify-between text-[10px] font-mono text-zinc-600">
                {job.speed && <span>⚡ {job.speed}</span>}
                {job.eta && <span>ETA {job.eta}</span>}
              </div>
            )}
          </div>
        )}

        {/* Error / partial error message */}
        {(isFailed || isPartial) && job.error_message && (
          <div className={`mt-3 p-2.5 rounded-lg border text-xs leading-relaxed font-mono ${
            isFailed ? 'bg-rose-950/30 border-rose-800/40 text-rose-300' : 'bg-amber-950/20 border-amber-800/30 text-amber-300'
          }`}>
            {job.error_message}
          </div>
        )}
      </div>

      {/* Playlist item drawer */}
      {isPlaylist && expanded && (
        <div className="border-t border-zinc-800 bg-zinc-950/60 px-5 py-3">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <ListMusic className="w-3 h-3" />Playlist Items
            </h5>
            {isDone && (
              <span className="text-[10px] font-mono text-zinc-600">
                {job.completed_item_count || 0} ok · {job.failed_item_count || 0} failed
              </span>
            )}
          </div>
          {itemsLoading ? (
            <div className="flex items-center gap-2 py-2 text-xs text-zinc-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />Loading…
            </div>
          ) : playlistItems.length === 0 ? (
            <p className="text-xs text-zinc-700 py-2">Items will appear here during processing.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto pr-1">
              {playlistItems.map((item, idx) => (
                <PlaylistItemRow key={item.id} item={item} idx={idx} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

