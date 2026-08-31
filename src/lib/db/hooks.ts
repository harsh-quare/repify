'use client';

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie';
import type { Exercise, Profile, Routine, UnitPreference } from '@/lib/types';

/** The signed-in user's profile from the local mirror (undefined until first sync). */
export function useProfile(): Profile | undefined {
  return useLiveQuery(() => db().profiles.toCollection().first(), []);
}

/** Unit preference with a metric fallback while the profile loads. */
export function useUnit(): UnitPreference {
  return useProfile()?.unit_preference ?? 'metric';
}

/** Full exercise catalog from the local mirror, sorted by name. Works offline. */
export function useExerciseList(): Exercise[] {
  return (
    useLiveQuery(() => db().exercises.orderBy('name').toArray(), [], [] as Exercise[]) ?? []
  );
}

export function useExerciseMap(): Map<string, Exercise> {
  const list = useExerciseList();
  return useMemo(() => new Map(list.map((e) => [e.id, e])), [list]);
}

/** The user's split routines, in their defined order. */
export function useRoutines(): Routine[] {
  return (
    useLiveQuery(() => db().routines.orderBy('position').toArray(), [], [] as Routine[]) ?? []
  );
}

/** routine_id → started_at of its most recent session ("last done"). */
export function useRoutineLastDone(): Map<string, string> {
  const workouts = useLiveQuery(() => db().workouts.toArray(), []);
  return useMemo(() => {
    const m = new Map<string, string>();
    for (const w of workouts ?? []) {
      if (!w.routine_id) continue;
      const cur = m.get(w.routine_id);
      if (!cur || w.started_at > cur) m.set(w.routine_id, w.started_at);
    }
    return m;
  }, [workouts]);
}

/** Exercises the user has actually logged, most recently trained first. */
export function useRecentExercises(limit = 12): Exercise[] {
  const map = useExerciseMap();
  const sets = useLiveQuery(() => db().workout_sets.toArray(), []);
  return useMemo(() => {
    const lastByExercise = new Map<string, string>();
    for (const s of sets ?? []) {
      const cur = lastByExercise.get(s.exercise_id);
      if (!cur || s.completed_at > cur) lastByExercise.set(s.exercise_id, s.completed_at);
    }
    return [...lastByExercise.entries()]
      .sort((a, b) => b[1].localeCompare(a[1]))
      .map(([id]) => map.get(id))
      .filter((e): e is Exercise => !!e)
      .slice(0, limit);
  }, [map, sets, limit]);
}
