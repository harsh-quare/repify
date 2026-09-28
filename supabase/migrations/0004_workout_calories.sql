-- Estimated session calories, stamped at end so later weight changes don't rewrite history.
alter table public.workouts
  add column if not exists calories_kcal int;
