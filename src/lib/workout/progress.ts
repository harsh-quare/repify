import type { Exercise, Workout, WorkoutSet } from '@/lib/types';
import { exerciseHitsVolumeView, type VolumeView } from '@/lib/workout/grouping';

// Epley: 1RM ≈ w × (1 + reps/30). One-rep sets are the weight itself.
export function epleyE1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export function formatKg(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function isScoredSet(s: WorkoutSet): boolean {
  return s.weight_kg != null && s.reps != null && s.weight_kg > 0 && s.reps > 0;
}

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dateKeyFromIso(iso: string): string {
  return dateKey(new Date(iso));
}

export function mondayOnOrBefore(d: Date): Date {
  const start = startOfLocalDay(d);
  const day = start.getDay();
  const back = day === 0 ? 6 : day - 1;
  const monday = new Date(start);
  monday.setDate(start.getDate() - back);
  return monday;
}

export function formatChartDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export type SessionPoint = {
  workoutId: string;
  at: string;
  label: string;
  topWeight: number;
  volume: number;
  e1rm: number;
};

export function sessionPoints(sets: WorkoutSet[]): SessionPoint[] {
  const byWorkout = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    if (!isScoredSet(s)) continue;
    const arr = byWorkout.get(s.workout_id);
    if (arr) arr.push(s);
    else byWorkout.set(s.workout_id, [s]);
  }

  const points: SessionPoint[] = [];
  for (const [workoutId, group] of byWorkout) {
    const at = group.reduce((earliest, s) =>
      s.completed_at < earliest ? s.completed_at : earliest,
    group[0].completed_at);
    points.push({
      workoutId,
      at,
      label: formatChartDate(at),
      topWeight: Math.max(...group.map((s) => s.weight_kg!)),
      volume: group.reduce((sum, s) => sum + s.weight_kg! * s.reps!, 0),
      e1rm: Math.max(...group.map((s) => epleyE1RM(s.weight_kg!, s.reps!))),
    });
  }
  points.sort((a, b) => a.at.localeCompare(b.at));
  return points;
}

export type PersonalRecords = {
  heaviestKg: number | null;
  heaviestReps: number | null;
  bestSetKg: number | null;
  bestSetReps: number | null;
  bestSessionVolume: number | null;
  e1rm: number | null;
};

export function personalRecords(sets: WorkoutSet[]): PersonalRecords {
  const scored = sets.filter(isScoredSet);
  if (scored.length === 0) {
    return {
      heaviestKg: null,
      heaviestReps: null,
      bestSetKg: null,
      bestSetReps: null,
      bestSessionVolume: null,
      e1rm: null,
    };
  }

  const heaviest = scored.reduce((best, s) =>
    s.weight_kg! > best.weight_kg! ? s : best,
  scored[0]);
  const bestSet = scored.reduce((best, s) =>
    s.weight_kg! * s.reps! > best.weight_kg! * best.reps! ? s : best,
  scored[0]);
  const points = sessionPoints(scored);
  const bestSessionVolume = Math.max(...points.map((p) => p.volume));
  const e1rm = Math.max(...scored.map((s) => epleyE1RM(s.weight_kg!, s.reps!)));

  return {
    heaviestKg: heaviest.weight_kg,
    heaviestReps: heaviest.reps,
    bestSetKg: bestSet.weight_kg,
    bestSetReps: bestSet.reps,
    bestSessionVolume,
    e1rm,
  };
}

export type NewPr = {
  kind: 'heaviest' | 'best_set' | 'best_session' | 'rep_max';
  label: string;
};

export function detectNewPrs(
  prior: WorkoutSet[],
  incoming: WorkoutSet,
  // Formats a canonical kg value for display; callers pass a unit-aware one.
  fmt: (kg: number) => string = (kg) => `${formatKg(kg)}kg`,
): NewPr[] {
  if (!isScoredSet(incoming)) return [];
  const w = incoming.weight_kg!;
  const r = incoming.reps!;
  const vol = w * r;
  const scored = prior.filter(isScoredSet);
  if (scored.length === 0) {
    return [{ kind: 'heaviest', label: `heaviest ${fmt(w)}` }];
  }

  const out: NewPr[] = [];

  const maxW = scored.reduce((m, s) => Math.max(m, s.weight_kg!), 0);
  const isHeaviest = w > maxW;
  if (isHeaviest) out.push({ kind: 'heaviest', label: `heaviest ${fmt(w)}` });

  const maxSetVol = scored.reduce((m, s) => Math.max(m, s.weight_kg! * s.reps!), 0);
  if (vol > maxSetVol) {
    out.push({ kind: 'best_set', label: `best set ${fmt(w)} × ${r}` });
  }

  if (!isHeaviest) {
    const maxAtReps = scored
      .filter((s) => s.reps === r)
      .reduce((m, s) => Math.max(m, s.weight_kg!), 0);
    if (w > maxAtReps) {
      out.push({ kind: 'rep_max', label: `best ${r}-rep ${fmt(w)}` });
    }
  }

  const volumeByWorkout = new Map<string, number>();
  for (const s of scored) {
    volumeByWorkout.set(
      s.workout_id,
      (volumeByWorkout.get(s.workout_id) ?? 0) + s.weight_kg! * s.reps!,
    );
  }
  const thisPriorVol = volumeByWorkout.get(incoming.workout_id) ?? 0;
  let bestOther = 0;
  for (const [wid, v] of volumeByWorkout) {
    if (wid !== incoming.workout_id) bestOther = Math.max(bestOther, v);
  }
  const thisVol = thisPriorVol + vol;
  if (bestOther > 0 && thisPriorVol <= bestOther && thisVol > bestOther) {
    out.push({ kind: 'best_session', label: `best session ${fmt(thisVol)}` });
  }

  return out;
}

