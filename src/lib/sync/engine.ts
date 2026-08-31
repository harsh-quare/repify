'use client';

import { db } from '@/lib/db/dexie';
import { getSupabaseBrowser } from '@/lib/db/supabase-browser';
import type { PendingWrite, SyncableTable } from '@/lib/types';

// One row in pending_writes per local change. The engine drains this queue
// to Supabase and pulls back any newer rows. Last-write-wins by updated_at —
// fine for Phase 1 since the same user is unlikely to be in two gyms at once.

const USER_SCOPED_TABLES: SyncableTable[] = [
  'profiles',
  'routines',
  'workouts',
  'workout_sets',
  'body_weight_log',
];

export async function queueWrite(write: Omit<PendingWrite, 'queued_at' | 'id'>) {
  await db().pending_writes.add({ ...write, queued_at: new Date().toISOString() });
}

export async function applyLocalUpsert<T extends { id: string; updated_at?: string }>(
  table: SyncableTable,
  row: T,
) {
  const stamped = { ...row, updated_at: row.updated_at ?? new Date().toISOString() };
  // @ts-expect-error Dexie typing per-table is generic here
  await db()[table].put(stamped);
  await queueWrite({ table, row_id: row.id, op: 'upsert', payload: stamped });
  void runSync();
}

export async function applyLocalDelete(table: SyncableTable, rowId: string) {
  await db()[table].delete(rowId);
  await queueWrite({ table, row_id: rowId, op: 'delete', payload: null });
  void runSync();
}

let _running = false;
let _queued = false;

// Observable phase so the UI can show what sync is actually doing —
// "no local writes queued" is not the same thing as "synced".
export type SyncPhase = 'idle' | 'syncing' | 'error';
let _phase: SyncPhase = 'idle';
const _phaseListeners = new Set<() => void>();

function setPhase(phase: SyncPhase) {
  if (_phase === phase) return;
  _phase = phase;
  for (const listener of _phaseListeners) listener();
}

export function getSyncPhase(): SyncPhase {
  return _phase;
}

export function subscribeSyncPhase(listener: () => void): () => void {
  _phaseListeners.add(listener);
  return () => _phaseListeners.delete(listener);
}

export async function runSync(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!navigator.onLine) return;
  if (_running) {
    _queued = true;
    return;
  }
  _running = true;
  setPhase('syncing');
  try {
    await pushPending();
    await pullChanges();
    setPhase('idle');
  } catch (err) {
    console.warn('[sync] failed:', err);
    setPhase('error');
  } finally {
    _running = false;
    if (_queued) {
      _queued = false;
      void runSync();
    }
  }
}

async function pushPending() {
  const sb = getSupabaseBrowser();
  const pending = await db().pending_writes.orderBy('queued_at').toArray();
  for (const w of pending) {
    if (w.op === 'upsert') {
      const { error } = await sb.from(w.table).upsert(w.payload as object);
      if (error) {
        console.warn('[sync] upsert failed', w.table, error.message);
        // Stop on first error so order is preserved; retry next tick.
        return;
      }
    } else if (w.op === 'delete') {
      const { error } = await sb.from(w.table).delete().eq('id', w.row_id);
      if (error && error.code !== 'PGRST116') {
        console.warn('[sync] delete failed', w.table, error.message);
        return;
      }
    }
    if (w.id !== undefined) await db().pending_writes.delete(w.id);
  }
}

const PULL_PAGE_SIZE = 500;

// Pull one table's rows newer than its sync_meta cursor, paging until drained.
// Offset pagination against a fixed cursor (not a moving updated_at cursor):
// bulk seeds give many rows identical timestamps, which a gt() cursor would skip.
// scope narrows the query (user tables filter by user_id; exercises pull all).
async function pullTable(table: string, scope?: { user_id: string }) {
  const sb = getSupabaseBrowser();
  const meta = await db().sync_meta.get(table);
  const since = meta?.last_synced_at ?? '1970-01-01T00:00:00Z';
  let newest = since;
  const pk = table === 'profiles' ? 'user_id' : 'id';

  for (let offset = 0; ; offset += PULL_PAGE_SIZE) {
    let query = sb
      .from(table)
      .select('*')
      .gt('updated_at', since)
      .order('updated_at', { ascending: true })
      .order(pk, { ascending: true })
      .range(offset, offset + PULL_PAGE_SIZE - 1);
    if (scope) query = query.eq('user_id', scope.user_id);

    const { data, error } = await query;
    if (error) {
      console.warn('[sync] pull failed', table, error.message);
      return;
    }
    if (!data || data.length === 0) break;

    // @ts-expect-error Dexie generic typing
    await db()[table].bulkPut(data);
    newest = data[data.length - 1].updated_at;
    if (data.length < PULL_PAGE_SIZE) break;
  }

  if (newest !== since) {
    await db().sync_meta.put({ table, last_synced_at: newest });
  }
}

async function pullChanges() {
  const sb = getSupabaseBrowser();
  // getSession reads the cached session (no network); RLS is what actually
  // scopes the queries server-side.
  const { data: { session } } = await sb.auth.getSession();
  const user = session?.user;
  if (!user) return;

  // Shared read-only catalog — mirrored locally so workouts work fully offline.
  await pullTable('exercises');

  for (const table of USER_SCOPED_TABLES) {
    await pullTable(table, { user_id: user.id });
  }
}

export function initSyncListeners() {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => void runSync());
  // Initial sync after mount.
  void runSync();
  // Periodic safety net every 60s while tab is foreground.
  const interval = window.setInterval(() => {
    if (document.visibilityState === 'visible') void runSync();
  }, 60_000);
  return () => window.clearInterval(interval);
}
