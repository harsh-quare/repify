'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie';
import { useExerciseMap, useUnit } from '@/lib/db/hooks';
import { formatWeightWithUnit } from '@/lib/units';
import { recentLifts } from '@/lib/workout/progress';
import type { WorkoutSet } from '@/lib/types';

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <span className="text-[10px] text-zinc-400 w-16 text-right">1 session</span>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const w = 64;
  const h = 22;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = max === min ? h / 2 : h - ((v - min) / (max - min)) * (h - 2) - 1;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      <polyline fill="none" stroke="#818cf8" strokeWidth="1.5" points={points} />
    </svg>
  );
}

export function RecentLifts() {
  const exercises = useExerciseMap();
  const unit = useUnit();

  const allSets = useLiveQuery(
    (): Promise<WorkoutSet[]> => db().workout_sets.toArray(),
    [],
    [] as WorkoutSet[],
  );

  const lifts = useMemo(() => recentLifts(allSets ?? []), [allSets]);

  if (lifts.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs uppercase tracking-wider text-zinc-400 mb-3">Your lifts</h2>
      <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden">
        {lifts.map((lift) => {
          const name = exercises.get(lift.exerciseId)?.name ?? lift.exerciseId;
          return (
            <li key={lift.exerciseId}>
              <Link
                href={`/exercises/${lift.exerciseId}`}
                className="flex items-center gap-3 px-4 py-3 bg-zinc-900 hover:bg-zinc-800/60 transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{name}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {lift.lastWeight != null ? `${formatWeightWithUnit(lift.lastWeight, unit)} last` : 'Logged'}
                    {' · '}
                    {lift.sessionCount} {lift.sessionCount === 1 ? 'session' : 'sessions'}
                    {' · '}
                    View progress →
                  </div>
                </div>
                <Sparkline values={lift.weights} />
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-zinc-500 mt-2">
        Tap a lift for its progress graph. Only exercises you have logged appear here.
      </p>
    </section>
  );
}
