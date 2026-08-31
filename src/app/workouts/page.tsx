'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie';
import { useExerciseMap } from '@/lib/db/hooks';
import { TopNav } from '@/components/TopNav';
import { closeOpenWorkout, getOpenWorkout, repeatWorkout } from '@/lib/workout/actions';
import { GROUP_LABEL, classifyWorkout, relativeDay } from '@/lib/workout/grouping';
import type { Workout, WorkoutSet } from '@/lib/types';

function durationMinutes(started: string, ended: string | null): string {
  if (!ended) return 'in progress';
  const ms = new Date(ended).getTime() - new Date(started).getTime();
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function WorkoutsJournalPage() {
  const router = useRouter();
  const exercises = useExerciseMap();
  const [repeating, setRepeating] = useState<string | null>(null);

  async function onRepeat(workoutId: string) {
    const open = await getOpenWorkout();
    if (open) {
      const proceed = window.confirm(
        'You have a workout in progress. Close it out and start this one?',
      );
      if (!proceed) return;
    }
    setRepeating(workoutId);
    await closeOpenWorkout();
    const id = await repeatWorkout(workoutId);
    router.push(`/workout/${id}`);
  }

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

  const rows = useMemo(() => {
    if (!workouts || !allSets) return [];
    const setsByWorkoutId = new Map<string, WorkoutSet[]>();
    for (const s of allSets) {
      const arr = setsByWorkoutId.get(s.workout_id);
      if (arr) arr.push(s);
      else setsByWorkoutId.set(s.workout_id, [s]);
    }
    return workouts.flatMap((w) => {
      const sets = setsByWorkoutId.get(w.id) ?? [];
      const exerciseCount = new Set(sets.map((s) => s.exercise_id)).size;
      if (sets.length === 0 || exerciseCount === 0) return [];
      const groups = exercises.size > 0 ? classifyWorkout(sets, exercises) : [];
      return [{ workout: w, sets, groups, exerciseCount }];
    });
  }, [workouts, allSets, exercises]);

  return (
    <>
      <TopNav />
      <main className="max-w-3xl mx-auto px-4 py-6 w-full">
        <h1 className="text-2xl font-semibold tracking-tight">Workout history</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Every session, newest first. Tap one to see the sets.
        </p>

        {rows.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-500">No workouts logged yet.</p>
        ) : (
          <ul className="mt-6 divide-y divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden">
            {rows.map(({ workout, sets, groups, exerciseCount }) => (
              <li key={workout.id} className="bg-zinc-900 hover:bg-zinc-800/60 transition flex items-stretch">
                <Link href={`/workout/${workout.id}`} className="flex-1 min-w-0 px-4 py-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium capitalize">{relativeDay(workout.started_at)}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {new Date(workout.started_at).toLocaleString()} · {durationMinutes(workout.started_at, workout.ended_at)}
                      </div>
                    </div>
                    <div className="text-xs text-zinc-400 tabular-nums whitespace-nowrap">
                      {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'} · {sets.length} {sets.length === 1 ? 'set' : 'sets'}
                    </div>
                  </div>
                  {groups.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {groups.map((g) => (
                        <span
                          key={g}
                          className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300"
                        >
                          {GROUP_LABEL[g] ?? g}
                        </span>
                      ))}
                    </div>
                  )}
                  {workout.notes && (
                    <p className="mt-2 text-xs text-zinc-400 italic truncate">{workout.notes}</p>
                  )}
                </Link>
                <button
                  type="button"
                  onClick={() => void onRepeat(workout.id)}
                  disabled={repeating != null}
                  title="Start a new workout with these exercises"
                  className="shrink-0 self-center mr-3 rounded-md border border-zinc-700 hover:border-indigo-500 hover:text-indigo-300 disabled:opacity-40 px-3 py-1.5 text-xs text-zinc-400"
                >
                  {repeating === workout.id ? 'Starting…' : 'Repeat'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
