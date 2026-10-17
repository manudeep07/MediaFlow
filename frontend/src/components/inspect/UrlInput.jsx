import React from 'react';
import { Search, Clipboard, X, Loader2, Globe, Sparkles } from 'lucide-react';

export function UrlInput({ url, setUrl, onInspect, loading, allowedDomains = [] }) {
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
      }
    } catch (e) {
      console.warn('Clipboard access denied or unavailable', e);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading && url.trim()) {
      onInspect();
    }
  };

  const setSampleUrl = (sample) => {
    setUrl(sample);
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 shadow-xl shadow-black/20">
      <div className="flex items-center justify-between mb-3">
        <label htmlFor="media-url-input" className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <span>Enter Media or Playlist URL</span>
        </label>
        {allowedDomains.length > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>Trusted sources:</span>
            <span className="font-mono text-zinc-300 font-medium">{allowedDomains.join(', ')}</span>
          </div>
        )}
      </div>

      <div className="relative flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <input
            id="media-url-input"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://archive.org/details/..."
            disabled={loading}
            className="w-full bg-zinc-950/80 border border-zinc-700/80 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition pr-20 font-mono"
          />

          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {url && (
              <button
                type="button"
                onClick={() => setUrl('')}
                disabled={loading}
                title="Clear input"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handlePaste}
              disabled={loading}
              title="Paste from clipboard"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-cyan-300 hover:bg-zinc-800 transition cursor-pointer flex items-center gap-1 text-xs"
            >
              <Clipboard className="w-4 h-4" />
              <span className="hidden md:inline text-[11px] font-sans">Paste</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onInspect()}
          disabled={loading || !url.trim()}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-sm transition shadow-lg shadow-cyan-950/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Inspecting...</span>
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              <span>Inspect Media</span>
            </>
          )}
        </button>
      </div>

      {/* Helpful public test samples */}
      <div className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        <span>Try verified public sample:</span>
        <button
          type="button"
          onClick={() => setSampleUrl('https://archive.org/details/Electra_526')}
          className="text-cyan-400 hover:underline font-mono text-[11px] cursor-pointer"
        >
          Electra (Audio)
        </button>
        <span>&bull;</span>
        <button
          type="button"
          onClick={() => setSampleUrl('https://archive.org/details/night_of_the_living_dead')}
          className="text-cyan-400 hover:underline font-mono text-[11px] cursor-pointer"
        >
          Night of the Living Dead (Video)
        </button>
      </div>
    </div>
  );
}
