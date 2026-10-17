const API_BASE = '/api';

export async function getHealth() {
  const response = await fetch(`${API_BASE}/health`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Health check failed (${response.status}): ${errorText}`);
  }
  return response.json();
}

export async function inspectMedia(url) {
  const response = await fetch(`${API_BASE}/media/inspect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ url }),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data?.error?.message || `Inspection failed with status ${response.status}`);
  }
  return data.data;
}

export async function createDownloadJob(payload) {
  const response = await fetch(`${API_BASE}/downloads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data?.error?.message || `Failed to create download job (${response.status})`);
  }
  return data.data;
}

export async function getDownloadJobs() {
  const response = await fetch(`${API_BASE}/downloads`, {
    headers: { Accept: 'application/json' },
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data?.error?.message || 'Failed to fetch jobs');
  }
  return data.data || [];
}

export async function getJobStatus(jobId) {
  const response = await fetch(`${API_BASE}/downloads/${jobId}`, {
    headers: { Accept: 'application/json' },
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data?.error?.message || 'Failed to fetch job status');
  }
  return data.data;
}

export async function deleteJobApi(jobId) {
  const response = await fetch(`${API_BASE}/downloads/${jobId}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data?.error?.message || 'Failed to delete job');
  }
  return data;
}

export async function getPlaylistItemsApi(jobId) {
  const response = await fetch(`${API_BASE}/downloads/${jobId}/items`, {
    headers: { Accept: 'application/json' },
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data?.error?.message || 'Failed to fetch playlist items');
  }
  return data.data || [];
}

/** URL helpers for direct downloads */
export function getDownloadFileUrl(jobId) {
  return `${API_BASE}/downloads/${jobId}/file`;
}

export function getArchiveUrl(jobId) {
  return `${API_BASE}/downloads/${jobId}/archive`;
}

/**
 * Creates an EventSource for live job progress updates.
 * Pass jobId for a specific job, or omit for the all-jobs wildcard stream.
 *
 * @param {string|null} jobId
 * @returns {EventSource}
 */
export function createJobEventSource(jobId = null) {
  const url = jobId ? `${API_BASE}/events/${jobId}` : `${API_BASE}/events`;
  return new EventSource(url);
}

