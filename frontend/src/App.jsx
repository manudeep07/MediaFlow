import React, { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { StatusBanner } from './components/layout/StatusBanner';
import { UrlInput } from './components/inspect/UrlInput';
import { MediaPreview } from './components/inspect/MediaPreview';
import { DownloadOptions } from './components/inspect/DownloadOptions';
import { ActiveJobs } from './components/downloads/ActiveJobs';
import { useMediaInspection } from './hooks/useMediaInspection';
import { useDownloadJobs } from './hooks/useDownloadJobs';
import { getHealth } from './services/api';
import { AlertCircle, SlidersHorizontal, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [actionNotice, setActionNotice] = useState(null);

  const {
    url,
    setUrl,
    loading: inspecting,
    error: inspectError,
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
    inspect,
    reset,
  } = useMediaInspection();

  const {
    jobs,
    loading: jobLoading,
    error: jobError,
    refreshJobs,
    createJob,
    removeJob,
  } = useDownloadJobs();

  const fetchHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const data = await getHealth();
      setHealth(data);
    } catch (err) {
      setHealthError(err.message || 'Failed to connect to backend');
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const handleStartDownload = async () => {
    if (!mediaData || !authorized) return;

    try {
      const created = await createJob({
        url: mediaData.webpageUrl || url,
        type: mode,
        scope: scope,
        format: format,
        quality: quality,
        authorized: true,
        title: mediaData.title,
        thumbnail: mediaData.thumbnail,
        duration: mediaData.duration,
      });

      setActionNotice({
        type: 'success',
        message: `Download job "${created.title || created.id}" queued successfully. Monitoring progress below.`,
      });

      // Clear notice after 6 seconds
      setTimeout(() => setActionNotice(null), 6000);
    } catch (err) {
      setActionNotice({
        type: 'error',
        message: err.message || 'Failed to start download job',
      });
    }
  };

  const allowedDomains = health?.configuration?.allowedDomains || [
    'archive.org',
    'commons.wikimedia.org',
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      <Navbar health={health} loading={healthLoading} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header & Status Toggle */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              MediaFlow &mdash; Media Downloader & Converter
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Local-first, authorized audio and video extraction engine with stream inspection.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-medium transition cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
            <span>{showDiagnostics ? 'Hide Diagnostics' : 'System Diagnostics'}</span>
          </button>
        </div>

        {/* Collapsible System Health & Diagnostics */}
        {showDiagnostics && (
          <div className="animate-in fade-in duration-200">
            <StatusBanner health={health} error={healthError} />
          </div>
        )}

        {/* URL Inspection Input */}
        <UrlInput
          url={url}
          setUrl={setUrl}
          onInspect={inspect}
          loading={inspecting}
          allowedDomains={allowedDomains}
        />

        {/* Inspection Error Alert */}
        {inspectError && (
          <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/60 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-rose-200">Media Inspection Failed</h3>
              <p className="text-xs text-rose-300/90 mt-1 leading-relaxed">{inspectError}</p>
              <p className="text-[11px] text-zinc-400 mt-2">
                Tip: Ensure the URL starts with <code>https://</code> and belongs to an authorized domain ({allowedDomains.join(', ')}).
              </p>
            </div>
          </div>
        )}

        {/* Action Notice Banner */}
        {actionNotice && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 animate-in fade-in ${
            actionNotice.type === 'error'
              ? 'bg-rose-950/40 border-rose-800/60 text-rose-200'
              : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
          }`}>
            {actionNotice.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs">
              <span className="font-semibold text-white">
                {actionNotice.type === 'error' ? 'Download Error' : 'Job Started'}
              </span>
              <p className="mt-0.5">{actionNotice.message}</p>
            </div>
          </div>
        )}

        {/* Inspected Media Preview and Download Options */}
        {mediaData && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <MediaPreview mediaData={mediaData} />

            <DownloadOptions
              mediaData={mediaData}
              mode={mode}
              setMode={setMode}
              scope={scope}
              setScope={setScope}
              format={format}
              setFormat={setFormat}
              quality={quality}
              setQuality={setQuality}
              authorized={authorized}
              setAuthorized={setAuthorized}
              onStartDownload={handleStartDownload}
              downloadDisabled={jobLoading}
            />
          </div>
        )}

        {/* Download Tasks and History Section */}
        <div className="pt-4 border-t border-zinc-800/80">
          <ActiveJobs
            jobs={jobs}
            onRemoveJob={removeJob}
            onRefresh={refreshJobs}
            loading={jobLoading}
          />
        </div>
      </main>

      <footer className="border-t border-zinc-900 py-4 text-center text-xs text-zinc-500">
        MediaFlow &bull; Local media processing engine &bull; Bound to 127.0.0.1
      </footer>
    </div>
  );
}
