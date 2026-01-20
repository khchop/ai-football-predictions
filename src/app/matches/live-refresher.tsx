'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface LiveTabRefresherProps {
  children: React.ReactNode;
  refreshInterval?: number; // in milliseconds
}

export function LiveTabRefresher({ 
  children, 
  refreshInterval = 30000 // 30 seconds default
}: LiveTabRefresherProps) {
  const router = useRouter();
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    // Update the "seconds ago" counter every second
    const counterInterval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdate.getTime()) / 1000));
    }, 1000);

    // Refresh the page data periodically
    const refreshTimer = setInterval(() => {
      // Only refresh if the tab is visible
      if (document.visibilityState === 'visible') {
        router.refresh();
        setLastUpdate(new Date());
        setSecondsAgo(0);
      }
    }, refreshInterval);

    // Also refresh when tab becomes visible after being hidden
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const timeSinceLastUpdate = Date.now() - lastUpdate.getTime();
        // If more than 1 minute since last update, refresh immediately
        if (timeSinceLastUpdate > 60000) {
          router.refresh();
          setLastUpdate(new Date());
          setSecondsAgo(0);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(counterInterval);
      clearInterval(refreshTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router, refreshInterval, lastUpdate]);

  return (
    <div>
      {children}
      <div className="mt-4 text-center text-xs text-muted-foreground/60">
        Last updated: {secondsAgo}s ago
      </div>
    </div>
  );
}
