'use client';

import { v4 as uuid } from 'uuid';
import { db } from '@/lib/db/dexie';
import { localUserId as userId } from '@/lib/auth/local-user';
import { applyLocalDelete, applyLocalUpsert } from '@/lib/sync/engine';
import { orderedExerciseIds, startWorkout } from '@/lib/workout/actions';
import type { Routine } from '@/lib/types';

export async function createRoutine(name: string, exerciseIds: string[]): Promise<Routine> {
  const user_id = await userId();
  const existing = await db().routines.toArray();
  const position = existing.reduce((max, r) => Math.max(max, r.position), -1) + 1;
  const routine: Routine = {
    id: uuid(),
    user_id,
    name: name.trim(),
    exercise_ids: exerciseIds,
    position,
    updated_at: new Date().toISOString(),
  };
  await applyLocalUpsert('routines', routine);
  return routine;
}

export async function updateRoutine(
  id: string,
  patch: { name?: string; exercise_ids?: string[] },
): Promise<void> {
  const existing = await db().routines.get(id);
  if (!existing) return;
  await applyLocalUpsert('routines', { ...existing, ...patch });
}

export async function deleteRoutine(id: string): Promise<void> {
  await applyLocalDelete('routines', id);
}

/** One tap from a finished workout to a reusable split day. */
export async function saveWorkoutAsRoutine(workoutId: string, name: string): Promise<Routine> {
  const ids = await orderedExerciseIds(workoutId);
  const routine = await createRoutine(name, ids);
  // Link the source workout so this routine's recency starts from it.
  const workout = await db().workouts.get(workoutId);
  if (workout) await applyLocalUpsert('workouts', { ...workout, routine_id: routine.id });
  return routine;
}

/** Start a session pre-planned with the routine's exercises. */
export async function startRoutine(routine: Routine): Promise<string> {
  return startWorkout(routine.exercise_ids, routine.id);
}
