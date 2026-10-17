import React from 'react';
import { DownloadCloud, ShieldCheck, Activity } from 'lucide-react';

export function Navbar({ health, loading }) {
  const isHealthy = health?.status === 'healthy';

  return (
    <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-950/50">
            <DownloadCloud className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">MediaFlow</span>
              <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                v1.0
              </span>
            </div>
            <p className="text-xs text-zinc-400">Local-first Media Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-400 bg-zinc-950/60 border border-zinc-800 px-3 py-1.5 rounded-lg">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Local Engine (127.0.0.1)</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/40 text-xs">
            <Activity className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-zinc-400' : isHealthy ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span className="capitalize text-zinc-300">
              {loading ? 'Checking...' : isHealthy ? 'System Ready' : 'Degraded'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
