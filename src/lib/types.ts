// Shared row types — matched 1:1 with Supabase schema and the Dexie mirror.

export type UnitPreference = 'metric' | 'imperial';

export type Profile = {
  user_id: string;
  height_cm: number | null;
  unit_preference: UnitPreference;
  display_name: string | null;
  rest_timer_seconds: number;
  created_at: string;
  updated_at: string;
};

export type Exercise = {
  id: string;
  name: string;
  category: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: string | null;
  level: string | null;
  mechanic: string | null;
  force: string | null;
  instructions: string[];
  image_urls: string[];
  updated_at: string;
};

export type Workout = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  routine_id?: string | null;
  updated_at: string;
};

// A user-defined split day: named, ordered exercise list.
export type Routine = {
  id: string;
  user_id: string;
  name: string;
  exercise_ids: string[];
  position: number;
  updated_at: string;
};

export type WorkoutSet = {
  id: string;
  workout_id: string;
  user_id: string;
  exercise_id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  completed_at: string;
  updated_at: string;
};

export type BodyWeightEntry = {
  id: string;
  user_id: string;
  weight_kg: number;
  logged_at: string;
  notes: string | null;
  updated_at: string;
};

// Local-only (never synced): the exercises a user planned for a session,
// so an in-progress workout survives tab close / reload.
export type WorkoutPlan = {
  workout_id: string;
  exercise_ids: string[];
};

export type SyncableTable = 'workouts' | 'workout_sets' | 'body_weight_log' | 'profiles' | 'routines';
export type SyncOp = 'upsert' | 'delete';

export type PendingWrite = {
  id?: number;
  table: SyncableTable;
  row_id: string;
  op: SyncOp;
  payload: unknown;
  queued_at: string;
};
