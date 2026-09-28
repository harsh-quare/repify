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

## Step 2 — Run the schema migrations

1. In the Supabase dashboard sidebar, click **SQL Editor** (the `</>` icon).
2. Click **+ New query**.
3. Run each file in `supabase/migrations/` in order (`0001` … `0006`). Copy the entire contents, paste, click **Run**.

`0001` creates `profiles`, `exercises`, `workouts`, `workout_sets`, `body_weight_log`, RLS, and the auto-profile hook. Later files add rest-timer settings, routines, and `workouts.calories_kcal`. `0006` drops the Google-signup block from `0005` so **Create account → Continue with Google** can create a user.

If the project already exists, run only the files you have not applied yet (`0004` for calories; `0006` if you already ran `0005`).

Verify: **Table Editor** should list those tables; after `0004`, `workouts` has a `calories_kcal` column.

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

## Step 4 — Configure auth

1. In the sidebar, click **Authentication** → **Sign In / Providers**.
2. Enable **Email** (on by default).
3. Under Email, **disable "Confirm email"** (local and production). Create account then signs the user in immediately. Leave it off unless you want a confirm-link step.
4. Under **URL Configuration**, allow **both** local and the live Vercel app. Copy the production URL from Vercel → Project → **Domains** (e.g. `https://repify.vercel.app` or a custom domain).

   - **Site URL:** the live origin (used as the default in auth emails). Example: `https://your-app.vercel.app`
   - **Redirect URLs** — add each of these (one per line):
     - `http://localhost:3000/**`
     - `https://your-app.vercel.app/**`
     - `https://*.vercel.app/**` (optional; covers Vercel preview URLs)

   After Google / magic-link / password-reset, Supabase will only send the browser back to origins on this list. Localhost alone means production sign-in cannot complete.

### Google sign-in

1. Authentication → Providers → **Google** → enable.
2. Create an OAuth client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (Web application).
3. **Authorized JavaScript origins** — add both:
   - `http://localhost:3000`
   - `https://your-app.vercel.app`
4. **Authorized redirect URIs** — this is **not** localhost or Vercel. It is always Supabase:
   `https://<project-ref>.supabase.co/auth/v1/callback`
   (`<project-ref>` is the subdomain of your Project URL.)
5. Paste the Google **Client ID** and **Client secret** into the Supabase Google provider form and save.

Until this is set, **Continue with Google** on `/auth/sign-in` will error. Email/password still works.

**Create account → Continue with Google** creates the account and signs in. **Sign in → Continue with Google** only works if that Google email already has a Repify account; otherwise the app sends them back to create one. If you already ran `0005_google_signin_only.sql`, run `0006_drop_google_signup_block.sql` or Google on Create account will fail.

On Vercel, set the same `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as in `.env.local` (Project → Settings → Environment Variables). You do **not** put the Google Client ID in Vercel env — that stays in the Supabase Google provider form.

### Live site (Vercel) — same Google app, extra URLs

Google’s **redirect URI stays the Supabase URL** (unchanged from local). You only add the Vercel origin next to localhost.

1. Vercel → your project → **Domains**. Copy the origin, e.g. `https://your-app.vercel.app` (no path).
2. Supabase → Authentication → **URL Configuration**:
   - **Site URL:** that Vercel origin
   - **Redirect URLs:** keep `http://localhost:3000/**` and add `https://your-app.vercel.app/**` (optional: `https://*.vercel.app/**` for previews)
3. Google Cloud → the same OAuth client you already created → **Authorized JavaScript origins** → add `https://your-app.vercel.app` next to `http://localhost:3000`. Save.
4. Vercel → Settings → Environment Variables: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must match `.env.local`. Redeploy if you just added them.
5. Open `https://your-app.vercel.app/auth/sign-in` → **Continue with Google**. After Google, you should land back on the live site.

Do **not** put `https://your-app.vercel.app/auth/callback` in Google’s redirect URIs. That field is only `https://<project-ref>.supabase.co/auth/v1/callback`.

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
