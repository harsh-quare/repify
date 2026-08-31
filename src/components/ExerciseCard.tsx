import Link from 'next/link';
import { AddToWorkoutButton } from './AddToWorkoutButton';
import { AnimatedExerciseImage } from './AnimatedExerciseImage';
import type { Exercise } from '@/lib/types';

export function ExerciseCard({ exercise }: { exercise: Exercise }) {
  return (
    <div className="group relative rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden hover:border-zinc-700 transition">
      <AddToWorkoutButton exerciseId={exercise.id} variant="card" />
      <Link href={`/exercises/${exercise.id}`} className="block">
        <AnimatedExerciseImage urls={exercise.image_urls} alt={exercise.name} className="aspect-square" />
        <div className="p-3">
          <div className="font-medium text-sm leading-tight line-clamp-2">{exercise.name}</div>
          <div className="mt-1 text-xs text-zinc-400 flex flex-wrap gap-x-2">
            {exercise.primary_muscles[0] && <span className="capitalize">{exercise.primary_muscles[0]}</span>}
            {exercise.equipment && <span className="capitalize">· {exercise.equipment}</span>}
          </div>
        </div>
      </Link>
    </div>
  );
}
