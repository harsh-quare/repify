'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addToPlan, getOpenWorkout, startWorkout } from '@/lib/workout/actions';

// The library is no dead end: any exercise can go straight into training.
// With a session open it joins the plan (stay and keep browsing); with
// nothing open it starts a new workout with this exercise and jumps in.
export function AddToWorkoutButton({
  exerciseId,
  variant,
}: {
  exerciseId: string;
  variant: 'card' | 'detail';
}) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'busy' | 'added'>('idle');
  const [openId, setOpenId] = useState<string | null>(null);

  async function onAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (state !== 'idle') return;
    setState('busy');
    const open = await getOpenWorkout();
    if (open) {
      await addToPlan(open.id, exerciseId);
      setOpenId(open.id);
      setState('added');
      return;
    }
    const id = await startWorkout([exerciseId]);
    router.push(`/workout/${id}`);
  }

  if (variant === 'card') {
    return state === 'added' ? (
      <Link
        href={`/workout/${openId}`}
        aria-label="Added — go to workout"
        title="Added — go to workout"
        className="absolute top-2 right-2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500 text-zinc-950 text-sm font-semibold shadow"
      >
        ✓
      </Link>
    ) : (
      <button
        type="button"
        onClick={(e) => void onAdd(e)}
        disabled={state === 'busy'}
        aria-label="Add to workout"
        title="Add to workout"
        className="absolute top-2 right-2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-zinc-950/80 border border-zinc-700 text-zinc-200 text-lg leading-none hover:bg-indigo-500 hover:border-indigo-400 disabled:opacity-50 shadow"
      >
        +
      </button>
    );
  }

  return state === 'added' ? (
    <Link
      href={`/workout/${openId}`}
      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-sm font-medium"
    >
      Added ✓ — go to workout →
    </Link>
  ) : (
    <button
      type="button"
      onClick={(e) => void onAdd(e)}
      disabled={state === 'busy'}
      className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium"
    >
      {state === 'busy' ? 'Adding…' : 'Add to workout'}
    </button>
  );
}
