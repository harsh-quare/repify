'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie';
import { getSyncPhase, runSync, subscribeSyncPhase } from '@/lib/sync/engine';

// Trust needs visibility. "Synced" is only claimed when the engine is idle,
// nothing is queued to push, and at least one full pull has landed on this
// device — a fresh browser mid-download says "Syncing…", not "Synced".
// Tap retries immediately.
export function SyncStatus() {
  const pending = useLiveQuery(() => db().pending_writes.count(), [], 0);
  const pulledTables = useLiveQuery(() => db().sync_meta.count(), []);
  const phase = useSyncExternalStore(subscribeSyncPhase, getSyncPhase, () => 'idle' as const);
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

  const hasEverPulled = (pulledTables ?? 0) > 0;

  const state = !online
    ? 'offline'
    : phase === 'syncing'
      ? 'syncing'
      : pending > 0
        ? 'pending'
        : phase === 'error' || !hasEverPulled
          ? 'stale'
          : 'synced';

  const dot = {
    offline: 'bg-rose-400',
    syncing: 'bg-indigo-400 animate-pulse',
    pending: 'bg-amber-400',
    stale: 'bg-amber-400',
    synced: 'bg-emerald-400',
  }[state];

  const label = {
    offline: `Offline${pending > 0 ? ` · ${pending} queued` : ''}`,
    syncing: 'Syncing…',
    pending: `${pending} queued`,
    stale: 'Not synced yet',
    synced: 'Synced',
  }[state];

  const title = {
    offline: 'No connection — changes are saved on this device and will sync when you are back online.',
    syncing: 'Syncing with the server…',
    pending: 'Some changes have not reached the server yet. Tap to retry now.',
    stale: 'This device has not completed a sync yet. Tap to retry.',
    synced: 'All changes are on the server.',
  }[state];

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
