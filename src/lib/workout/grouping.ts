import type { Exercise, Workout, WorkoutSet } from '@/lib/types';

// Canonical muscle groups for recency + volume.
// Back/legs stay rolled up; biceps and triceps stay separate (people program them apart).
export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'legs',
  'core',
  'other',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const GROUP_LABEL: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  legs: 'Legs',
  core: 'Core',
  other: 'Other',
};

/** Anatomical groups plus common splits. Custom splits stay as muscle picks. */
export type VolumeView = MuscleGroup | 'all' | 'push' | 'pull';

export const VOLUME_VIEWS: { id: VolumeView; label: string; section: 'scope' | 'muscle' | 'split' }[] = [
  { id: 'all', label: 'Overall', section: 'scope' },
  ...MUSCLE_GROUPS.filter((g) => g !== 'other').map((id) => ({
    id,
    label: GROUP_LABEL[id],
    section: 'muscle' as const,
  })),
  { id: 'push', label: 'Push', section: 'split' },
  { id: 'pull', label: 'Pull', section: 'split' },
  { id: 'other', label: GROUP_LABEL.other, section: 'muscle' },
];

export function volumeViewLabel(view: VolumeView): string {
  return VOLUME_VIEWS.find((v) => v.id === view)?.label ?? view;
}

// Maps a Free Exercise DB primary muscle to its canonical group.
// Unknown muscles bucket to 'other' rather than throwing — the dataset may grow.
const MUSCLE_TO_GROUP: Record<string, MuscleGroup> = {
  chest: 'chest',

  lats: 'back',
  'middle back': 'back',
  'lower back': 'back',
  traps: 'back',
  neck: 'back',

  shoulders: 'shoulders',

  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'other',

  quadriceps: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
  adductors: 'legs',
  abductors: 'legs',

  abdominals: 'core',
};

export function muscleGroupFor(muscle: string): MuscleGroup {
  return MUSCLE_TO_GROUP[muscle.toLowerCase()] ?? 'other';
}

export function exerciseHitsVolumeView(exercise: Exercise, view: VolumeView): boolean {
  if (view === 'all') return true;
  const groups = new Set(exercise.primary_muscles.map((m) => muscleGroupFor(m)));
  if (view === 'push') {
    return groups.has('chest') || groups.has('shoulders') || groups.has('triceps');
  }
  if (view === 'pull') {
    return groups.has('back') || groups.has('biceps');
  }
  return groups.has(view);
}

// Classifies one workout into the muscle groups its logged sets touched,
// ordered by how many sets hit each group (most-trained first).
// A pull day (lats + biceps) returns ['back', 'biceps']; legs day returns ['legs'].
export function classifyWorkout(
  sets: WorkoutSet[],
  exercises: Map<string, Exercise>,
): MuscleGroup[] {
  const countByGroup = new Map<MuscleGroup, number>();
  for (const s of sets) {
    const ex = exercises.get(s.exercise_id);
    if (!ex) continue;
    for (const m of ex.primary_muscles) {
      const g = muscleGroupFor(m);
      countByGroup.set(g, (countByGroup.get(g) ?? 0) + 1);
    }
  }
  return [...countByGroup.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([g]) => g);
}

export type WorkoutWithSets = {
  workout: Workout;
  sets: WorkoutSet[];
  groups: MuscleGroup[];
};

// For each canonical group, returns the most recent completed workout that touched it.
// Returns a Map so callers can iterate MUSCLE_GROUPS in display order and
// distinguish "not trained yet" (missing key) from "trained" (present).
export function lastWorkoutByMuscleGroup(
  workouts: Workout[],
  setsByWorkoutId: Map<string, WorkoutSet[]>,
  exercises: Map<string, Exercise>,
): Map<MuscleGroup, WorkoutWithSets> {
  // Sort completed workouts newest-first; first hit per group wins.
  const completed = workouts
    .filter((w) => !!w.ended_at)
    .sort((a, b) => b.started_at.localeCompare(a.started_at));

  const result = new Map<MuscleGroup, WorkoutWithSets>();
  for (const workout of completed) {
    const sets = setsByWorkoutId.get(workout.id) ?? [];
    if (sets.length === 0) continue;
    const groups = classifyWorkout(sets, exercises);
    for (const g of groups) {
      if (!result.has(g)) {
        result.set(g, { workout, sets, groups });
      }
    }
    if (result.size === MUSCLE_GROUPS.length) break;
  }
  return result;
}

// "started 34 min ago" / "started 2h ago" — for in-progress workout banners.
export function timeAgo(iso: string, now: Date = new Date()): string {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ${mins % 60}m ago`;
  return relativeDay(iso, now);
}

// Human-friendly relative date label. Local time, so "today" is the user's today.
export function relativeDay(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const oneDay = 24 * 60 * 60 * 1000;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfThen = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime();
  const days = Math.round((startOfToday - startOfThen) / oneDay);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return then.toLocaleDateString();
}
