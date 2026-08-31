import { getSupabaseServer } from '@/lib/db/supabase-server';
import { ExerciseCard } from '@/components/ExerciseCard';
import { TopNav } from '@/components/TopNav';
import type { Exercise } from '@/lib/types';

type SearchParams = Promise<{ muscle?: string; equipment?: string; q?: string; level?: string }>;

export default async function ExercisesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const sb = await getSupabaseServer();

  let query = sb.from('exercises').select('*', { count: 'exact' }).order('name').limit(200);
  // Muscle filter matches primary OR secondary muscles — lat pulldown should
  // show up under biceps too.
  if (params.muscle) {
    query = query.or(
      `primary_muscles.cs.{"${params.muscle}"},secondary_muscles.cs.{"${params.muscle}"}`,
    );
  }
  if (params.equipment) query = query.eq('equipment', params.equipment);
  if (params.level) query = query.eq('level', params.level);
  if (params.q) query = query.ilike('name', `%${params.q}%`);

  const { data, error, count } = await query;
  const exercises = (data ?? []) as Exercise[];
  const total = count ?? exercises.length;

  return (
    <>
      <TopNav />
      <main className="max-w-5xl mx-auto px-4 py-6 w-full">
        <h1 className="text-2xl font-semibold tracking-tight">Exercise library</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Browse by muscle, equipment, or search.{' '}
          {total > exercises.length
            ? `Showing ${exercises.length} of ${total} — narrow the filters to see the rest.`
            : `${total} ${total === 1 ? 'result' : 'results'}.`}
        </p>

        <form className="mt-4 flex flex-wrap gap-2 text-sm">
          <input
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Search exercises…"
            aria-label="Search exercises"
            className="rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select name="muscle" defaultValue={params.muscle ?? ''} aria-label="Filter by muscle" className="rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 capitalize">
            <option value="">Any muscle</option>
            {['chest','biceps','triceps','shoulders','quadriceps','hamstrings','glutes','calves','lats','middle back','lower back','abdominals','forearms','traps'].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select name="equipment" defaultValue={params.equipment ?? ''} aria-label="Filter by equipment" className="rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 capitalize">
            <option value="">Any equipment</option>
            {['barbell','dumbbell','cable','machine','body only','kettlebells','bands','medicine ball','exercise ball','e-z curl bar','foam roll','other'].map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <select name="level" defaultValue={params.level ?? ''} aria-label="Filter by level" className="rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 capitalize">
            <option value="">Any level</option>
            <option value="beginner">beginner</option>
            <option value="intermediate">intermediate</option>
            <option value="expert">expert</option>
          </select>
          <button type="submit" className="rounded-md bg-indigo-500 hover:bg-indigo-400 px-4 py-2 text-white">Filter</button>
        </form>

        {error && <p className="mt-6 text-rose-400 text-sm">{error.message}</p>}

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {exercises.map((e) => <ExerciseCard key={e.id} exercise={e} />)}
        </div>
      </main>
    </>
  );
}
