'use client';

import { v4 as uuid } from 'uuid';
import { db } from '@/lib/db/dexie';
import { localUserId as userId } from '@/lib/auth/local-user';
import { applyLocalDelete, applyLocalUpsert } from '@/lib/sync/engine';
import type { Workout, WorkoutSet } from '@/lib/types';

export async function startWorkout(
  plannedExerciseIds: string[] = [],
  routineId: string | null = null,
): Promise<string> {
  const user_id = await userId();
  const w: Workout = {
    id: uuid(),
    user_id,
    started_at: new Date().toISOString(),
    ended_at: null,
    notes: null,
    routine_id: routineId,
    updated_at: new Date().toISOString(),
  };
  await applyLocalUpsert('workouts', w);
  if (plannedExerciseIds.length > 0) {
    await db().workout_plans.put({ workout_id: w.id, exercise_ids: plannedExerciseIds });
  }
  return w.id;
}

/** Distinct exercises of a workout, in the order they were performed. */
export async function orderedExerciseIds(workoutId: string): Promise<string[]> {
  const sets = await db().workout_sets.where('workout_id').equals(workoutId).toArray();
  sets.sort(
    (a, b) => a.completed_at.localeCompare(b.completed_at) || a.set_number - b.set_number,
  );
  const ids: string[] = [];
  for (const s of sets) {
    if (!ids.includes(s.exercise_id)) ids.push(s.exercise_id);
  }
  return ids;
}

// New session pre-planned with the source workout's exercises. Sets start
// empty — "Last time" prefill guides targets. Keeps the source's routine link
// so recency stays accurate.
export async function repeatWorkout(sourceWorkoutId: string): Promise<string> {
  const source = await db().workouts.get(sourceWorkoutId);
  return startWorkout(await orderedExerciseIds(sourceWorkoutId), source?.routine_id ?? null);
}

// Close out whatever session is open so a new one can start: empty sessions
// vanish, ones with sets get ended. Used by every "start fresh" path.
export async function closeOpenWorkout(): Promise<void> {
  const open = await getOpenWorkout();
  if (!open) return;
  const setCount = await db().workout_sets.where('workout_id').equals(open.id).count();
  if (setCount === 0) await discardWorkout(open.id);
  else await endWorkout(open.id);
}

export async function addToPlan(workoutId: string, exerciseId: string): Promise<void> {
  const plan = await db().workout_plans.get(workoutId);
  const ids = plan?.exercise_ids ?? [];
  if (ids.includes(exerciseId)) return;
  await db().workout_plans.put({ workout_id: workoutId, exercise_ids: [...ids, exerciseId] });
}

/** The single open session, if any (one at a time is the product rule). */
export async function getOpenWorkout(): Promise<Workout | undefined> {
  const open = await db().workouts.filter((w) => w.ended_at == null).toArray();
  open.sort((a, b) => b.started_at.localeCompare(a.started_at));
  return open[0];
}

/** Deletes a workout and everything hanging off it. Meant for empty sessions. */
export async function discardWorkout(workoutId: string): Promise<void> {
  const sets = await db().workout_sets.where('workout_id').equals(workoutId).toArray();
  for (const s of sets) {
    await applyLocalDelete('workout_sets', s.id);
  }
  await db().workout_plans.delete(workoutId);
  await applyLocalDelete('workouts', workoutId);
}

// Open workouts with zero sets abandoned for over a day are accidents — discard
// them so they never haunt history or block "one workout at a time".
// Skipped until a full pull has landed once, so a half-synced device can't
// mistake a real workout (sets still on the server) for an empty one.
export async function cleanupAbandonedWorkouts(): Promise<void> {
  const pulledSets = await db().sync_meta.get('workout_sets');
  if (!pulledSets) return;
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const open = await db().workouts
    .filter((w) => w.ended_at == null && w.started_at < cutoff)
    .toArray();
  for (const w of open) {
    const setCount = await db().workout_sets.where('workout_id').equals(w.id).count();
    if (setCount === 0) await discardWorkout(w.id);
  }
}

// endedAt override lets a forgotten session be closed at its last set's time,
// so the recorded duration stays truthful.
export async function endWorkout(workoutId: string, endedAt?: string) {
  const existing = await db().workouts.get(workoutId);
  if (!existing) return;
  await applyLocalUpsert('workouts', {
    ...existing,
    ended_at: endedAt ?? new Date().toISOString(),
  });
  await db().workout_plans.delete(workoutId);
}

export async function saveWorkoutNotes(workoutId: string, notes: string): Promise<void> {
  const existing = await db().workouts.get(workoutId);
  if (!existing) return;
  const trimmed = notes.trim();
  if ((existing.notes ?? '') === trimmed) return;
  await applyLocalUpsert('workouts', { ...existing, notes: trimmed || null });
}

export async function logSet(input: {
  workoutId: string;
  exerciseId: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  rpe?: number | null;
}): Promise<WorkoutSet> {
  if (!(input.weightKg > 0) || !(input.reps > 0)) {
    throw new Error('Weight and reps are required');
  }
  const user_id = await userId();
  const workout = await db().workouts.get(input.workoutId);
  // Backfills on an old session stay on that session's day, not "today".
  const completed_at =
    workout?.ended_at != null ? workout.started_at : new Date().toISOString();
  const set: WorkoutSet = {
    id: uuid(),
    workout_id: input.workoutId,
    user_id,
    exercise_id: input.exerciseId,
    set_number: input.setNumber,
    weight_kg: input.weightKg,
    reps: input.reps,
    rpe: input.rpe ?? null,
    completed_at,
    updated_at: new Date().toISOString(),
  };
  await applyLocalUpsert('workout_sets', set);
  return set;
}

export async function updateSet(
  setId: string,
  input: { weightKg: number; reps: number },
): Promise<void> {
  if (!(input.weightKg > 0) || !(input.reps > 0)) {
    throw new Error('Weight and reps are required');
  }
  const existing = await db().workout_sets.get(setId);
  if (!existing) return;
  await applyLocalUpsert('workout_sets', {
    ...existing,
    weight_kg: input.weightKg,
    reps: input.reps,
  });
}

export async function deleteSet(setId: string): Promise<void> {
  const existing = await db().workout_sets.get(setId);
  if (!existing) return;
  await applyLocalDelete('workout_sets', setId);
  const remaining = (await db().workout_sets
    .where({ workout_id: existing.workout_id, exercise_id: existing.exercise_id })
    .sortBy('set_number'))
    .filter((s) => s.id !== setId);
  for (let i = 0; i < remaining.length; i++) {
    const nextNumber = i + 1;
    if (remaining[i].set_number !== nextNumber) {
      await applyLocalUpsert('workout_sets', { ...remaining[i], set_number: nextNumber });
    }
  }
}

// Last completed session for a given exercise (excluding the current workout).
export async function lastSessionSets(exerciseId: string, currentWorkoutId: string): Promise<WorkoutSet[]> {
  const all = await db()
    .workout_sets
    .where('exercise_id')
    .equals(exerciseId)
    .reverse()
    .sortBy('completed_at');
  const prior = all.filter((s) => s.workout_id !== currentWorkoutId);
  if (prior.length === 0) return [];
  const lastWorkoutId = prior[0].workout_id;
  return prior.filter((s) => s.workout_id === lastWorkoutId).sort((a, b) => a.set_number - b.set_number);
}