export type WeekVolume = {
  weekStart: string;
  label: string;
  volume: number;
  reps: number;
};

export const WEEK_RANGES = [12, 24, 48] as const;
export type WeekRange = (typeof WEEK_RANGES)[number];

function weeklySeries(
  workouts: Workout[],
  sets: WorkoutSet[],
  weekCount: number,
  include: (s: WorkoutSet) => boolean,
  now: Date,
): WeekVolume[] {
  const startedById = new Map(workouts.map((w) => [w.id, w.started_at]));
  const thisMonday = mondayOnOrBefore(now);
  const byWeek = new Map<string, { volume: number; reps: number }>();
  for (const s of sets) {
    if (!isScoredSet(s) || !include(s)) continue;
    const when = startedById.get(s.workout_id) ?? s.completed_at;
    const monday = mondayOnOrBefore(new Date(when));
    const key = dateKey(monday);
    const entry = byWeek.get(key) ?? { volume: 0, reps: 0 };
    entry.volume += s.weight_kg! * s.reps!;
    entry.reps += s.reps!;
    byWeek.set(key, entry);
  }

  const weeks: WeekVolume[] = [];
  for (let i = weekCount - 1; i >= 0; i--) {
    const d = new Date(thisMonday);
    d.setDate(thisMonday.getDate() - i * 7);
    const key = dateKey(d);
    const entry = byWeek.get(key);
    weeks.push({
      weekStart: key,
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      volume: entry?.volume ?? 0,
      reps: entry?.reps ?? 0,
    });
  }
  return weeks;
}

export function weeklyVolume(
  workouts: Workout[],
  sets: WorkoutSet[],
  weekCount: number,
  now: Date = new Date(),
): WeekVolume[] {
  return weeklySeries(workouts, sets, weekCount, () => true, now);
}

export function weeklyVolumeForGroup(
  workouts: Workout[],
  sets: WorkoutSet[],
  exercises: Map<string, Exercise>,
  view: VolumeView,
  weekCount: number,
  now: Date = new Date(),
): WeekVolume[] {
  return weeklySeries(
    workouts,
    sets,
    weekCount,
    (s) => {
      const ex = exercises.get(s.exercise_id);
      return !!ex && exerciseHitsVolumeView(ex, view);
    },
    now,
  );
}

export type RecentLift = {
  exerciseId: string;
  lastAt: string;
  sessionCount: number;
  lastWeight: number | null;
  weights: number[];
};

export function recentLifts(sets: WorkoutSet[], limit = 8): RecentLift[] {
  const byExercise = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    const arr = byExercise.get(s.exercise_id);
    if (arr) arr.push(s);
    else byExercise.set(s.exercise_id, [s]);
  }
  const rows: RecentLift[] = [];
  for (const [exerciseId, group] of byExercise) {
    const points = sessionPoints(group);
    if (points.length === 0) continue;
    const last = points[points.length - 1];
    rows.push({
      exerciseId,
      lastAt: last.at,
      sessionCount: points.length,
      lastWeight: last.topWeight,
      weights: points.map((p) => p.topWeight),
    });
  }
  rows.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  return rows.slice(0, limit);
}

export type DayCell = {
  date: string;
  volume: number;
  workoutCount: number;
  inRange: boolean;
};

function addLocalDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(d.getDate() + n);
  return next;
}

/** Current year → last 365 days. Past year → 1 Jan–31 Dec of that year. */
export function yearCalendarRange(year: number, now: Date = new Date()): { start: Date; end: Date } {
  const today = startOfLocalDay(now);
  if (year === today.getFullYear()) {
    return { start: addLocalDays(today, -364), end: today };
  }
  return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) };
}

