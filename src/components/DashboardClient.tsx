'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie';
import { useProfile, useRoutineLastDone, useRoutines } from '@/lib/db/hooks';
import { startRoutine } from '@/lib/workout/routines';
import { MuscleGroupRecencyGrid } from '@/components/MuscleGroupRecencyGrid';
import { RecentLifts } from '@/components/RecentLifts';
import { TrainingOverview } from '@/components/TrainingOverview';
import { endWorkout, getOpenWorkout, repeatWorkout } from '@/lib/workout/actions';
import {
  GROUP_LABEL,
  type MuscleGroup,
  classifyWorkout,
  relativeDay,
  timeAgo,
} from '@/lib/workout/grouping';
import { formatWeightWithUnit } from '@/lib/units';
import type { BodyWeightEntry, Workout } from '@/lib/types';

export function DashboardClient() {
  const router = useRouter();
  const profile = useProfile();
  const unit = profile?.unit_preference ?? 'metric';
  const [repeating, setRepeating] = useState(false);

  const latestWeight = useLiveQuery(
    () => db().body_weight_log.orderBy('logged_at').last(),
    [],
  ) as BodyWeightEntry | undefined;
  // Open session plus enough context to spot one that was never ended.
  const openInfo = useLiveQuery(async () => {
    const workout = await getOpenWorkout();
    if (!workout) return null;
    const sets = await db().workout_sets.where('workout_id').equals(workout.id).toArray();
    let lastSetAt: string | null = null;
    for (const s of sets) {
      if (!lastSetAt || s.completed_at > lastSetAt) lastSetAt = s.completed_at;
    }
    return { workout, setCount: sets.length, lastSetAt };
  }, []);
  const openWorkout = openInfo?.workout;
  const setCount = useLiveQuery(() => db().workout_sets.count(), []);

  const STALE_MS = 6 * 60 * 60 * 1000;
  const staleOpen =
    openInfo != null &&
    openInfo.setCount > 0 &&
    openInfo.lastSetAt != null &&
    Date.now() - new Date(openInfo.lastSetAt).getTime() > STALE_MS
      ? openInfo
      : null;

  async function onEndForgotten() {
    if (!staleOpen?.lastSetAt) return;
    // End it at the last set's time so the recorded duration is truthful.
    await endWorkout(staleOpen.workout.id, staleOpen.lastSetAt);
  }

  // Recent distinct workout TYPES (by muscle-group signature), not just the
  // latest session — on a split, "yesterday's workout" is the one workout you
  // should NOT repeat today. Most-stale first, so the day you're due for
  // leads. No assumptions about cycle length or weekday alignment.
  const repeatOptions = useLiveQuery(
    async (): Promise<{ workout: Workout; groups: MuscleGroup[] }[]> => {
      const [workouts, allSets, exerciseRows] = await Promise.all([
        db().workouts.orderBy('started_at').reverse().toArray(),
        db().workout_sets.toArray(),
        db().exercises.toArray(),
      ]);
      const exercises = new Map(exerciseRows.map((e) => [e.id, e]));
      const setsByWorkout = new Map<string, typeof allSets>();
      for (const s of allSets) {
        const arr = setsByWorkout.get(s.workout_id);
        if (arr) arr.push(s);
        else setsByWorkout.set(s.workout_id, [s]);
      }
      const seen = new Set<string>();
      const options: { workout: Workout; groups: MuscleGroup[] }[] = [];
      for (const w of workouts) {
        if (!w.ended_at) continue;
        const sets = setsByWorkout.get(w.id) ?? [];
        if (sets.length === 0) continue;
        const groups = classifyWorkout(sets, exercises);
        if (groups.length === 0) continue;
        // Signature on the two dominant groups so a stray core set doesn't
        // make "push day" look like a new type.
        const sig = groups.slice(0, 2).join('+');
        if (seen.has(sig)) continue;
        seen.add(sig);
        options.push({ workout: w, groups });
        if (options.length === 3) break;
      }
      options.sort((a, b) => a.workout.started_at.localeCompare(b.workout.started_at));
      return options;
    },
    [],
  );

  async function onRepeat(workoutId: string) {
    setRepeating(true);
    const id = await repeatWorkout(workoutId);
    router.push(`/workout/${id}`);
  }

  // Declared split beats inferred split: once routines exist they replace the
  // auto-detected chips. Most-stale first — the day you're due for leads.
  const routines = useRoutines();
  const lastDone = useRoutineLastDone();
  const routinesByStaleness = [...routines].sort(
    (a, b) => (lastDone.get(a.id) ?? '').localeCompare(lastDone.get(b.id) ?? ''),
  );

  async function onStartRoutine(routineId: string) {
    const routine = routines.find((r) => r.id === routineId);
    if (!routine) return;
    setRepeating(true);
    const id = await startRoutine(routine);
    router.push(`/workout/${id}`);
  }

  const greeting = profile?.display_name
    ? `Hey ${profile.display_name}, ready to lift?`
    : 'Hey, ready to lift?';

  // First run: nothing logged yet, nothing in progress — one clear path,
  // no wall of empty analytics.
  if (setCount === 0 && !openWorkout) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">{greeting}</h1>

        <div className="rounded-2xl border border-indigo-500 bg-indigo-500/10 p-6">
          <div className="text-xs uppercase tracking-wider text-indigo-300">First workout</div>
          <div className="text-2xl font-semibold mt-1">Log your first workout</div>
          <p className="text-sm text-zinc-400 mt-2 max-w-md">
            Takes 30 seconds: pick an exercise, log a set. From then on Repify shows you
            last time&apos;s numbers, tracks PRs, and charts your progress.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/workout/new"
              className="rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white px-5 py-2 text-sm font-medium"
            >
              Start a workout
            </Link>
            <Link href="/exercises" className="text-sm text-indigo-400 hover:text-indigo-300">
              Browse the exercise library →
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-400">Body weight</div>
          <div className="text-xl font-semibold mt-1">
            {latestWeight ? formatWeightWithUnit(latestWeight.weight_kg, unit) : 'No log yet'}
          </div>
          <Link href="/body" className="mt-2 inline-block text-sm text-indigo-400 hover:text-indigo-300">
            Log weight →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">{greeting}</h1>

      <div className="grid sm:grid-cols-2 gap-4">
        {staleOpen ? (
          <div className="rounded-2xl border border-amber-700/60 bg-amber-950/30 p-5">
            <div className="text-xs uppercase tracking-wider text-amber-300">Unfinished</div>
            <div className="text-xl font-semibold mt-1">Forgot to end this workout?</div>
            <div className="text-sm text-zinc-400 mt-2">
              Started {relativeDay(staleOpen.workout.started_at)} · last set {timeAgo(staleOpen.lastSetAt!)} ·{' '}
              {staleOpen.setCount} {staleOpen.setCount === 1 ? 'set' : 'sets'}.
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void onEndForgotten()}
                className="rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 text-sm font-medium"
              >
                End workout
              </button>
              <Link href={`/workout/${staleOpen.workout.id}`} className="text-sm text-indigo-400 hover:text-indigo-300">
                Resume instead →
              </Link>
            </div>
          </div>
        ) : openWorkout ? (
          <Link href={`/workout/${openWorkout.id}`} className="rounded-2xl border border-indigo-500 bg-indigo-500/10 p-5 hover:bg-indigo-500/20 transition">
            <div className="text-xs uppercase tracking-wider text-indigo-300">In progress</div>
            <div className="text-xl font-semibold mt-1">Resume workout →</div>
            <div className="text-sm text-zinc-400 mt-2">Started {timeAgo(openWorkout.started_at)}.</div>
          </Link>
        ) : (
          <div className="rounded-2xl border border-indigo-500 bg-indigo-500/10 p-5">
            <div className="text-xs uppercase tracking-wider text-indigo-300">Start</div>
            <Link href="/workout/new" className="block text-xl font-semibold mt-1 hover:text-indigo-300">
              New workout →
            </Link>
            <div className="text-sm text-zinc-400 mt-2">Pick exercises and start logging sets.</div>
            {routinesByStaleness.length > 0 ? (
              <div className="mt-3">
                <div className="text-xs uppercase tracking-wider text-zinc-500">Your split</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {routinesByStaleness.map((r) => {
                    const last = lastDone.get(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => void onStartRoutine(r.id)}
                        disabled={repeating}
                        className="text-xs rounded-md border border-indigo-700 bg-indigo-500/10 hover:bg-indigo-500/20 disabled:opacity-50 px-2 py-1 text-indigo-300"
                      >
                        {r.name} · {last ? relativeDay(last) : 'new'}
                      </button>
                    );
                  })}
                </div>
                <Link href="/routines" className="mt-2 inline-block text-xs text-zinc-500 hover:text-zinc-300">
                  Manage routines →
                </Link>
              </div>
            ) : repeatOptions && repeatOptions.length > 0 ? (
              <div className="mt-3">
                <div className="text-xs uppercase tracking-wider text-zinc-500">Repeat a recent day</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {repeatOptions.map(({ workout: w, groups }) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => void onRepeat(w.id)}
                      disabled={repeating}
                      className="text-xs rounded-md border border-indigo-700 bg-indigo-500/10 hover:bg-indigo-500/20 disabled:opacity-50 px-2 py-1 text-indigo-300"
                    >
                      {groups.slice(0, 2).map((g) => GROUP_LABEL[g]).join(' + ')} · {relativeDay(w.started_at)}
                    </button>
                  ))}
                </div>
                <Link href="/routines" className="mt-2 inline-block text-xs text-zinc-500 hover:text-zinc-300">
                  Create routines for your split →
                </Link>
              </div>
            ) : null}
          </div>
        )}

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-400">Body weight</div>
          <div className="text-xl font-semibold mt-1">
            {latestWeight ? formatWeightWithUnit(latestWeight.weight_kg, unit) : 'No log yet'}
          </div>
          <Link href="/body" className="mt-2 inline-block text-sm text-indigo-400 hover:text-indigo-300">
            Log weight →
          </Link>
        </div>
      </div>

      <TrainingOverview />

      <RecentLifts />

      <MuscleGroupRecencyGrid />
    </div>
  );
}
