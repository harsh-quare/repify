'use client';

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie';
import { runSync } from '@/lib/sync/engine';

// Trust needs visibility: shows whether every logged set has reached the
// server. Tap retries the sync immediately.
export function SyncStatus() {
  const pending = useLiveQuery(() => db().pending_writes.count(), [], 0);
  // Assume online for SSR/hydration; corrected in the effect.
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  const state = !online ? 'offline' : pending > 0 ? 'pending' : 'synced';
  const dot =
    state === 'offline' ? 'bg-rose-400' : state === 'pending' ? 'bg-amber-400' : 'bg-emerald-400';
  const label =
    state === 'offline'
      ? `Offline${pending > 0 ? ` · ${pending} queued` : ''}`
      : state === 'pending'
        ? `${pending} queued`
        : 'Synced';
  const title =
    state === 'offline'
      ? 'No connection — sets are saved on this device and will sync when you are back online.'
      : state === 'pending'
        ? 'Some changes have not reached the server yet. Tap to retry now.'
        : 'All changes are on the server.';

  return (
    <button
      type="button"
      onClick={() => void runSync()}
      title={title}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-zinc-400 hover:bg-zinc-800"
    >
      <span className={`w-2 h-2 rounded-full ${dot}`} aria-hidden />
      {label}
    </button>
  );
}
