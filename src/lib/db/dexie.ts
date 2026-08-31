import Dexie, { type Table } from 'dexie';
import type {
  BodyWeightEntry,
  Exercise,
  PendingWrite,
  Profile,
  Routine,
  Workout,
  WorkoutPlan,
  WorkoutSet,
} from '@/lib/types';

// Local cache mirroring Supabase. Source of truth is server; this is the offline buffer.
// Per-table sync_meta tracks the most recent updated_at we've pulled.
export type SyncMeta = {
  table: string;
  last_synced_at: string;
};

class RepifyDexie extends Dexie {
  profiles!: Table<Profile, string>;
  exercises!: Table<Exercise, string>;
  workouts!: Table<Workout, string>;
  workout_sets!: Table<WorkoutSet, string>;
  body_weight_log!: Table<BodyWeightEntry, string>;
  pending_writes!: Table<PendingWrite, number>;
  sync_meta!: Table<SyncMeta, string>;
  workout_plans!: Table<WorkoutPlan, string>;
  routines!: Table<Routine, string>;

  constructor() {
    super('repify');
    this.version(1).stores({
      profiles: 'user_id, updated_at',
      exercises: 'id, name, equipment, level, updated_at, *primary_muscles, *secondary_muscles',
      workouts: 'id, user_id, started_at, updated_at',
      workout_sets: 'id, workout_id, exercise_id, user_id, completed_at, updated_at, [user_id+exercise_id+completed_at]',
      body_weight_log: 'id, user_id, logged_at, updated_at',
      pending_writes: '++id, table, row_id, queued_at',
      sync_meta: 'table',
    });
    // v2: local-only plan table so an in-progress workout survives reloads.
    this.version(2).stores({
      workout_plans: 'workout_id',
    });
    // v3: user-defined split routines (synced).
    this.version(3).stores({
      routines: 'id, user_id, position, updated_at',
    });
  }
}

let _db: RepifyDexie | null = null;

export function db(): RepifyDexie {
  if (typeof window === 'undefined') {
    throw new Error('Dexie can only be used in the browser');
  }
  if (!_db) _db = new RepifyDexie();
  return _db;
}
