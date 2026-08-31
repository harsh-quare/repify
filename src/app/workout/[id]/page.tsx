'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie';
import { useExerciseList, useRecentExercises, useUnit } from '@/lib/db/hooks';
import { formatWeight, weightUnitLabel } from '@/lib/units';
import { TopNav } from '@/components/TopNav';
import { PrToast } from '@/components/PrToast';
import { RestTimer } from '@/components/RestTimer';
import { SetLogger } from '@/components/SetLogger';
import { addToPlan, discardWorkout, endWorkout, saveWorkoutNotes } from '@/lib/workout/actions';
import { saveWorkoutAsRoutine } from '@/lib/workout/routines';
import { GROUP_LABEL, classifyWorkout, type MuscleGroup } from '@/lib/workout/grouping';
import type { Exercise, WorkoutSet } from '@/lib/types';

export default function ActiveWorkoutPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const allExercises = useExerciseList();
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [ending, setEnding] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesLoaded, setNotesLoaded] = useState(false);
  // Ended workouts open read-only; edits to history are deliberate.
  const [editing, setEditing] = useState(false);
  const unit = useUnit();
  const unitLabel = weightUnitLabel(unit);

  const workout = useLiveQuery(() => db().workouts.get(id), [id]);
  const plan = useLiveQuery(() => db().workout_plans.get(id), [id]);
  // No loading default: undefined must stay distinguishable from "zero sets"
  // (an ended-but-empty backdated session auto-opens in edit mode below).
  const setsInWorkout = useLiveQuery(
    (): Promise<WorkoutSet[]> => db().workout_sets.where('workout_id').equals(id).toArray(),
    [id],
  );

  // The active exercise list = planned IDs ∪ IDs that already have logged sets.
  const exercises = useMemo<Exercise[]>(() => {
    if (allExercises.length === 0) return [];
    const setExerciseIds = (setsInWorkout ?? []).map((s) => s.exercise_id);
    const allIds = Array.from(new Set([...(plan?.exercise_ids ?? []), ...setExerciseIds]));
    const byId = new Map(allExercises.map((e) => [e.id, e] as const));
    return allIds.map((eid) => byId.get(eid)).filter((e): e is Exercise => !!e);
  }, [allExercises, plan, setsInWorkout]);

  // Derived muscle-group tags for this session (only present once some sets are logged).
  const groupTags = useMemo<MuscleGroup[]>(() => {
    if (allExercises.length === 0 || !setsInWorkout || setsInWorkout.length === 0) return [];
    return classifyWorkout(setsInWorkout, new Map(allExercises.map((e) => [e.id, e] as const)));
  }, [allExercises, setsInWorkout]);

  // Seed the notes editor once the workout row arrives.
  useEffect(() => {
    if (workout && !notesLoaded) {
      setNotesDraft(workout.notes ?? '');
      setNotesOpen(!!workout.notes);
      setNotesLoaded(true);
    }
  }, [workout, notesLoaded]);

  const alreadyEnded = !!workout?.ended_at;
  const hasSets = (setsInWorkout?.length ?? 0) > 0;

  // A backdated session arrives ended but empty — read-only mode would hide
  // the very controls needed to fill it in. There's no history to protect
  // yet, so open it editable.
  useEffect(() => {
    if (alreadyEnded && setsInWorkout != null && setsInWorkout.length === 0) {
      setEditing(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alreadyEnded, setsInWorkout == null]);

  async function onFinish() {
    if (alreadyEnded) {
      router.push('/workouts');
      return;
    }
    if (!hasSets) return;
    setEnding(true);
    await endWorkout(id);
    router.push('/workouts');
  }

  async function onDiscard() {
    if (hasSets || alreadyEnded) return;
    if (!window.confirm('Discard this workout? Nothing was logged.')) return;
    setDiscarding(true);
    await discardWorkout(id);
    router.push('/');
  }

  async function onDelete() {
    if (!alreadyEnded) return;
    const n = setsInWorkout?.length ?? 0;
    if (!window.confirm(`Delete this workout and its ${n} ${n === 1 ? 'set' : 'sets'}? This cannot be undone.`)) return;
    setDiscarding(true);
    await discardWorkout(id);
    router.push('/workouts');
  }

  async function addExercise(ex: Exercise) {
    await addToPlan(id, ex.id);
    setAdding(false);
    setSearch('');
  }

  // Before any typing, offer what the user actually trains — minus what's
  // already in this session.
  const recents = useRecentExercises(12);
  const activeIds = useMemo(() => new Set(exercises.map((e) => e.id)), [exercises]);
  const suggestions = search
    ? allExercises.filter((e) => e.name.toLowerCase().includes(search.toLowerCase())).slice(0, 20)
    : recents.filter((e) => !activeIds.has(e.id));

  return (
    <>
      <TopNav />
      {!alreadyEnded && <RestTimer workoutId={id} />}
      <PrToast />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 w-full">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {alreadyEnded ? 'Workout' : 'Workout in progress'}
            </h1>
            {workout?.started_at && (
              <p className="text-xs text-zinc-400 mt-1">Started {new Date(workout.started_at).toLocaleString()}</p>
            )}
          </div>
          {workout != null && alreadyEnded && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => void onDelete()}
                disabled={discarding}
                className="rounded-md border border-zinc-700 hover:border-rose-500 hover:text-rose-300 disabled:opacity-40 px-3 py-1.5 text-sm text-zinc-400"
              >
                {discarding ? 'Deleting…' : 'Delete'}
              </button>
              <button
                onClick={() => setEditing((v) => !v)}
                className="rounded-md border border-zinc-700 hover:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300"
              >
                {editing ? 'Done editing' : 'Edit this session'}
              </button>
              <button
                onClick={() => router.push('/workouts')}
                className="rounded-md border border-zinc-700 hover:bg-zinc-800 px-3 py-1.5 text-sm font-medium"
              >
                Back to history
              </button>
            </div>
          )}
          {workout != null && !alreadyEnded && (
            <div className="flex items-center gap-2">
              {!hasSets && (
                <button
                  onClick={onDiscard}
                  disabled={discarding}
                  className="rounded-md border border-zinc-700 hover:border-rose-500 hover:text-rose-300 disabled:opacity-40 px-3 py-1.5 text-sm text-zinc-400"
                >
                  {discarding ? 'Discarding…' : 'Discard'}
                </button>
              )}
              <button
                onClick={onFinish}
                disabled={ending || !hasSets}
                className="rounded-md bg-rose-500 hover:bg-rose-400 disabled:opacity-40 disabled:hover:bg-rose-500 px-3 py-1.5 text-sm font-medium"
              >
                {ending ? 'Ending…' : 'End workout'}
              </button>
            </div>
          )}
        </div>

        {groupTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {groupTags.map((g) => (
              <span
                key={g}
                className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300"
              >
                {GROUP_LABEL[g] ?? g}
              </span>
            ))}
          </div>
        )}

        {alreadyEnded && hasSets && !workout?.routine_id && (
          <div className="mt-3">
            <button
              type="button"
              onClick={async () => {
                const name = window.prompt('Name this routine (e.g. Upper, Push):');
                if (!name?.trim()) return;
                await saveWorkoutAsRoutine(id, name.trim());
              }}
              className="text-sm text-indigo-400 hover:text-indigo-300"
            >
              + Save as routine
            </button>
          </div>
        )}

        <div className="mt-3">
          {!notesOpen ? (
            <button
              type="button"
              onClick={() => setNotesOpen(true)}
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              + Add session notes
            </button>
          ) : (
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={() => void saveWorkoutNotes(id, notesDraft)}
              rows={2}
              placeholder="Session notes — how it felt, what to change next time…"
              aria-label="Session notes"
              className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600"
            />
          )}
        </div>

        <div className="mt-6 space-y-4">
          {alreadyEnded && !editing
            ? exercises.map((ex) => {
                const exSets = (setsInWorkout ?? [])
                  .filter((s) => s.exercise_id === ex.id)
                  .sort((a, b) => a.set_number - b.set_number);
                return (
                  <div key={ex.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-medium">{ex.name}</h3>
                      <Link
                        href={`/exercises/${ex.id}`}
                        className="text-xs text-indigo-400 hover:text-indigo-300 whitespace-nowrap"
                      >
                        Full history →
                      </Link>
                    </div>
                    <div className="mt-2 text-sm tabular-nums text-zinc-300">
                      {exSets.map((s, i) => (
                        <span key={s.id}>
                          {i > 0 && ', '}
                          {s.weight_kg != null ? formatWeight(s.weight_kg, unit) : '–'}{unitLabel} × {s.reps ?? '–'}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            : exercises.map((ex) => (
                <SetLogger key={ex.id} workoutId={id} exercise={ex} />
              ))}
          {exercises.length === 0 && (
            <p className="text-sm text-zinc-500">No exercises yet — add one below.</p>
          )}
        </div>

        <div className={`mt-6 ${alreadyEnded && !editing ? 'hidden' : ''}`}>
          {!adding ? (
            <button
              onClick={() => setAdding(true)}
              className="w-full rounded-lg border border-dashed border-zinc-700 hover:border-zinc-500 py-3 text-sm text-zinc-400 hover:text-zinc-200"
            >
              + Add exercise
            </button>
          ) : (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search exercises…"
                aria-label="Search exercises"
                className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm mb-2"
              />
              {!search && suggestions.length > 0 && (
                <div className="px-2 pb-1 text-xs uppercase tracking-wider text-zinc-500">Recent</div>
              )}
              <div className="max-h-72 overflow-auto divide-y divide-zinc-800">
                {suggestions.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => void addExercise(e)}
                    className="w-full text-left px-2 py-2 text-sm hover:bg-zinc-800 rounded"
                  >
                    <div>{e.name}</div>
                    <div className="text-xs text-zinc-500 capitalize">{e.primary_muscles[0]} · {e.equipment}</div>
                  </button>
                ))}
                {suggestions.length === 0 && search && <div className="px-2 py-2 text-sm text-zinc-500">No matches</div>}
                {suggestions.length === 0 && !search && (
                  <div className="px-2 py-2 text-sm text-zinc-500">Type to search all ~800 exercises.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