/** Current year plus every earlier year that has a workout, always including last year. */
export function calendarYearOptions(workouts: Workout[], now: Date = new Date()): number[] {
  const current = now.getFullYear();
  let oldest = current - 1;
  for (const w of workouts) {
    const y = new Date(w.started_at).getFullYear();
    if (Number.isFinite(y) && y < oldest) oldest = y;
  }
  const years: number[] = [];
  for (let y = current; y >= oldest; y--) years.push(y);
  return years;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type MonthBlock = {
  key: string;
  label: string;
  weeks: (DayCell | null)[][];
};

function volumeByDay(workouts: Workout[], sets: WorkoutSet[]) {
  const volumeByWorkout = new Map<string, number>();
  for (const s of sets) {
    if (!isScoredSet(s)) continue;
    volumeByWorkout.set(
      s.workout_id,
      (volumeByWorkout.get(s.workout_id) ?? 0) + s.weight_kg! * s.reps!,
    );
  }
  const withSets = new Set(sets.map((s) => s.workout_id));
  const byDay = new Map<string, { volume: number; workoutIds: Set<string> }>();
  for (const w of workouts) {
    if (!withSets.has(w.id)) continue;
    const key = dateKeyFromIso(w.started_at);
    const entry = byDay.get(key) ?? { volume: 0, workoutIds: new Set() };
    entry.workoutIds.add(w.id);
    entry.volume += volumeByWorkout.get(w.id) ?? 0;
    byDay.set(key, entry);
  }
  return byDay;
}

/** One block per month, weeks split so a month change skips a column (LeetCode-style). */
export function trainingMonthBlocks(
  workouts: Workout[],
  sets: WorkoutSet[],
  year: number,
  now: Date = new Date(),
): MonthBlock[] {
  const byDay = volumeByDay(workouts, sets);
  const { start: rangeStart, end: rangeEnd } = yearCalendarRange(year, now);
  const rangeStartKey = dateKey(rangeStart);
  const rangeEndKey = dateKey(rangeEnd);

  const blocks: MonthBlock[] = [];
  let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  const lastMonthStart = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);

  while (cursor.getTime() <= lastMonthStart.getTime()) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 0);
    const from = monthStart < rangeStart ? rangeStart : monthStart;
    const to = monthEnd > rangeEnd ? rangeEnd : monthEnd;
    const gridStart = mondayOnOrBefore(from);
    const lastMonday = mondayOnOrBefore(to);
    const weekCount =
      Math.round((lastMonday.getTime() - gridStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;

    const weeks: (DayCell | null)[][] = [];
    for (let w = 0; w < weekCount; w++) {
      const week: (DayCell | null)[] = [];
      for (let d = 0; d < 7; d++) {
        const day = addLocalDays(gridStart, w * 7 + d);
        const key = dateKey(day);
        const inThisMonth = day.getMonth() === m && day.getFullYear() === y;
        const inRange = key >= rangeStartKey && key <= rangeEndKey;
        if (!inThisMonth || !inRange) {
          week.push(null);
          continue;
        }
        const entry = byDay.get(key);
        week.push({
          date: key,
          volume: entry?.volume ?? 0,
          workoutCount: entry?.workoutIds.size ?? 0,
          inRange: true,
        });
      }
      weeks.push(week);
    }

    blocks.push({
      key: `${y}-${String(m + 1).padStart(2, '0')}`,
      // Static labels: locale-dependent abbreviations ("Sep" vs "Sept")
      // differ between server and browser ICU and break hydration.
      label: MONTH_LABELS[m],
      weeks,
    });
    cursor = new Date(y, m + 1, 1);
  }
  return blocks;
}

export function calendarStats(blocks: MonthBlock[]): {
  trainedDays: number;
  maxStreak: number;
  workouts: number;
  maxVolume: number;
} {
  const days = blocks
    .flatMap((b) => b.weeks.flat())
    .filter((d): d is DayCell => d != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  let trainedDays = 0;
  let workouts = 0;
  let maxVolume = 0;
  let maxStreak = 0;
  let streak = 0;
  let prevKey: string | null = null;

  for (const d of days) {
    if (d.volume > maxVolume) maxVolume = d.volume;
    workouts += d.workoutCount;
    if (d.workoutCount > 0) {
      trainedDays += 1;
      if (prevKey) {
        const prev = new Date(`${prevKey}T00:00:00`);
        const cur = new Date(`${d.date}T00:00:00`);
        const gap = Math.round((cur.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));
        streak = gap === 1 ? streak + 1 : 1;
      } else {
        streak = 1;
      }
      if (streak > maxStreak) maxStreak = streak;
      prevKey = d.date;
    } else {
      streak = 0;
      prevKey = null;
    }
  }

  return { trainedDays, maxStreak, workouts, maxVolume };
}

export type HistorySession = {
  workoutId: string;
  at: string;
  sets: WorkoutSet[];
};

export function historySessions(sets: WorkoutSet[]): HistorySession[] {
  const byWorkout = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    const arr = byWorkout.get(s.workout_id);
    if (arr) arr.push(s);
    else byWorkout.set(s.workout_id, [s]);
  }
  const sessions: HistorySession[] = [];
  for (const [workoutId, group] of byWorkout) {
    group.sort((a, b) => a.set_number - b.set_number);
    const at = group.reduce((earliest, s) =>
      s.completed_at < earliest ? s.completed_at : earliest,
    group[0].completed_at);
    sessions.push({ workoutId, at, sets: group });
  }
  sessions.sort((a, b) => b.at.localeCompare(a.at));
  return sessions;
}
