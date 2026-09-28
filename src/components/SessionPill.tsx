'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie';
import { useMounted } from '@/lib/db/hooks';
import { getOpenWorkout } from '@/lib/workout/actions';
import { EstimatedKcal, SessionClock } from '@/components/SessionClock';
import type { BodyWeightEntry } from '@/lib/types';

export function SessionPill() {
  const pathname = usePathname();
  const mounted = useMounted();
  const workout = useLiveQuery(
    () => (mounted ? getOpenWorkout() : Promise.resolve(undefined)),
    [mounted],
  );
  const latestWeight = useLiveQuery(
    () => (mounted ? db().body_weight_log.orderBy('logged_at').last() : Promise.resolve(undefined)),
    [mounted],
  ) as BodyWeightEntry | undefined;

  if (!workout || pathname.startsWith('/auth')) return null;
  if (pathname === `/workout/${workout.id}`) return null;

  const weightKg = latestWeight ? Number(latestWeight.weight_kg) : null;

  return (
    <Link
      href={`/workout/${workout.id}`}
      data-session-pill
      className="fixed z-50 right-3 sm:right-6 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] sm:bottom-6 flex items-center gap-3 rounded-full border border-indigo-500/60 bg-zinc-950/95 backdrop-blur px-4 py-2.5 shadow-lg shadow-indigo-950/40 hover:border-indigo-400"
    >
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      <span className="text-xs text-zinc-400 hidden sm:inline">In session</span>
      <SessionClock startedAt={workout.started_at} endedAt={null} />
      <EstimatedKcal workout={workout} weightKg={weightKg} compact />
    </Link>
  );
}
