import { useState, useCallback } from 'react';
import { inspectMedia } from '../services/api';

export function useMediaInspection() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mediaData, setMediaData] = useState(null);

  // Configuration selections
  const [mode, setMode] = useState('audio'); // 'audio' | 'video'
  const [scope, setScope] = useState('single'); // 'single' | 'playlist'
  const [format, setFormat] = useState('mp3');
  const [quality, setQuality] = useState('best');
  const [authorized, setAuthorized] = useState(false);

  const handleInspect = useCallback(async (targetUrl = url) => {
    const cleanUrl = targetUrl.trim();
    if (!cleanUrl) {
      setError('Please provide a valid media URL');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await inspectMedia(cleanUrl);
      setMediaData(data);

      // Auto-set initial selections based on inspected data
      const isPlaylist = !!data.isPlaylist;
      setScope(isPlaylist ? 'playlist' : 'single');
      setMode('audio');
      setFormat('mp3');
      setQuality('best');
      setAuthorized(false);
    } catch (err) {
      setError(err.message || 'Media inspection failed');
      setMediaData(null);
    } finally {
      setLoading(false);
    }
  }, [url]);

  const reset = useCallback(() => {
    setUrl('');
    setMediaData(null);
    setError(null);
    setLoading(false);
    setAuthorized(false);
  }, []);

  return {
    url,
    setUrl,
    loading,
    error,
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
    inspect: handleInspect,
    reset,
  };
}
