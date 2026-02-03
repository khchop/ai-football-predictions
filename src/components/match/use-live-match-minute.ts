'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Poll for live match minute every 30 seconds.
 *
 * Features:
 * - Automatically pauses when page hidden to save resources
 * - Cleanup on unmount prevents memory leaks
 * - Only polls when match is live and has external ID
 *
 * @param externalId - API-Football fixture ID
 * @param isLive - Whether match is currently live
 * @param intervalMs - Polling interval (default 30000ms = 30s)
 * @returns Current match minute (e.g., "67'", "HT", "90'+3") or null
 */
export function useLiveMatchMinute(
  externalId: string | null,
  isLive: boolean,
  intervalMs: number = 30000
): string | null {
  const [minute, setMinute] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Main polling effect
  useEffect(() => {
    // Only poll if match is live and has external ID
    if (!isLive || !externalId) {
      setMinute(null);
      return;
    }

    // Fetch match minute from API
    async function fetchMinute() {
      try {
        const res = await fetch(`/api/match-minute/${externalId}`);
        if (res.ok) {
          const data = await res.json();
          setMinute(data.minute); // e.g., "67'", "HT", "90'+3"
        }
      } catch (error) {
        console.error('Failed to fetch match minute:', error);
      }
    }

    // Initial fetch
    fetchMinute();

    // Set up polling interval
    intervalRef.current = setInterval(fetchMinute, intervalMs);

    // Cleanup on unmount or dependency change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isLive, externalId, intervalMs]);

  // Pause polling when page hidden
  useEffect(() => {
    // Fetch function for visibility resume
    const fetchMinute = async () => {
      if (!externalId) return;

      try {
        const res = await fetch(`/api/match-minute/${externalId}`);
        if (res.ok) {
          const data = await res.json();
          setMinute(data.minute);
        }
      } catch (error) {
        console.error('Failed to fetch match minute:', error);
      }
    };

    function handleVisibilityChange() {
      if (document.hidden && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      } else if (!document.hidden && isLive && externalId) {
        // Resume polling when page visible again
        fetchMinute(); // Immediate fetch on visibility
        intervalRef.current = setInterval(fetchMinute, intervalMs);
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLive, externalId, intervalMs]);

  return minute;
}
