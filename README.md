# Repify

Your gym log — Phase 1 MVP.

A unified, offline-first fitness tracker. **Phase 1** ships workout logging, an exercise library (~800 moves from Free Exercise DB), and body weight tracking. Nutrition, personalization, and the mobile app come in later phases — see `~/.claude/plans/lets-plan-an-application-fluffy-russell.md`.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript** + **Tailwind 4**
- **Supabase** (Postgres + Auth) — source of truth, with Row-Level Security
- **Dexie** (IndexedDB) — offline-first local cache
- **recharts** — body weight chart
- **Free Exercise DB** — exercise library (public domain)

## Architecture

Local-first: every write goes to Dexie immediately and queues to Supabase via `lib/sync/engine.ts`. Works offline (gym WiFi is unreliable). Conflicts resolved by `updated_at` (last-write-wins).

```
src/
  app/
    page.tsx              Dashboard
    onboarding/           First-run profile setup
    auth/sign-in/         Email+password auth
    auth/sign-out/        POST logout route
    exercises/            Library list + filters
    exercises/[id]/       Detail with personal history
    workout/new/          Pick exercises + start
    workout/[id]/         Active session, SetLogger per exercise
    body/                 Weight log + chart
  components/             ExerciseCard, SetLogger, AnimatedExerciseImage, TopNav, SyncProvider, DashboardClient
  lib/
    db/dexie.ts           Local IndexedDB schema
    db/supabase-*.ts      Server + browser Supabase clients
    sync/engine.ts        Pull/push sync with last-write-wins
    workout/actions.ts    startWorkout, logSet, lastSessionSets
    workout/body.ts       logBodyWeight
    types.ts              Shared row types
  proxy.ts                Next 16 proxy (formerly middleware) — auth gate
supabase/migrations/0001_init.sql   Schema + RLS + triggers
scripts/seed-exercises.ts           One-off seed from Free Exercise DB
```

## Setup

Detailed walkthrough: see [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md).

1. **Create a Supabase project** at supabase.com (free tier) — this provisions a hosted Postgres DB, Auth server, and Storage for the app.
2. **Run the migration** in Supabase Studio SQL editor — paste `supabase/migrations/0001_init.sql`.
3. **Set env vars** — copy `.env.local.example` → `.env.local` and fill:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...   # for seed only
   ```
4. **Seed the exercise library** (one-off, ~800 rows):
   ```
   npm run seed:exercises
   ```
5. **Dev**:
   ```
   npm run dev
   ```

## Verification checklist (Phase 1)

1. Sign up → complete onboarding (height + units).
2. Browse `/exercises` — filter to chest + dumbbell, ~20 results with animated images.
3. Start a workout, log 3 sets of bench press, end workout.
4. Start another workout next day, pick bench press, confirm yesterday's sets show as "Last time".
5. Toggle airplane mode mid-workout → log sets → toggle back on → confirm sets appear in Supabase dashboard.
6. Log body weight 3 times across a week → chart renders.
7. Open on phone — full flow works one-handed.

## What's next

Phase 2 (nutrition tracking across all diet types), Phase 3 (personalized recommendations), Phase 4 (React Native mobile app reusing `lib/`), Phase 5 (public launch).
