-- Repify Phase 1 schema
-- Tables: profiles, exercises, workouts, workout_sets, body_weight_log
-- Sync model: every user-scoped table carries updated_at; client uses UUIDs so offline writes never collide.

create extension if not exists "pgcrypto";

-- ============================================================
-- profiles: per-user settings, gated to one row per auth user.
-- ============================================================
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  height_cm numeric(5,2),
  unit_preference text not null default 'metric' check (unit_preference in ('metric','imperial')),
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- exercises: shared, read-only library seeded from Free Exercise DB.
-- ============================================================
create table if not exists public.exercises (
  id text primary key,                       -- slug from Free Exercise DB
  name text not null,
  category text,
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  equipment text,
  level text,
  mechanic text,
  force text,
  instructions text[] not null default '{}',
  image_urls text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create index if not exists exercises_primary_muscles_idx on public.exercises using gin (primary_muscles);
create index if not exists exercises_equipment_idx on public.exercises (equipment);
create index if not exists exercises_name_idx on public.exercises (name);

-- ============================================================
-- workouts: one row per gym session.
-- ============================================================
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,
  updated_at timestamptz not null default now()
);

create index if not exists workouts_user_started_idx on public.workouts (user_id, started_at desc);

-- ============================================================
-- workout_sets: one row per set logged.
-- ============================================================
create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null references public.exercises(id),
  set_number int not null,
  weight_kg numeric(6,2),
  reps int,
  rpe numeric(3,1),
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workout_sets_user_exercise_idx
  on public.workout_sets (user_id, exercise_id, completed_at desc);
create index if not exists workout_sets_workout_idx
  on public.workout_sets (workout_id, set_number);

-- ============================================================
-- body_weight_log: per-user body weight entries.
-- ============================================================
create table if not exists public.body_weight_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weight_kg numeric(5,2) not null,
  logged_at timestamptz not null default now(),
  notes text,
  updated_at timestamptz not null default now()
);

create index if not exists body_weight_log_user_idx
  on public.body_weight_log (user_id, logged_at desc);

-- ============================================================
-- updated_at trigger
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_workouts_updated_at on public.workouts;
create trigger trg_workouts_updated_at before update on public.workouts
  for each row execute function public.set_updated_at();

drop trigger if exists trg_workout_sets_updated_at on public.workout_sets;
create trigger trg_workout_sets_updated_at before update on public.workout_sets
  for each row execute function public.set_updated_at();

drop trigger if exists trg_body_weight_log_updated_at on public.body_weight_log;
create trigger trg_body_weight_log_updated_at before update on public.body_weight_log
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row-Level Security
-- exercises: world-readable, no writes from clients (seed via service role).
-- All user-scoped tables: auth.uid() = user_id.
-- ============================================================
alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;
alter table public.body_weight_log enable row level security;

drop policy if exists "profiles_self" on public.profiles;
create policy "profiles_self" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "exercises_read_all" on public.exercises;
create policy "exercises_read_all" on public.exercises
  for select using (true);

drop policy if exists "workouts_self" on public.workouts;
create policy "workouts_self" on public.workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "workout_sets_self" on public.workout_sets;
create policy "workout_sets_self" on public.workout_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "body_weight_log_self" on public.body_weight_log;
create policy "body_weight_log_self" on public.body_weight_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- Auto-create profile row on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
