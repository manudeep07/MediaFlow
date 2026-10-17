import { useState, useEffect, useCallback, useRef } from 'react';
import { getDownloadJobs, createDownloadJob, deleteJobApi, createJobEventSource } from '../services/api';

const ACTIVE_STATES = new Set(['queued', 'inspecting', 'downloading', 'processing', 'zipping']);
const TERMINAL_STATES = new Set(['completed', 'completed_with_errors', 'failed', 'cancelled', 'expired']);

export function useDownloadJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const sseRef = useRef(null);
  const pollRef = useRef(null);

  // Merge a single updated job snapshot into the jobs list
  const mergeJob = useCallback((updatedJob) => {
    setJobs((prev) => {
      const idx = prev.findIndex((j) => j.id === updatedJob.id);
      if (idx === -1) {
        // New job appeared (e.g. created in another tab) — prepend
        return [updatedJob, ...prev];
      }
      const next = [...prev];
      next[idx] = updatedJob;
      return next;
    });
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const data = await getDownloadJobs();
      setJobs(data);
      setError(null);
      return data;
    } catch (err) {
      setError(err.message || 'Failed to load download jobs');
      return [];
    }
  }, []);

  // SSE subscription to the wildcard channel — receives all job events
  const connectSse = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
    }

    try {
      const es = createJobEventSource(null); // wildcard: /api/events
      sseRef.current = es;

      const handleJobEvent = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data && data.id) {
            mergeJob(data);
          }
        } catch (_) {}
      };

      es.addEventListener('job:progress', handleJobEvent);
      es.addEventListener('job:completed', handleJobEvent);
      es.addEventListener('job:failed', handleJobEvent);
      es.addEventListener('job:cancelled', handleJobEvent);

      es.addEventListener('connected', () => {
        setError(null);
      });

      es.onerror = () => {
        // SSE reconnects automatically; fall back to polling if it keeps failing
        schedulePoll(5000);
      };
    } catch (_) {
      // EventSource not available (e.g. test environment)
      schedulePoll(3000);
    }
  }, [mergeJob]);

  // Lazy poll — only used as fallback when SSE is unavailable/errored
  const schedulePoll = useCallback((delayMs = 3000) => {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = setTimeout(async () => {
      const latest = await fetchJobs();
      const hasActive = latest.some((j) => ACTIVE_STATES.has(j.state));
      if (hasActive) schedulePoll(2500);
    }, delayMs);
  }, [fetchJobs]);

  useEffect(() => {
    fetchJobs();
    connectSse();

    return () => {
      if (sseRef.current) sseRef.current.close();
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [fetchJobs, connectSse]);

  const addJob = async (payload) => {
    setLoading(true);
    setError(null);
    try {
      const newJob = await createDownloadJob(payload);
      setJobs((prev) => [newJob, ...prev]);
      return newJob;
    } catch (err) {
      setError(err.message || 'Failed to create job');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const removeJob = async (id) => {
    try {
      await deleteJobApi(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch (err) {
      setError(err.message || 'Failed to delete job');
    }
  };

  return {
    jobs,
    loading,
    error,
    refreshJobs: fetchJobs,
    createJob: addJob,
    removeJob,
  };
}
