import React from 'react';
import { JobCard } from './JobCard';
import { ListFilter, RefreshCw, Inbox } from 'lucide-react';

export function ActiveJobs({ jobs = [], onRemoveJob, onCancelJob, onRetryJob, onRefresh, loading }) {
  if (jobs.length === 0) {
    return (
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500 flex flex-col items-center justify-center gap-2">
        <Inbox className="w-8 h-8 text-zinc-600" />
        <p className="text-sm font-medium text-zinc-400">No active or past download jobs</p>
        <p className="text-xs text-zinc-600">Inspect a media URL above and queue an audio or video download.</p>
      </div>
    );
  }

  const activeJobs = jobs.filter((j) =>
    ['queued', 'inspecting', 'downloading', 'processing', 'zipping'].includes(j.state)
  );
  const pastJobs = jobs.filter(
    (j) => !['queued', 'inspecting', 'downloading', 'processing', 'zipping'].includes(j.state)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListFilter className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
            Download Tasks & History ({jobs.length})
          </h3>
          {activeJobs.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 text-[11px] font-mono font-medium">
              {activeJobs.length} active
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
          title="Refresh jobs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-3">
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            onRemove={onRemoveJob}
            onCancel={onCancelJob}
            onRetry={onRetryJob}
          />
        ))}
      </div>
    </div>
  );
}
