'use client';

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { db } from '@/lib/db/dexie';
import { useProfile } from '@/lib/db/hooks';
import { TopNav } from '@/components/TopNav';
import { deleteBodyWeightEntry, logBodyWeight, updateBodyWeightEntry } from '@/lib/workout/body';
import {
  bmi,
  formatWeightWithUnit,
  fromDisplayWeight,
  toDisplayWeight,
  weightUnitLabel,
} from '@/lib/units';
import type { BodyWeightEntry } from '@/lib/types';

export default function BodyPage() {
  const profile = useProfile();
  const unit = profile?.unit_preference ?? 'metric';
  const unitLabel = weightUnitLabel(unit);

  const entries = useLiveQuery(
    () => db().body_weight_log.orderBy('logged_at').toArray(),
    [],
    [] as BodyWeightEntry[],
  );

  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState('');

  async function onSaveEdit(id: string) {
    const w = parseFloat(editWeight);
    if (!Number.isFinite(w) || w <= 0) return;
    await updateBodyWeightEntry(id, fromDisplayWeight(w, unit));
    setEditingId(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const w = parseFloat(weight);
    if (!Number.isFinite(w) || w <= 0) return;
    setSaving(true);
    await logBodyWeight(fromDisplayWeight(w, unit), notes || undefined);
    setWeight('');
    setNotes('');
    setSaving(false);
  }

  // Daily weight is noisy (±1kg water/food); the trailing-7-day average is
  // the line worth trusting. Kept in kg here, converted at render.
  const withTrend = useMemo(() => {
    const list = entries ?? [];
    return list.map((e, i) => {
      const t = new Date(e.logged_at).getTime();
      const windowStart = t - 7 * 24 * 60 * 60 * 1000;
      let sum = 0;
      let n = 0;
      for (let j = i; j >= 0; j--) {
        const tj = new Date(list[j].logged_at).getTime();
        if (tj < windowStart) break;
        sum += Number(list[j].weight_kg);
        n++;
      }
      return { entry: e, trendKg: sum / n };
    });
  }, [entries]);

  const chartData = withTrend.map(({ entry, trendKg }) => ({
    date: new Date(entry.logged_at).toLocaleDateString(),
    weight: toDisplayWeight(Number(entry.weight_kg), unit),
    trend: toDisplayWeight(trendKg, unit),
  }));

  const latest = entries && entries.length > 0 ? entries[entries.length - 1] : null;
  const latestBmi =
    latest && profile?.height_cm != null ? bmi(Number(latest.weight_kg), Number(profile.height_cm)) : null;

  // Trend now vs trend a week ago → weekly rate of change.
  const weeklyDeltaKg = useMemo(() => {
    if (withTrend.length < 2) return null;
    const nowPoint = withTrend[withTrend.length - 1];
    const cutoff = new Date(nowPoint.entry.logged_at).getTime() - 7 * 24 * 60 * 60 * 1000;
    for (let i = withTrend.length - 2; i >= 0; i--) {
      if (new Date(withTrend[i].entry.logged_at).getTime() <= cutoff) {
        return nowPoint.trendKg - withTrend[i].trendKg;
      }
    }
    return null;
  }, [withTrend]);

  return (
    <>
      <TopNav />
      <main className="max-w-3xl mx-auto px-4 py-6 w-full">
        <h1 className="text-2xl font-semibold tracking-tight">Body weight</h1>
        <p className="text-sm text-zinc-400 mt-1">
          {latest
            ? `Current: ${formatWeightWithUnit(Number(latest.weight_kg), unit)}`
            : 'Log your first entry to start tracking.'}
          {weeklyDeltaKg != null && (
            <span className="text-zinc-500">
              {' '}· {weeklyDeltaKg >= 0 ? '+' : '−'}
              {formatWeightWithUnit(Math.abs(weeklyDeltaKg), unit)} this week (7-day avg)
            </span>
          )}
          {latestBmi != null && (
            <span className="text-zinc-500"> · BMI {latestBmi} (healthy range 18.5–24.9)</span>
          )}
        </p>

        <form onSubmit={onSubmit} className="mt-4 flex flex-wrap gap-2 items-center text-sm">
          <input
            type="number"
            step="0.1"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder={unitLabel}
            aria-label={`Body weight (${unitLabel})`}
            className="w-24 rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2"
            required
          />
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="flex-1 min-w-[12rem] rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2"
          />
          <button type="submit" disabled={saving} className="rounded-md bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 px-4 py-2 font-medium">
            {saving ? '…' : 'Log'}
          </button>
        </form>

        <div className="mt-6 h-64 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-zinc-500">
              No data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" stroke="#71717a" fontSize={12} />
                <YAxis stroke="#71717a" fontSize={12} domain={['auto', 'auto']} unit={` ${unitLabel}`} width={64} />
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #27272a' }}
                  formatter={(value, name) => [
                    `${Number(value)} ${unitLabel}`,
                    name === 'trend' ? '7-day avg' : 'Weight',
                  ]}
                />
                <Legend
                  formatter={(value) => (value === 'trend' ? '7-day avg' : 'Daily')}
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Line type="monotone" dataKey="weight" stroke="#3f3f46" strokeWidth={1.5} dot={{ r: 2, fill: '#52525b' }} />
                <Line type="monotone" dataKey="trend" stroke="#6366f1" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {entries && entries.length > 0 && (
          <ul className="mt-6 divide-y divide-zinc-800 border border-zinc-800 rounded-lg overflow-hidden">
            {[...entries].reverse().slice(0, 20).map((e) => (
              <li key={e.id} className="px-4 py-2 text-sm flex items-center gap-3 bg-zinc-900">
                <span className="flex-1 min-w-0">{new Date(e.logged_at).toLocaleString()}</span>
                {editingId === e.id ? (
                  <span className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      inputMode="decimal"
                      value={editWeight}
                      onChange={(ev) => setEditWeight(ev.target.value)}
                      aria-label={`Weight (${unitLabel})`}
                      className="w-20 rounded-md bg-zinc-800 border border-zinc-700 px-2 py-1 text-sm tabular-nums"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => void onSaveEdit(e.id)}
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <>
                    <span className="tabular-nums text-right">
                      {formatWeightWithUnit(Number(e.weight_kg), unit)} {e.notes ? `· ${e.notes}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(e.id);
                        setEditWeight(String(toDisplayWeight(Number(e.weight_kg), unit)));
                      }}
                      aria-label={`Edit entry from ${new Date(e.logged_at).toLocaleDateString()}`}
                      className="shrink-0 text-xs text-zinc-400 hover:text-zinc-200"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Delete this entry?')) void deleteBodyWeightEntry(e.id);
                      }}
                      aria-label={`Delete entry from ${new Date(e.logged_at).toLocaleDateString()}`}
                      className="shrink-0 text-xs text-zinc-500 hover:text-rose-300"
                    >
                      ✕
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
