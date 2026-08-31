'use client';

import { useEffect } from 'react';
import { initSyncListeners } from '@/lib/sync/engine';
import { cleanupAbandonedWorkouts } from '@/lib/workout/actions';

export function SyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      void navigator.serviceWorker.register('/sw.js');
    }
    const cleanup = initSyncListeners();
    // Delayed so the initial sync gets a head start; the cleanup itself
    // no-ops until a full pull has landed at least once on this device.
    const timer = window.setTimeout(() => void cleanupAbandonedWorkouts(), 5000);
    return () => {
      window.clearTimeout(timer);
      cleanup?.();
    };
  }, []);
  return <>{children}</>;
}
