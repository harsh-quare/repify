'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie';
import { useExerciseList, useRecentExercises, useRoutineLastDone, useRoutines } from '@/lib/db/hooks';
import { TopNav } from '@/components/TopNav';
import { closeOpenWorkout, getOpenWorkout, startWorkout } from '@/lib/workout/actions';
import { startRoutine } from '@/lib/workout/routines';
import { relativeDay, timeAgo } from '@/lib/workout/grouping';
import type { Exercise } from '@/lib/types';

export default function NewWorkoutPage() {
  const router = useRouter();
  const allExercises = useExerciseList();
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState('');
  const [picked, setPicked] = useState<Exercise[]>([]);
  const [starting, setStarting] = useState(false);

  // One workout at a time: if a session is still open, offer resume before new.
  const openWorkout = useLiveQuery(() => getOpenWorkout(), []);
  const openWorkoutSetCount = useLiveQuery(
    () =>
      openWorkout
        ? db().workout_sets.where('workout_id').equals(openWorkout.id).count()
        : Promise.resolve(0),
    [openWorkout?.id],
    0,
  );

  const exercises = useMemo(() => {
    let list = allExercises;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(q));
    }
    if (muscle) {
      list = list.filter(
        (e) => e.primary_muscles.includes(muscle) || e.secondary_muscles.includes(muscle),
      );
    }
    return list.slice(0, 100);
  }, [allExercises, search, muscle]);

  // What the user actually trains, surfaced before any searching.
  const recents = useRecentExercises(8);
  const showRecents = !search && !muscle && recents.length > 0;

  function togglePick(ex: Exercise) {
    setPicked((cur) =>
      cur.some((c) => c.id === ex.id) ? cur.filter((c) => c.id !== ex.id) : [...cur, ex],
    );
  }

  async function onStart() {
    setStarting(true);
    await closeOpenWorkout();
    const id = await startWorkout(picked.map((p) => p.id));
    router.push(`/workout/${id}`);
  }

  const routines = useRoutines();
  const lastDone = useRoutineLastDone();

  async function onStartRoutine(routineId: string) {
    const routine = routines.find((r) => r.id === routineId);
    if (!routine) return;
    setStarting(true);
    await closeOpenWorkout();
    const id = await startRoutine(routine);
    router.push(`/workout/${id}`);
  }

  return (
    <>
      <TopNav />
      <main className="max-w-5xl mx-auto px-4 py-6 w-full">
        <h1 className="text-2xl font-semibold tracking-tight">Start a workout</h1>
        <p className="text-sm text-zinc-400 mt-1">Pick exercises to plan today, or just start and add as you go.</p>

        {openWorkout && (
          <div className="mt-4 rounded-lg border border-amber-700/60 bg-amber-950/30 p-4">
            <div className="text-sm font-medium text-amber-200">
              You have a workout in progress
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              Started {timeAgo(openWorkout.started_at)}
              {openWorkoutSetCount > 0
                ? ` · ${openWorkoutSetCount} ${openWorkoutSetCount === 1 ? 'set' : 'sets'} logged`
                : ' · nothing logged yet'}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => router.push(`/workout/${openWorkout.id}`)}
                className="rounded-md bg-indigo-500 hover:bg-indigo-400 px-3 py-1.5 text-sm font-medium"
              >
                Resume that workout
              </button>
              <span className="self-center text-xs text-zinc-500">
                or start a new one below — the open one will be {openWorkoutSetCount > 0 ? 'ended' : 'discarded'}.
              </span>
            </div>
          </div>
        )}

        {routines.length > 0 && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Your split</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {routines.map((r) => {
                const last = lastDone.get(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => void onStartRoutine(r.id)}
                    disabled={starting}
                    className="text-xs rounded-md border border-indigo-700 bg-indigo-500/10 hover:bg-indigo-500/20 disabled:opacity-50 px-2 py-1 text-indigo-300"
                  >
                    {r.name} · {last ? relativeDay(last) : 'new'}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exercises…"
            aria-label="Search exercises"
            className="rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 w-56"
          />
          <select value={muscle} onChange={(e) => setMuscle(e.target.value)} aria-label="Filter by muscle" className="rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 capitalize">
            <option value="">Any muscle</option>
            {['chest','biceps','triceps','shoulders','quadriceps','hamstrings','glutes','calves','lats','middle back','lower back','abdominals','forearms','traps'].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {picked.length > 0 && (
          <div className="mt-4 rounded-lg border border-indigo-700 bg-indigo-950/40 p-3">
            <div className="text-xs uppercase tracking-wider text-indigo-300 mb-2">{picked.length} picked</div>
            <div className="flex flex-wrap gap-2">
              {picked.map((p) => (
                <button
                  key={p.id}
                  onClick={() => togglePick(p)}
                  aria-label={`Remove ${p.name}`}
                  className="text-xs rounded-md bg-indigo-500/20 border border-indigo-700 px-2 py-1 hover:bg-indigo-500/30"
                >
                  {p.name} ✕
                </button>
              ))}
            </div>
          </div>
        )}

        {showRecents && (
          <>
            <div className="mt-4 text-xs uppercase tracking-wider text-zinc-500">Recent</div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {recents.map((e) => {
                const on = picked.some((c) => c.id === e.id);
                return (
                  <button
                    key={e.id}
                    onClick={() => togglePick(e)}
                    className={`text-left p-3 rounded-lg border ${on ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'}`}
                  >
                    <div className="text-sm font-medium">{e.name}</div>
                    <div className="text-xs text-zinc-400 capitalize">{e.primary_muscles[0]} · {e.equipment}</div>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 text-xs uppercase tracking-wider text-zinc-500">All exercises</div>
          </>
        )}
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {exercises.map((e) => {
            const on = picked.some((c) => c.id === e.id);
            return (
              <button
                key={e.id}
                onClick={() => togglePick(e)}
                className={`text-left p-3 rounded-lg border ${on ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'}`}
              >
                <div className="text-sm font-medium">{e.name}</div>
                <div className="text-xs text-zinc-400 capitalize">{e.primary_muscles[0]} · {e.equipment}</div>
              </button>
            );
          })}
        </div>

        <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] sm:bottom-0 inset-x-0 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
          <div className="max-w-5xl mx-auto px-4 py-3 flex justify-end">
            <button
              onClick={onStart}
              disabled={starting}
              className="rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 px-5 py-2 font-medium"
            >
              {starting ? 'Starting…' : picked.length > 0 ? `Start with ${picked.length} exercises` : 'Start empty workout'}
            </button>
          </div>
        </div>
        <div className="h-20" />
      </main>
    </>
  );
}
