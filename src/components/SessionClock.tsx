'use client';

import { useEffect, useState } from 'react';
import { elapsedMs, estimateKcal, formatClock } from '@/lib/workout/session';
import type { Workout } from '@/lib/types';

export function useElapsedMs(startedAt: string | undefined, endedAt: string | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  const live = !!startedAt && !endedAt;

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [live]);

  if (!startedAt) return 0;
  return elapsedMs(startedAt, endedAt ?? null, endedAt ? new Date(endedAt).getTime() : now);
}

export function SessionClock({
  startedAt,
  endedAt,
}: {
  startedAt: string;
  endedAt: string | null;
}) {
  const ms = useElapsedMs(startedAt, endedAt);
  return (
    <span className="tabular-nums font-medium tracking-tight text-indigo-300">{formatClock(ms)}</span>
  );
}

export function EstimatedKcal({
  workout,
  weightKg,
  compact = false,
}: {
  workout: Workout;
  weightKg: number | null;
  compact?: boolean;
}) {
  const ms = useElapsedMs(workout.started_at, workout.ended_at);
  const kcal =
    workout.calories_kcal ??
    (weightKg != null && weightKg > 0 ? estimateKcal(weightKg, ms) : null);
  if (kcal == null || kcal <= 0) return null;
  return (
    <span className={`text-zinc-500 tabular-nums ${compact ? 'text-xs' : ''}`}>
      ~{kcal} kcal{compact ? '' : ' est.'}
    </span>
  );
}
