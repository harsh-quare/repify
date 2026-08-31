'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopNav } from '@/components/TopNav';
import {
  useExerciseList,
  useExerciseMap,
  useRecentExercises,
  useRoutineLastDone,
  useRoutines,
} from '@/lib/db/hooks';
import { createRoutine, deleteRoutine, startRoutine, updateRoutine } from '@/lib/workout/routines';
import { relativeDay } from '@/lib/workout/grouping';
import type { Exercise, Routine } from '@/lib/types';

function RoutineEditor({
  initial,
  onDone,
}: {
  initial: Routine | null;
  onDone: () => void;
}) {
  const allExercises = useExerciseList();
  const exerciseMap = useExerciseMap();
  const recents = useRecentExercises(12);
  const [name, setName] = useState(initial?.name ?? '');
  const [ids, setIds] = useState<string[]>(initial?.exercise_ids ?? []);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const suggestions = useMemo(() => {
    const pool = search
      ? allExercises.filter((e) => e.name.toLowerCase().includes(search.toLowerCase())).slice(0, 20)
      : recents;
    return pool.filter((e) => !ids.includes(e.id));
  }, [search, allExercises, recents, ids]);

  function move(index: number, delta: number) {
    setIds((cur) => {
      const next = [...cur];
      const target = index + delta;
      if (target < 0 || target >= next.length) return cur;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function onSave() {
    if (!name.trim() || ids.length === 0) return;
    setSaving(true);
    if (initial) await updateRoutine(initial.id, { name: name.trim(), exercise_ids: ids });
    else await createRoutine(name, ids);
    onDone();
  }

  return (
    <div className="rounded-2xl border border-indigo-700 bg-zinc-900 p-4 space-y-4">
      <div>
        <label htmlFor="routine-name" className="block text-xs uppercase tracking-wider text-zinc-400 mb-1">
          Routine name
        </label>
        <input
          id="routine-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Upper, Push, Legs + Shoulders"
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm"
        />
      </div>

      {ids.length > 0 && (
        <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded-lg overflow-hidden">
          {ids.map((id, i) => {
            const ex = exerciseMap.get(id);
            return (
              <li key={id} className="flex items-center gap-2 px-3 py-2 text-sm bg-zinc-900">
                <span className="text-zinc-500 tabular-nums w-5">{i + 1}.</span>
                <span className="flex-1 min-w-0 truncate">{ex?.name ?? id}</span>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${ex?.name ?? 'exercise'} up`} className="text-zinc-400 hover:text-zinc-200 disabled:opacity-30 px-1">↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === ids.length - 1} aria-label={`Move ${ex?.name ?? 'exercise'} down`} className="text-zinc-400 hover:text-zinc-200 disabled:opacity-30 px-1">↓</button>
                <button type="button" onClick={() => setIds((cur) => cur.filter((x) => x !== id))} aria-label={`Remove ${ex?.name ?? 'exercise'}`} className="text-zinc-500 hover:text-rose-300 px-1">✕</button>
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Add exercises…"
          aria-label="Search exercises to add"
          className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm"
        />
        {!search && suggestions.length > 0 && (
          <div className="mt-2 text-xs uppercase tracking-wider text-zinc-500">Recent</div>
        )}
        <div className="mt-1 max-h-56 overflow-auto divide-y divide-zinc-800">
          {suggestions.map((e: Exercise) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setIds((cur) => [...cur, e.id])}
              className="w-full text-left px-2 py-2 text-sm hover:bg-zinc-800 rounded"
            >
              <div>{e.name}</div>
              <div className="text-xs text-zinc-500 capitalize">{e.primary_muscles[0]} · {e.equipment}</div>
            </button>
          ))}
          {suggestions.length === 0 && search && (
            <div className="px-2 py-2 text-sm text-zinc-500">No matches</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving || !name.trim() || ids.length === 0}
          className="rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium"
        >
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Create routine'}
        </button>
        <button type="button" onClick={onDone} className="text-sm text-zinc-400 hover:text-zinc-200 px-2">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function RoutinesPage() {
  const router = useRouter();
  const routines = useRoutines();
  const lastDone = useRoutineLastDone();
  const exerciseMap = useExerciseMap();
  const [editing, setEditing] = useState<Routine | null>(null);
  const [creating, setCreating] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  async function onStart(r: Routine) {
    setStartingId(r.id);
    const id = await startRoutine(r);
    router.push(`/workout/${id}`);
  }

  return (
    <>
      <TopNav />
      <main className="max-w-3xl mx-auto px-4 py-6 w-full">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Routines</h1>
            <p className="text-sm text-zinc-400 mt-1">Your split, your way — each routine is a day you can start in one tap.</p>
          </div>
          {!creating && !editing && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="rounded-md bg-indigo-500 hover:bg-indigo-400 px-3 py-1.5 text-sm font-medium"
            >
              + New routine
            </button>
          )}
        </div>

        <div className="mt-6 space-y-4">
          {(creating || editing) && (
            <RoutineEditor
              initial={editing}
              onDone={() => {
                setCreating(false);
                setEditing(null);
              }}
            />
          )}

          {routines.length === 0 && !creating && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-400">
              No routines yet. Create one here, or open a past workout and tap
              “Save as routine” — your best routine is a day you already trained.
            </div>
          )}

          {routines.map((r) => {
            const last = lastDone.get(r.id);
            const preview = r.exercise_ids
              .slice(0, 4)
              .map((id) => exerciseMap.get(id)?.name)
              .filter(Boolean)
              .join(' · ');
            return (
              <div key={r.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {r.exercise_ids.length} {r.exercise_ids.length === 1 ? 'exercise' : 'exercises'}
                      {' · '}
                      {last ? `last done ${relativeDay(last)}` : 'not done yet'}
                    </div>
                    {preview && (
                      <div className="text-xs text-zinc-400 mt-1 truncate">
                        {preview}
                        {r.exercise_ids.length > 4 ? ' · …' : ''}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => void onStart(r)}
                      disabled={startingId != null}
                      className="rounded-md bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 px-3 py-1.5 text-sm font-medium"
                    >
                      {startingId === r.id ? 'Starting…' : 'Start'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreating(false);
                        setEditing(r);
                      }}
                      className="rounded-md border border-zinc-700 hover:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete routine "${r.name}"? Past workouts stay.`)) {
                          void deleteRoutine(r.id);
                        }
                      }}
                      aria-label={`Delete routine ${r.name}`}
                      className="rounded-md border border-zinc-700 hover:border-rose-500 hover:text-rose-300 px-3 py-1.5 text-sm text-zinc-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
