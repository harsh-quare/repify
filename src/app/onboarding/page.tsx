'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/db/supabase-browser';
import { feetInchesToCm } from '@/lib/units';

const UNIT_OPTIONS = [
  { id: 'metric', label: 'Metric', hint: 'kg · cm' },
  { id: 'imperial', label: 'Imperial', hint: 'lbs · ft' },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [unit, setUnit] = useState<'metric' | 'imperial'>('metric');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    try {
      const sb = getSupabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        router.replace('/auth/sign-in');
        return;
      }
      const { error } = await sb.from('profiles').upsert({
        user_id: user.id,
        height_cm: h,
        unit_preference: unit,
        display_name: displayName || null,
      });
      if (error) {
        setError(error.message);
        return;
      }
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
        <h1 className="text-2xl font-semibold tracking-tight">Set up your profile</h1>
        <p className="text-sm text-zinc-400 mt-1 mb-6">Quick — just a few questions.</p>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="display-name" className="block text-xs uppercase tracking-wider text-zinc-400 mb-1">
              What should we call you?
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm"
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
                  className={`flex-1 rounded-lg px-3 py-2 text-sm border ${unit === u.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-700 bg-zinc-800'}`}
                >
                  {u.label}
                  <span className="block text-xs text-zinc-500">{u.hint}</span>
                </button>
              ))}
            </div>
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
                required
                className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm"
              />
            ) : (
              <div className="flex gap-2">
                <input
                  id="height"
                  type="number"
                  inputMode="numeric"
                  value={heightFt}
                  onChange={(e) => setHeightFt(e.target.value)}
                  required
                  placeholder="ft"
                  aria-label="Height (feet)"
                  className="w-1/2 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm"
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
                  className="w-1/2 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? '…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
