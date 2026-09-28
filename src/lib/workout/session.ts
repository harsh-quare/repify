import type { Workout } from '@/lib/types';
import { dateKey, mondayOnOrBefore } from '@/lib/workout/progress';

/** ACSM-style moderate resistance training. A guess without heart rate. */
export const LIFTING_MET = 5;

export function elapsedMs(startedAt: string, endedAt: string | null, nowMs: number = Date.now()): number {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : nowMs;
  return Math.max(0, end - start);
}

/** Live clock: 51:07 or 1:02:03 after an hour. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Ended session label: 48 min, 1h 12m. */
export function formatDurationLabel(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return 'in progress';
  const mins = Math.max(1, Math.round(elapsedMs(startedAt, endedAt) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function estimateKcal(weightKg: number, durationMs: number): number {
  const hours = durationMs / 3_600_000;
  if (!(weightKg > 0) || hours <= 0) return 0;
  return Math.round(LIFTING_MET * weightKg * hours);
}

export function workoutKcal(
  workout: Workout,
  weightKg: number | null,
  nowMs: number = Date.now(),
): number | null {
  if (workout.calories_kcal != null) return workout.calories_kcal;
  if (weightKg == null || !(weightKg > 0)) return null;
  const kcal = estimateKcal(weightKg, elapsedMs(workout.started_at, workout.ended_at, nowMs));
  return kcal > 0 ? kcal : null;
}

export type WeekKcal = { weekStart: string; label: string; kcal: number };

export function weeklyCalories(
  workouts: Workout[],
  weekCount: number,
  weightKg: number | null,
  now: Date = new Date(),
): WeekKcal[] {
  const thisMonday = mondayOnOrBefore(now);
  const byWeek = new Map<string, number>();
  for (const w of workouts) {
    if (w.ended_at == null) continue;
    const kcal = workoutKcal(w, weightKg);
    if (kcal == null || kcal <= 0) continue;
    const monday = mondayOnOrBefore(new Date(w.started_at));
    const key = dateKey(monday);
    byWeek.set(key, (byWeek.get(key) ?? 0) + kcal);
  }
  const weeks: WeekKcal[] = [];
  for (let i = weekCount - 1; i >= 0; i--) {
    const d = new Date(thisMonday);
    d.setDate(thisMonday.getDate() - i * 7);
    const key = dateKey(d);
    weeks.push({
      weekStart: key,
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      kcal: byWeek.get(key) ?? 0,
    });
  }
  return weeks;
}
