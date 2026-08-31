-- Per-user rest timer default (seconds). Editable in Settings; used by the
-- in-workout rest countdown that auto-starts after each logged set.
alter table public.profiles
  add column if not exists rest_timer_seconds int not null default 90
  check (rest_timer_seconds between 15 and 600);
