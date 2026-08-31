'use client';

import { db } from '@/lib/db/dexie';
import { toDisplayWeight, weightUnitLabel } from '@/lib/units';
import type { UnitPreference } from '@/lib/types';

// CSV exports in the user's display unit; the weight column is named with the
// unit (weight_kg / weight_lbs) so the file stays unambiguous.

function csvCell(v: string | number | null | undefined): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

export async function buildSetsCsv(unit: UnitPreference): Promise<string> {
  const [sets, workouts, exercises] = await Promise.all([
    db().workout_sets.toArray(),
    db().workouts.toArray(),
    db().exercises.toArray(),
  ]);
  const workoutById = new Map(workouts.map((w) => [w.id, w]));
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  sets.sort(
    (a, b) => a.completed_at.localeCompare(b.completed_at) || a.set_number - b.set_number,
  );

  const rows: (string | number | null | undefined)[][] = [
    [
      'completed_at',
      'workout_started_at',
      'exercise',
      'set_number',
      `weight_${weightUnitLabel(unit)}`,
      'reps',
      'rpe',
      'workout_notes',
    ],
  ];
  for (const s of sets) {
    const w = workoutById.get(s.workout_id);
    rows.push([
      s.completed_at,
      w?.started_at ?? '',
      exerciseById.get(s.exercise_id)?.name ?? s.exercise_id,
      s.set_number,
      s.weight_kg != null ? toDisplayWeight(Number(s.weight_kg), unit) : '',
      s.reps,
      s.rpe,
      w?.notes ?? '',
    ]);
  }
  return toCsv(rows);
}

export async function buildBodyWeightCsv(unit: UnitPreference): Promise<string> {
  const entries = await db().body_weight_log.orderBy('logged_at').toArray();
  const rows: (string | number | null | undefined)[][] = [
    ['logged_at', `weight_${weightUnitLabel(unit)}`, 'notes'],
  ];
  for (const e of entries) {
    rows.push([e.logged_at, toDisplayWeight(Number(e.weight_kg), unit), e.notes]);
  }
  return toCsv(rows);
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
