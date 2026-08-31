'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie';
import { useExerciseMap } from '@/lib/db/hooks';
import {
  GROUP_LABEL,
  MUSCLE_GROUPS,
  type MuscleGroup,
  lastWorkoutByMuscleGroup,
  relativeDay,
} from '@/lib/workout/grouping';
import type { Workout, WorkoutSet } from '@/lib/types';

// Per-group accent colours. Subtle on dark — they're the only colour cue on
// the home page so users can scan by muscle without reading the label.
const GROUP_ACCENT: Record<MuscleGroup, string> = {
  chest: 'border-rose-700/60 hover:border-rose-500/60',
  back: 'border-sky-700/60 hover:border-sky-500/60',
  shoulders: 'border-amber-700/60 hover:border-amber-500/60',
  biceps: 'border-violet-700/60 hover:border-violet-500/60',
  triceps: 'border-fuchsia-700/60 hover:border-fuchsia-500/60',
  legs: 'border-emerald-700/60 hover:border-emerald-500/60',
  core: 'border-orange-700/60 hover:border-orange-500/60',
  other: 'border-zinc-700/60 hover:border-zinc-500/60',
};

export function MuscleGroupRecencyGrid() {
  const exercises = useExerciseMap();

  const workouts = useLiveQuery(
    (): Promise<Workout[]> => db().workouts.orderBy('started_at').reverse().toArray(),
    [],
    [] as Workout[],
  );

  const allSets = useLiveQuery(
    (): Promise<WorkoutSet[]> => db().workout_sets.toArray(),
    [],
    [] as WorkoutSet[],
  );

  const recencyByGroup = useMemo(() => {
    if (exercises.size === 0 || !workouts || !allSets) return new Map();
    const setsByWorkoutId = new Map<string, WorkoutSet[]>();
    for (const s of allSets) {
      const arr = setsByWorkoutId.get(s.workout_id);
      if (arr) arr.push(s);
      else setsByWorkoutId.set(s.workout_id, [s]);
    }
    return lastWorkoutByMuscleGroup(workouts, setsByWorkoutId, exercises);
  }, [exercises, workouts, allSets]);

  return (
    <section>
      <h2 className="text-xs uppercase tracking-wider text-zinc-400 mb-3">
        Last trained
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {MUSCLE_GROUPS.map((group) => {
          const entry = recencyByGroup.get(group);
          if (!entry) {
            return (
              <Link
                key={group}
                href="/exercises"
                className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950 p-4 hover:border-zinc-700 transition"
              >
                <div className="text-sm font-medium text-zinc-300">{GROUP_LABEL[group]}</div>
                <div className="mt-1 text-xs text-zinc-500">Not trained yet</div>
                <div className="mt-2 text-xs text-indigo-400">Explore exercises →</div>
              </Link>
            );
          }
          const setCount = entry.sets.length;
          return (
            <Link
              key={group}
              href={`/workout/${entry.workout.id}`}
              className={`rounded-xl border ${GROUP_ACCENT[group]} bg-zinc-900 p-4 transition`}
            >
              <div className="text-sm font-medium">{GROUP_LABEL[group]}</div>
              <div className="mt-1 text-xs text-zinc-400 capitalize">{relativeDay(entry.workout.started_at)}</div>
              <div className="mt-2 text-xs text-zinc-500 tabular-nums">{setCount} {setCount === 1 ? 'set' : 'sets'}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
