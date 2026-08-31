'use client';

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { db } from '@/lib/db/dexie';
import { useExerciseMap, useMounted, useUnit } from '@/lib/db/hooks';
import { formatWeight, toDisplayWeight, weightUnitLabel } from '@/lib/units';
import {
  VOLUME_VIEWS,
  type VolumeView,
  volumeViewLabel,
} from '@/lib/workout/grouping';
import {
  calendarStats,
  calendarYearOptions,
  trainingMonthBlocks,
  WEEK_RANGES,
  type WeekRange,
  type WeekVolume,
  weeklyVolume,
  weeklyVolumeForGroup,
} from '@/lib/workout/progress';
import type { UnitPreference, Workout, WorkoutSet } from '@/lib/types';

const tooltipStyle = { background: '#18181b', border: '1px solid #27272a' };
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const CELL = 11;
const GAP = 3;

const selectClass =
  'rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500';

function WeekRangeSelect({
  value,
  onChange,
}: {
  value: WeekRange;
  onChange: (n: WeekRange) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value) as WeekRange)}
      className={selectClass}
      aria-label="Week range"
    >
      {WEEK_RANGES.map((n) => (
        <option key={n} value={n}>
          Last {n} weeks
        </option>
      ))}
    </select>
  );
}

function VolumeBars({ weeks, unit }: { weeks: WeekVolume[]; unit: UnitPreference }) {
  const interval = weeks.length <= 12 ? 1 : weeks.length <= 24 ? 2 : 3;
  const unitLabel = weightUnitLabel(unit);
  // Chart data carries display-unit volumes so the axis reads in the user's unit.
  const data = weeks.map((w) => ({ ...w, volume: toDisplayWeight(w.volume, unit) }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="label" stroke="#71717a" fontSize={11} interval={interval} />
        <YAxis yAxisId="weight" stroke="#71717a" fontSize={11} width={44} />
        <YAxis yAxisId="reps" orientation="right" stroke="#71717a" fontSize={11} width={36} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, name) =>
            name === 'volume'
              ? [`${Number(value)} ${unitLabel}`, 'Volume']
              : [`${Number(value)}`, 'Reps']
          }
        />
        <Bar yAxisId="weight" dataKey="volume" fill="#6366f1" radius={[4, 4, 0, 0]} />
        <Line yAxisId="reps" type="monotone" dataKey="reps" stroke="#a5b4fc" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function cellClass(workoutCount: number, volume: number, maxVolume: number) {
  if (workoutCount === 0) return 'bg-zinc-800';
  if (maxVolume <= 0) return 'bg-indigo-500';
  const t = volume / maxVolume;
  if (t > 0.66) return 'bg-indigo-400';
  if (t > 0.33) return 'bg-indigo-500';
  return 'bg-indigo-800';
}

export function TrainingOverview() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [weekRange, setWeekRange] = useState<WeekRange>(12);
  const [view, setView] = useState<VolumeView>('all');
  const unit = useUnit();
  const exercises = useExerciseMap();
  const mounted = useMounted();

  const workouts = useLiveQuery(
    (): Promise<Workout[]> => db().workouts.orderBy('started_at').toArray(),
    [],
    [] as Workout[],
  );
  const allSets = useLiveQuery(
    (): Promise<WorkoutSet[]> => db().workout_sets.toArray(),
    [],
    [] as WorkoutSet[],
  );

  const yearOptions = useMemo(() => calendarYearOptions(workouts ?? []), [workouts]);
  const weeks = useMemo(
    () =>
      view === 'all'
        ? weeklyVolume(workouts ?? [], allSets ?? [], weekRange)
        : weeklyVolumeForGroup(workouts ?? [], allSets ?? [], exercises, view, weekRange),
    [workouts, allSets, exercises, view, weekRange],
  );
  const months = useMemo(
    () => trainingMonthBlocks(workouts ?? [], allSets ?? [], year),
    [workouts, allSets, year],
  );
  const stats = useMemo(() => calendarStats(months), [months]);
  const hasVolume = weeks.some((w) => w.volume > 0 || w.reps > 0);
  const isCurrentYear = year === new Date().getFullYear();

  return (
    <section className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-sm text-zinc-200">
            {volumeViewLabel(view)} weekly volume
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={view}
              onChange={(e) => setView(e.target.value as VolumeView)}
              className={selectClass}
              aria-label="Volume scope"
            >
              {VOLUME_VIEWS.filter((v) => v.section === 'scope').map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
              <optgroup label="Muscle">
                {VOLUME_VIEWS.filter((v) => v.section === 'muscle').map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Split">
                {VOLUME_VIEWS.filter((v) => v.section === 'split').map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </optgroup>
            </select>
            <WeekRangeSelect value={weekRange} onChange={setWeekRange} />
          </div>
        </div>
        <div className="h-48 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
          {!mounted || !hasVolume ? (
            <div className="h-full flex items-center justify-center text-sm text-zinc-500">
              {view === 'all'
                ? 'Volume shows up here once you log weighted sets.'
                : `Log ${volumeViewLabel(view).toLowerCase()} sets to see this over time.`}
            </div>
          ) : (
            <VolumeBars weeks={weeks} unit={unit} />
          )}
        </div>
        <p className="text-xs text-zinc-500 mt-2">
          Bars = tonnage (weight × reps, {weightUnitLabel(unit)}). Line = total reps. Overall is every lift;
          Push = chest + shoulders + triceps; Pull = back + biceps.
        </p>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-sm text-zinc-200">
            {stats.workouts} {stats.workouts === 1 ? 'workout' : 'workouts'}{' '}
            <span className="text-zinc-500">
              {isCurrentYear ? 'in the past one year' : `in ${year}`}
            </span>
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            <span>Total active days: {stats.trainedDays}</span>
            <span>Max streak: {stats.maxStreak}</span>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className={selectClass}
              aria-label="Calendar year"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y === new Date().getFullYear() ? 'Current' : y}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 overflow-x-auto">
          <div className="inline-flex items-start">
            <div
              className="flex flex-col text-[10px] text-zinc-500 shrink-0"
              style={{ gap: GAP, marginRight: GAP * 2 }}
            >
              {WEEKDAYS.map((d, i) => (
                <span
                  key={`${d}-${i}`}
                  className="leading-none flex items-center"
                  style={{ height: CELL }}
                >
                  {i % 2 === 0 ? d : ''}
                </span>
              ))}
            </div>
            <div className="flex" style={{ gap: CELL + GAP }}>
              {months.map((month) => (
                <div key={month.key} className="flex flex-col items-center">
                  <div className="flex" style={{ gap: GAP }}>
                    {month.weeks.map((week, wi) => (
                      <div key={`${month.key}-${wi}`} className="flex flex-col" style={{ gap: GAP }}>
                        {week.map((day, di) => (
                          <div
                            key={day?.date ?? `${month.key}-${wi}-${di}`}
                            title={
                              !day
                                ? undefined
                                : day.workoutCount > 0
                                  ? `${day.date} · ${day.workoutCount} ${day.workoutCount === 1 ? 'workout' : 'workouts'} · ${formatWeight(day.volume, unit)} ${weightUnitLabel(unit)}`
                                  : `${day.date} · rest`
                            }
                            className={`rounded-sm ${day ? cellClass(day.workoutCount, day.volume, stats.maxVolume) : 'bg-transparent'}`}
                            style={{ width: CELL, height: CELL }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  <span className="mt-2 text-[10px] text-zinc-500">{month.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
