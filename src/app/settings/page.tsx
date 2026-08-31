'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/db/dexie';
import { getSupabaseBrowser } from '@/lib/db/supabase-browser';
import { TopNav } from '@/components/TopNav';
import { buildBodyWeightCsv, buildSetsCsv, downloadCsv } from '@/lib/export';
import { cmToFeetInches, feetInchesToCm, weightUnitLabel } from '@/lib/units';
import type { Profile } from '@/lib/types';

const UNIT_OPTIONS = [
  { id: 'metric', label: 'Metric', hint: 'kg · cm' },
  { id: 'imperial', label: 'Imperial', hint: 'lbs · ft' },
] as const;

export default function SettingsPage() {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [unit, setUnit] = useState<'metric' | 'imperial'>('metric');
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [restSeconds, setRestSeconds] = useState('90');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const sb = getSupabaseBrowser();
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? '');
      const { data } = await sb.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
      const p = data as Profile | null;
      if (p) {
        setDisplayName(p.display_name ?? '');
        setUnit(p.unit_preference);
        setRestSeconds(String(p.rest_timer_seconds ?? 90));
        if (p.height_cm != null) {
          setHeightCm(String(p.height_cm));
          const { feet, inches } = cmToFeetInches(Number(p.height_cm));
          setHeightFt(String(feet));
          setHeightIn(String(inches));
        }
      }
      setLoaded(true);
    })();
  }, []);

  function heightInCm(): number | null {
    if (unit === 'metric') {
      const h = parseFloat(heightCm);
      return Number.isFinite(h) && h > 0 ? h : null;
    }
    const ft = parseInt(heightFt, 10);
    const inches = heightIn === '' ? 0 : parseInt(heightIn, 10);
    if (!Number.isFinite(ft) || ft <= 0 || !Number.isFinite(inches) || inches < 0) return null;
    return feetInchesToCm(ft, inches);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const h = heightInCm();
    if (h == null) {
      setError('Enter your height.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const sb = getSupabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        setError('Session expired — sign in again.');
        return;
      }
      const rest = parseInt(restSeconds, 10);
      const patch = {
        user_id: user.id,
        height_cm: h,
        unit_preference: unit,
        display_name: displayName || null,
        rest_timer_seconds: Number.isFinite(rest) ? Math.min(600, Math.max(15, rest)) : 90,
      };
      const { error } = await sb.from('profiles').upsert(patch);
      if (error) {
        setError(error.message);
        return;
      }
      // Reflect into the local mirror immediately so every screen updates now,
      // without waiting for the next sync pull.
      const local = await db().profiles.get(user.id);
      if (local) await db().profiles.put({ ...local, ...patch, updated_at: new Date().toISOString() });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <TopNav />
      <main className="max-w-3xl mx-auto px-4 py-6 w-full">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-400 mt-1">{email}</p>

        <form className="mt-6 max-w-sm space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="display-name" className="block text-xs uppercase tracking-wider text-zinc-400 mb-1">
              Display name
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={!loaded}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm disabled:opacity-50"
            />
          </div>
          <div>
            <span className="block text-xs uppercase tracking-wider text-zinc-400 mb-1">Units</span>
            <div className="flex gap-2">
              {UNIT_OPTIONS.map((u) => (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => setUnit(u.id)}
                  disabled={!loaded}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm border ${unit === u.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-700 bg-zinc-800'} disabled:opacity-50`}
                >
                  {u.label}
                  <span className="block text-xs text-zinc-500">{u.hint}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Your history stays intact — weights are converted for display.
            </p>
          </div>
          <div>
            <label htmlFor="height" className="block text-xs uppercase tracking-wider text-zinc-400 mb-1">
              Height {unit === 'metric' ? '(cm)' : ''}
            </label>
            {unit === 'metric' ? (
              <input
                id="height"
                type="number"
                step="0.5"
                inputMode="decimal"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                disabled={!loaded}
                className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm disabled:opacity-50"
              />
            ) : (
              <div className="flex gap-2">
                <input
                  id="height"
                  type="number"
                  inputMode="numeric"
                  value={heightFt}
                  onChange={(e) => setHeightFt(e.target.value)}
                  placeholder="ft"
                  aria-label="Height (feet)"
                  disabled={!loaded}
                  className="w-1/2 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm disabled:opacity-50"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="11"
                  value={heightIn}
                  onChange={(e) => setHeightIn(e.target.value)}
                  placeholder="in"
                  aria-label="Height (inches)"
                  disabled={!loaded}
                  className="w-1/2 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm disabled:opacity-50"
                />
              </div>
            )}
          </div>
          <div>
            <label htmlFor="rest-seconds" className="block text-xs uppercase tracking-wider text-zinc-400 mb-1">
              Rest timer (seconds)
            </label>
            <input
              id="rest-seconds"
              type="number"
              inputMode="numeric"
              min={15}
              max={600}
              step={15}
              value={restSeconds}
              onChange={(e) => setRestSeconds(e.target.value)}
              disabled={!loaded}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm disabled:opacity-50"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Starts automatically after each logged set.
            </p>
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          {saved && <p className="text-sm text-emerald-400">Saved.</p>}
          <button
            type="submit"
            disabled={saving || !loaded}
            className="w-full rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>

        <div className="mt-10 border-t border-zinc-800 pt-6">
          <h2 className="text-sm uppercase tracking-wider text-zinc-400">Export data</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Your data is yours. CSV files use your current unit ({weightUnitLabel(unit)}).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => downloadCsv('repify-workouts.csv', await buildSetsCsv(unit))}
              className="rounded-lg border border-zinc-700 hover:bg-zinc-800 px-4 py-2 text-sm text-zinc-300"
            >
              Export workouts (CSV)
            </button>
            <button
              type="button"
              onClick={async () => downloadCsv('repify-body-weight.csv', await buildBodyWeightCsv(unit))}
              className="rounded-lg border border-zinc-700 hover:bg-zinc-800 px-4 py-2 text-sm text-zinc-300"
            >
              Export body weight (CSV)
            </button>
          </div>
        </div>

        <div className="mt-10 border-t border-zinc-800 pt-6">
          <form action="/auth/sign-out" method="post">
            <button
              type="submit"
              className="rounded-lg border border-zinc-700 hover:border-rose-500 hover:text-rose-300 px-4 py-2 text-sm text-zinc-400"
            >
              Sign out
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
