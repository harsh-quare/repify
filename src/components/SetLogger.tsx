'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie';
import { useUnit } from '@/lib/db/hooks';
import { SET_LOGGED_EVENT } from '@/components/RestTimer';
import { PR_EVENT } from '@/components/PrToast';
import { deleteSet, lastSessionSets, logSet, updateSet } from '@/lib/workout/actions';
import { detectNewPrs, type NewPr } from '@/lib/workout/progress';
import { formatWeight, fromDisplayWeight, toDisplayWeight, weightUnitLabel } from '@/lib/units';
import type { Exercise, WorkoutSet } from '@/lib/types';

// Parses user input in the user's display unit; weight is NOT yet kg.
function parsePositive(weight: string, reps: string): { weight: number; reps: number } | null {
  const w = parseFloat(weight);
  const r = parseInt(reps, 10);
  if (!Number.isFinite(w) || w <= 0) return null;
  if (!Number.isFinite(r) || r <= 0) return null;
  return { weight: w, reps: r };
}

export function SetLogger({ workoutId, exercise }: { workoutId: string; exercise: Exercise }) {
  const unit = useUnit();
  const unitLabel = weightUnitLabel(unit);
  const [lastSets, setLastSets] = useState<WorkoutSet[]>([]);

  useEffect(() => {
    void lastSessionSets(exercise.id, workoutId).then(setLastSets);
  }, [exercise.id, workoutId]);

  const currentSets = useLiveQuery(
    () => db().workout_sets.where({ workout_id: workoutId, exercise_id: exercise.id }).sortBy('set_number'),
    [workoutId, exercise.id],
    [] as WorkoutSet[],
  );

  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [prs, setPrs] = useState<NewPr[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState('');
  const [editReps, setEditReps] = useState('');

  const nextSet = (currentSets?.length ?? 0) + 1;
  const canLog = parsePositive(weight, reps) != null;
  const canSaveEdit = parsePositive(editWeight, editReps) != null;

  const prefillRef = lastSets[nextSet - 1];

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parsePositive(weight, reps);
    if (!parsed) return;
    const prior = await db().workout_sets.where('exercise_id').equals(exercise.id).toArray();
    const saved = await logSet({
      workoutId,
      exerciseId: exercise.id,
      setNumber: nextSet,
      weightKg: fromDisplayWeight(parsed.weight, unit),
      reps: parsed.reps,
    });
    const newPrs = detectNewPrs(prior, saved, (kg) => `${formatWeight(kg, unit)}${unitLabel}`);
    setPrs(newPrs);
    setWeight('');
    setReps('');
    window.dispatchEvent(new CustomEvent(SET_LOGGED_EVENT));
    if (newPrs.length > 0) {
      window.dispatchEvent(new CustomEvent(PR_EVENT, { detail: newPrs.map((p) => p.label) }));
    }
  }

  function startEdit(s: WorkoutSet) {
    setEditingId(s.id);
    setEditWeight(s.weight_kg != null ? String(toDisplayWeight(s.weight_kg, unit)) : '');
    setEditReps(s.reps != null ? String(s.reps) : '');
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const parsed = parsePositive(editWeight, editReps);
    if (!parsed) return;
    await updateSet(editingId, {
      weightKg: fromDisplayWeight(parsed.weight, unit),
      reps: parsed.reps,
    });
    setEditingId(null);
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-medium">{exercise.name}</h3>
        <div className="flex items-baseline gap-2 text-xs">
          <span className="text-zinc-500 capitalize">{exercise.primary_muscles[0]}</span>
          <Link
            href={`/exercises/${exercise.id}`}
            className="text-indigo-400 hover:text-indigo-300 whitespace-nowrap"
          >
            Full history →
          </Link>
        </div>
      </div>

      {lastSets.length > 0 && (
        <div className="mt-2 text-xs text-zinc-400">
          <span className="uppercase tracking-wider">Last time:</span>{' '}
          {lastSets.map((s, i) => (
            <span key={s.id} className="tabular-nums">
              {i > 0 && ', '}
              {s.weight_kg != null ? formatWeight(s.weight_kg, unit) : '–'}×{s.reps ?? '–'}
            </span>
          ))}
        </div>
      )}

      {prs.length > 0 && (
        <p className="mt-2 text-xs text-indigo-300">
          New PR: {prs.map((p) => p.label).join(' · ')}
        </p>
      )}

      {currentSets && currentSets.length > 0 && (
        <ul className="mt-3 space-y-1">
          {currentSets.map((s) => (
            <li key={s.id} className="text-sm">
              {editingId === s.id ? (
                <form onSubmit={onSaveEdit} className="flex items-center gap-2">
                  <span className="text-zinc-500 w-12 shrink-0">Set {s.set_number}</span>
                  <input
                    type="number"
                    step="0.5"
                    inputMode="decimal"
                    value={editWeight}
                    onChange={(e) => setEditWeight(e.target.value)}
                    aria-label={`Weight (${unitLabel})`}
                    className="w-20 rounded-md bg-zinc-800 border border-zinc-700 px-2 py-1 text-sm"
                  />
                  <span className="text-zinc-500">×</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={editReps}
                    onChange={(e) => setEditReps(e.target.value)}
                    aria-label="Reps"
                    className="w-20 rounded-md bg-zinc-800 border border-zinc-700 px-2 py-1 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!canSaveEdit}
                    className="ml-auto text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 w-12 shrink-0">Set {s.set_number}</span>
                  <span className="tabular-nums">
                    {s.weight_kg != null ? formatWeight(s.weight_kg, unit) : '–'}{unitLabel} × {s.reps ?? '–'}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(s)}
                    className="ml-auto text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteSet(s.id)}
                    className="text-xs text-rose-400 hover:text-rose-300"
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onAdd} className="mt-3 flex items-center gap-2">
        <span className="text-xs text-zinc-500 w-12">Set {nextSet}</span>
        <input
          type="number"
          step="0.5"
          inputMode="decimal"
          required
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder={prefillRef?.weight_kg != null ? String(toDisplayWeight(prefillRef.weight_kg, unit)) : unitLabel}
          aria-label={`Weight (${unitLabel})`}
          className="w-20 rounded-md bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-sm"
        />
        <span className="text-zinc-500">×</span>
        <input
          type="number"
          inputMode="numeric"
          required
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          placeholder={prefillRef?.reps != null ? String(prefillRef.reps) : 'reps'}
          aria-label="Reps"
          className="w-20 rounded-md bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={!canLog}
          className="ml-auto rounded-md bg-indigo-500 hover:bg-indigo-400 px-3 py-1.5 text-sm font-medium disabled:opacity-40 disabled:hover:bg-indigo-500"
        >
          Log
        </button>
      </form>
    </div>
  );
}
