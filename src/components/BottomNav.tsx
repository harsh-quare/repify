'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { getOpenWorkout } from '@/lib/workout/actions';

function Icon({ d, filled }: { d: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-6 h-6"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V21h-6v-6h-6v6H3z',
  library: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5z',
  // Dumbbell for the center Workout tab.
  workout: 'M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11',
  history: 'M8 2v4M16 2v4M3 8h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  body: 'M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM5 21c0-4 3-7 7-7s7 3 7 7',
} as const;

export function BottomNav() {
  const pathname = usePathname();
  const openWorkout = useLiveQuery(() => getOpenWorkout(), []);

  const workoutHref = openWorkout ? `/workout/${openWorkout.id}` : '/workout/new';
  const workoutActive = pathname.startsWith('/workout');

  const side = (href: string, exact: boolean) =>
    (exact ? pathname === href : pathname.startsWith(href))
      ? 'text-indigo-400'
      : 'text-zinc-500 hover:text-zinc-300';

  return (
    <nav
      data-bottom-nav
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5 h-16">
        <Link href="/" className={`flex flex-col items-center justify-center gap-0.5 ${side('/', true)}`}>
          <Icon d={ICONS.home} />
          <span className="text-[10px]">Home</span>
        </Link>
        <Link href="/exercises" className={`flex flex-col items-center justify-center gap-0.5 ${side('/exercises', false)}`}>
          <Icon d={ICONS.library} />
          <span className="text-[10px]">Exercises</span>
        </Link>
        <Link href={workoutHref} className="flex flex-col items-center justify-center gap-0.5">
          <span
            className={`relative -mt-5 flex items-center justify-center w-12 h-12 rounded-full border shadow-lg ${
              workoutActive
                ? 'bg-indigo-400 border-indigo-300 text-zinc-950'
                : 'bg-indigo-500 border-indigo-400 text-white'
            }`}
          >
            <Icon d={ICONS.workout} />
            {openWorkout && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-zinc-950" />
            )}
          </span>
          <span className={`text-[10px] ${workoutActive ? 'text-indigo-400' : 'text-zinc-500'}`}>
            {openWorkout ? 'Resume' : 'Workout'}
          </span>
        </Link>
        <Link href="/workouts" className={`flex flex-col items-center justify-center gap-0.5 ${side('/workouts', false)}`}>
          <Icon d={ICONS.history} />
          <span className="text-[10px]">History</span>
        </Link>
        <Link href="/body" className={`flex flex-col items-center justify-center gap-0.5 ${side('/body', false)}`}>
          <Icon d={ICONS.body} />
          <span className="text-[10px]">Body</span>
        </Link>
      </div>
    </nav>
  );
}
