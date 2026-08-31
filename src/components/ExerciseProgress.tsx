'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db } from '@/lib/db/dexie';
import { useUnit } from '@/lib/db/hooks';
import { formatWeight, toDisplayWeight, weightUnitLabel } from '@/lib/units';
import {
  historySessions,
  personalRecords,
  sessionPoints,
} from '@/lib/workout/progress';
import type { WorkoutSet } from '@/lib/types';

type Metric = 'topWeight' | 'volume' | 'e1rm';

const METRICS: { id: Metric; label: string }[] = [
  { id: 'topWeight', label: 'Weight' },
  { id: 'volume', label: 'Volume' },
  { id: 'e1rm', label: 'e1RM' },
];

const tooltipStyle = { background: '#18181b', border: '1px solid #27272a' };

export function ExerciseProgress({ exerciseId }: { exerciseId: string }) {
  const [metric, setMetric] = useState<Metric>('topWeight');
  const unit = useUnit();
  const unitLabel = weightUnitLabel(unit);

  const sets = useLiveQuery(
    (): Promise<WorkoutSet[]> =>
      db().workout_sets.where('exercise_id').equals(exerciseId).sortBy('completed_at'),
    [exerciseId],
    [] as WorkoutSet[],
  );

  const points = useMemo(() => sessionPoints(sets ?? []), [sets]);
  const records = useMemo(() => personalRecords(sets ?? []), [sets]);
  const sessions = useMemo(() => historySessions(sets ?? []), [sets]);

  const chartData = points.map((p) => ({
    label: p.label,
    value: toDisplayWeight(p[metric], unit),
  }));

  const metricHint =
    metric === 'e1rm'
      ? 'Epley estimate · heaviest equivalent 1RM that session'
      : metric === 'volume'
        ? 'Sum of weight × reps that session'
        : 'Heaviest set that session';

  return (
    <section className="mt-10 space-y-8">
      <div>
        <h2 className="text-sm uppercase tracking-wider text-zinc-400 mb-3">Progress</h2>
        <div className="flex gap-1 mb-3">
          {METRICS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMetric(m.id)}
              className={`px-3 py-1 rounded-md text-sm ${
                metric === m.id
                  ? 'bg-indigo-500 text-white'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="h-56 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-zinc-500">
              Log a few sets to see this lift over time.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="label" stroke="#71717a" fontSize={12} />
                <YAxis stroke="#71717a" fontSize={12} domain={['auto', 'auto']} unit={` ${unitLabel}`} width={56} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [`${Number(value)} ${unitLabel}`, METRICS.find((m) => m.id === metric)?.label ?? '']}
                />
                <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <p className="text-xs text-zinc-500 mt-2">{metricHint}</p>
      </div>

      {records.heaviestKg != null && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <PrStat label="Heaviest" value={`${formatWeight(records.heaviestKg, unit)}${unitLabel} × ${records.heaviestReps}`} />
          <PrStat
            label="Best set"
            value={`${formatWeight(records.bestSetKg!, unit)}${unitLabel} × ${records.bestSetReps}`}
          />
          <PrStat label="Best session" value={`${formatWeight(records.bestSessionVolume!, unit)} ${unitLabel}`} />
          <PrStat label="e1RM" value={`${formatWeight(records.e1rm!, unit)} ${unitLabel}`} />
        </div>
      )}

      <div>
        <h2 className="text-sm uppercase tracking-wider text-zinc-400 mb-2">History</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-zinc-500">No sets logged for this exercise yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded-lg overflow-hidden">
            {sessions.slice(0, 20).map((session) => (
              <li key={session.workoutId} className="px-4 py-3 bg-zinc-900">
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    href={`/workout/${session.workoutId}`}
                    className="text-sm font-medium hover:text-indigo-300"
                  >
                    {new Date(session.at).toLocaleString()}
                  </Link>
                  <span className="text-xs text-zinc-500 tabular-nums">
                    {session.sets.length} {session.sets.length === 1 ? 'set' : 'sets'}
                  </span>
                </div>
                <div className="mt-1 text-sm tabular-nums text-zinc-300">
                  {session.sets.map((s, i) => (
                    <span key={s.id}>
                      {i > 0 && ', '}
                      {s.weight_kg != null ? formatWeight(s.weight_kg, unit) : '–'}{unitLabel} × {s.reps ?? '–'}
                      {s.rpe ? ` @ ${s.rpe}` : ''}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PrStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3">
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-medium tabular-nums">{value}</div>
    </div>
  );
}
