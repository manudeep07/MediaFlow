import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Database, Terminal, Cpu, Info, Globe, HardDrive } from 'lucide-react';

export function StatusBanner({ health, error }) {
  if (error) {
    return (
      <div className="bg-rose-950/30 border border-rose-800/60 rounded-xl p-4 my-6 flex items-start gap-3">
        <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-rose-300">Backend Connection Error</h3>
          <p className="text-xs text-rose-400 mt-1">{error}</p>
          <p className="text-xs text-zinc-400 mt-2">Ensure the backend is running on <code>http://127.0.0.1:3000</code>.</p>
        </div>
      </div>
    );
  }

  if (!health) return null;

  const { node, database, binaries, configuration, status } = health;
  const isHealthy = status === 'healthy';

  return (
    <div className="space-y-4 my-6">
      {/* Overview status box */}
      <div className={`p-4 rounded-xl border flex items-start justify-between gap-4 ${
        isHealthy 
          ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200' 
          : 'bg-amber-950/20 border-amber-800/40 text-amber-200'
      }`}>
        <div className="flex items-start gap-3">
          {isHealthy ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          )}
          <div>
            <h3 className="text-sm font-medium">
              {isHealthy ? 'Media Engine Environment Verified' : 'Environment Diagnostics: Degraded Dependencies'}
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              {isHealthy 
                ? 'All runtime requirements, external binaries, and SQLite storage are operational.' 
                : 'One or more external binaries require installation or configuration.'}
            </p>
          </div>
        </div>
        <span className={`text-[11px] font-mono px-2 py-0.5 rounded border uppercase font-medium ${
          isHealthy 
            ? 'bg-emerald-900/40 border-emerald-700/50 text-emerald-300' 
            : 'bg-amber-900/40 border-amber-700/50 text-amber-300'
        }`}>
          {status}
        </span>
      </div>

      {/* Grid of Diagnostics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* External Binaries Card */}
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>Media Executables</span>
          </div>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/60">
              <span className="font-mono text-zinc-300">yt-dlp</span>
              {binaries.ytdlp.available ? (
                <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {binaries.ytdlp.version?.split(' ')[0] || 'Available'}
                </span>
              ) : (
                <span className="text-[11px] text-amber-400 font-mono flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Missing
                </span>
              )}
            </div>
            {!binaries.ytdlp.available && binaries.ytdlp.installGuide && (
              <p className="text-[10px] text-zinc-500 font-mono bg-zinc-950 p-1.5 rounded border border-zinc-800">
                {binaries.ytdlp.installGuide}
              </p>
            )}

            <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/60">
              <span className="font-mono text-zinc-300">ffmpeg</span>
              {binaries.ffmpeg.available ? (
                <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {binaries.ffmpeg.version?.split(' ')[2] || 'Available'}
                </span>
              ) : (
                <span className="text-[11px] text-amber-400 font-mono flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Missing
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="font-mono text-zinc-300">ffprobe</span>
              {binaries.ffprobe.available ? (
                <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {binaries.ffprobe.version?.split(' ')[2] || 'Available'}
                </span>
              ) : (
                <span className="text-[11px] text-amber-400 font-mono flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Missing
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Database & Runtime Card */}
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
            <Database className="w-4 h-4 text-purple-400" />
            <span>Storage & Runtime</span>
          </div>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/60">
              <span className="text-zinc-400">Node Runtime</span>
              <span className="font-mono text-zinc-200">{node.version}</span>
            </div>
            <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/60">
              <span className="text-zinc-400">SQLite Metadata</span>
              <span className="text-emerald-400 font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {database.status}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Disk Quota Limit</span>
              <span className="font-mono text-zinc-200">{configuration.maxStorageGb} GB</span>
            </div>
          </div>
        </div>

        {/* Policy & Allowlist Card */}
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>Source Allowlist</span>
          </div>
          <div className="space-y-2 text-xs">
            <p className="text-[11px] text-zinc-400">Authorized source domains:</p>
            <div className="flex flex-wrap gap-1.5">
              {configuration.allowedDomains?.map((domain) => (
                <span
                  key={domain}
                  className="px-2 py-0.5 rounded bg-zinc-800/80 text-cyan-300 font-mono text-[11px] border border-zinc-700/60"
                >
                  {domain}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-zinc-500 mt-2 flex items-center gap-1">
              <Info className="w-3 h-3 text-zinc-400" />
              Configure in <code>.env</code> via <code>ALLOWED_DOMAINS</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
