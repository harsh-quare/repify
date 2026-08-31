# Supabase setup (~5 minutes)

What Supabase is: a hosted backend service that gives Repify a Postgres database, authentication, file storage, and an auto-generated REST API. "Setting up a Supabase project" means creating an account at supabase.com and clicking "New Project" — it provisions a dedicated database and gives you two API keys. The free tier (500 MB DB, 1 GB storage, unlimited API calls, 50k monthly active users) is more than enough for Phase 1.

## Step 1 — Create the project

1. Go to **https://supabase.com** and click **Start your project** (top-right).
2. Sign in with GitHub (recommended) or email.
3. On the dashboard, click **New project**.
4. Pick or create an organization (free tier).
5. Fill in:
   - **Project name:** `repify`
   - **Database password:** click *Generate*, then **copy it to your password manager**. You'll rarely need this — the app uses API keys, not the DB password — but you need it for direct DB access if anything breaks.
   - **Region:** pick the one closest to you (e.g., `Mumbai (ap-south-1)` for India, `N. Virginia (us-east-1)` for US East).
   - **Pricing plan:** Free.
6. Click **Create new project**. Wait ~2 minutes while it provisions.

## Step 2 — Run the schema migration

1. In the Supabase dashboard sidebar, click **SQL Editor** (the `</>` icon).
2. Click **+ New query**.
3. Open `supabase/migrations/0001_init.sql` from this repo, copy the entire contents, paste into the SQL editor.
4. Click **Run** (bottom-right, or Cmd/Ctrl+Enter).

You should see "Success. No rows returned." This creates the `profiles`, `exercises`, `workouts`, `workout_sets`, `body_weight_log` tables, RLS policies, triggers, and the auto-profile-creation hook.

Verify: in the sidebar, click **Table Editor** — you should see those five tables listed.

## Step 3 — Copy your API keys into `.env.local`

1. In the sidebar, click **Project Settings** (gear icon, bottom-left).
2. Click **API** (in the Settings sub-menu).
3. You'll see three values you need:
   - **Project URL** — looks like `https://abcdefghijklmn.supabase.co`. **Paste only this — do NOT include the `/rest/v1/` path shown elsewhere on the page.** The Supabase client appends the path automatically; including it produces a `PGRST125` 404 on every query.
   - **anon public** key — under "Project API keys"
   - **service_role** key — same section. **Treat this like a password — never commit it, never ship it to the client.** It bypasses RLS.

4. In the repo root, copy the example file and fill in those three values:

   ```bash
   cp .env.local.example .env.local
   ```

   Then edit `.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmn.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   ```

   The `NEXT_PUBLIC_` prefix means Next.js ships the value to the browser — that's safe for the URL and anon key (they're designed for client use, protected by RLS). The service role key has **no** prefix so it stays server-only.

## Step 4 — Configure auth (email/password)

1. In the sidebar, click **Authentication** → **Sign In / Up**.
2. Under **Auth Providers**, make sure **Email** is enabled (it is by default).
3. For local dev convenience: scroll to **Email Auth** settings and **disable "Confirm email"** for now. (Re-enable before Phase 5 / public launch.) This lets you sign up and immediately sign in without clicking a confirmation link.
4. Under **URL Configuration**:
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs:** add `http://localhost:3000/**`

## Step 5 — Seed the exercise library

Back in the terminal:

```bash
npm run seed:exercises
```

This downloads ~800 exercises from Free Exercise DB and inserts them into the `exercises` table. Takes ~30 seconds. Uses the `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS for the seed.

Verify: in Supabase **Table Editor** → `exercises`, you should see ~800 rows.

## Step 6 — Start the app

```bash
npm run dev
```

Open `http://localhost:3000` — you'll be redirected to `/auth/sign-in`. Click "Sign up", create an account, complete onboarding, and you're in.

---

## Troubleshooting

- **`PGRST125` "Invalid path specified in request URL":** your `NEXT_PUBLIC_SUPABASE_URL` includes a trailing path like `/rest/v1/`. Set it to just `https://<project>.supabase.co` — no suffix.
- **"Invalid API key" on sign-in:** double-check `.env.local` has no quotes around the values, and restart `npm run dev` (env vars are read at startup).
- **`new row violates row-level security policy`:** the user isn't signed in, or the migration didn't run. Re-run Step 2.
- **Seed fails with "permission denied":** `SUPABASE_SERVICE_ROLE_KEY` is missing or wrong in `.env.local`.
- **Email confirmation required:** disable it in Auth settings (Step 4.3) for dev.
- **"Failed to fetch" / "Cannot reach Supabase":** the browser never reached Auth. Check that `NEXT_PUBLIC_SUPABASE_URL` is `https://<ref>.supabase.co` with no extra path, then in a terminal run `dig +short <ref>.supabase.co`. `NXDOMAIN` means the project was deleted or never finished provisioning — create a new project (Step 1), paste the new URL and keys into `.env.local`, restart `npm run dev`, and re-run the migration + seed.
