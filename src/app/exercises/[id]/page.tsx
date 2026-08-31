import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseServer } from '@/lib/db/supabase-server';
import { AddToWorkoutButton } from '@/components/AddToWorkoutButton';
import { AnimatedExerciseImage } from '@/components/AnimatedExerciseImage';
import { ExerciseProgress } from '@/components/ExerciseProgress';
import { TopNav } from '@/components/TopNav';
import type { Exercise } from '@/lib/types';

export default async function ExerciseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await getSupabaseServer();

  const { data: exercise } = await sb.from('exercises').select('*').eq('id', id).maybeSingle();
  if (!exercise) return notFound();

  const ex = exercise as Exercise;

  return (
    <>
      <TopNav />
      <main className="max-w-5xl mx-auto px-4 py-6 w-full">
        <Link href="/exercises" className="text-sm text-zinc-400 hover:text-zinc-200">← Back to library</Link>
        <h1 className="text-3xl font-semibold tracking-tight mt-2">{ex.name}</h1>
        <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-zinc-400">
          {ex.primary_muscles.map((m) => <span key={m} className="capitalize">{m}</span>)}
          {ex.equipment && <span className="capitalize">· {ex.equipment}</span>}
          {ex.level && <span className="capitalize">· {ex.level}</span>}
        </div>

        <div className="mt-4">
          <AddToWorkoutButton exerciseId={ex.id} variant="detail" />
        </div>

        <div className="mt-6 grid md:grid-cols-2 gap-6">
          <AnimatedExerciseImage urls={ex.image_urls} alt={ex.name} className="aspect-square w-full" />
          <div>
            <h2 className="text-sm uppercase tracking-wider text-zinc-400 mb-2">Instructions</h2>
            <ol className="space-y-2 text-sm">
              {ex.instructions.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-zinc-500 tabular-nums">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <ExerciseProgress exerciseId={ex.id} />
      </main>
    </>
  );
}
