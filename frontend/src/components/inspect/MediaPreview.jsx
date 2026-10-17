import React, { useState } from 'react';
import { formatDuration } from '../../utils/formatters';
import { PlayCircle, ListMusic, Clock, User, ChevronDown, ChevronUp, Music, Video } from 'lucide-react';

export function MediaPreview({ mediaData }) {
  const [showEntries, setShowEntries] = useState(false);

  if (!mediaData) return null;

  const {
    isPlaylist,
    title,
    thumbnail,
    duration,
    uploader,
    itemCount,
    entries = [],
    description,
  } = mediaData;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 overflow-hidden">
      <div className="flex flex-col md:flex-row gap-5">
        {/* Thumbnail */}
        <div className="w-full md:w-64 h-40 bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 relative shrink-0 flex items-center justify-center">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={title}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-500">
              {isPlaylist ? <ListMusic className="w-10 h-10 text-cyan-500/60" /> : <PlayCircle className="w-10 h-10 text-cyan-500/60" />}
              <span className="text-xs">No preview thumbnail</span>
            </div>
          )}

          {/* Badges on Thumbnail */}
          <div className="absolute top-2 left-2 flex gap-1">
            <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[11px] font-semibold tracking-wide uppercase text-cyan-300 border border-cyan-500/30">
              {isPlaylist ? 'Playlist' : 'Single Item'}
            </span>
          </div>

          {duration && (
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[11px] font-mono text-zinc-200 flex items-center gap-1 border border-zinc-700/40">
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>{formatDuration(duration)}</span>
            </div>
          )}
        </div>

        {/* Media Info */}
        <div className="flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-white tracking-tight line-clamp-2">
                {title}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-zinc-400">
              {uploader && (
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-zinc-300">{uploader}</span>
                </div>
              )}

              {isPlaylist && (
                <div className="flex items-center gap-1.5 text-cyan-400 font-medium">
                  <ListMusic className="w-3.5 h-3.5" />
                  <span>{itemCount} playlist item{itemCount !== 1 ? 's' : ''} detected</span>
                </div>
              )}
            </div>

            {description && (
              <p className="mt-3 text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                {description}
              </p>
            )}
          </div>

          {/* Expand playlist entries toggle if it is a playlist */}
          {isPlaylist && entries.length > 0 && (
            <div className="mt-4 pt-3 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={() => setShowEntries(!showEntries)}
                className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 font-medium transition cursor-pointer"
              >
                <span>{showEntries ? 'Hide playlist items' : `View all ${entries.length} items`}</span>
                {showEntries ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expandable playlist entries list */}
      {isPlaylist && showEntries && (
        <div className="mt-4 pt-4 border-t border-zinc-800 max-h-60 overflow-y-auto pr-2 space-y-1.5">
          {entries.map((item) => (
            <div
              key={item.id + item.index}
              className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-zinc-950/60 border border-zinc-800/60 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="font-mono text-zinc-500 text-[11px] w-6 shrink-0">{item.index}.</span>
                <span className="text-zinc-300 truncate">{item.title}</span>
              </div>
              {item.duration && (
                <span className="font-mono text-zinc-500 text-[11px] shrink-0">
                  {formatDuration(item.duration)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
