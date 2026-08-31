-- User-defined split routines: a named, ordered exercise list.
-- workouts.routine_id records which routine a session was started from,
-- powering "Upper · last done 5 days ago" recency on the dashboard.

create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  exercise_ids text[] not null default '{}',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists routines_user_idx on public.routines (user_id, position);

drop trigger if exists trg_routines_updated_at on public.routines;
create trigger trg_routines_updated_at before update on public.routines
  for each row execute function public.set_updated_at();

alter table public.routines enable row level security;

drop policy if exists "routines_self" on public.routines;
create policy "routines_self" on public.routines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.workouts
  add column if not exists routine_id uuid references public.routines(id) on delete set null;
