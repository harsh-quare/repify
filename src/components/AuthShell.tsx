'use client';

import { Dumbbell } from 'lucide-react';

const POINTS = [
  'Log sets in a few taps — no Notes app dump',
  'A year of training, heatmap-style',
  'Works at the gym even when the signal does not',
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between bg-zinc-950 px-12 py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.28),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(24,24,27,1),#09090b)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #3f3f46 1px, transparent 1px), linear-gradient(to bottom, #3f3f46 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative">
          <div className="inline-flex items-center gap-2 text-zinc-100">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500 text-white">
              <Dumbbell size={18} />
            </span>
            <span className="text-lg font-semibold tracking-tight">Repify</span>
          </div>
        </div>
        <div className="relative max-w-md">
          <p className="text-4xl font-semibold tracking-tight text-zinc-50 leading-tight">
            Your gym log, without the Notes mess.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            Every set, a clock on the session, and progress you can actually see.
          </p>
          <ul className="mt-8 space-y-3">
            {POINTS.map((line) => (
              <li key={line} className="flex gap-3 text-sm text-zinc-300">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                {line}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-zinc-600">Personal training log. Offline-first.</p>
      </aside>

      <div className="flex min-h-screen flex-col justify-center px-4 py-10 sm:px-8">
        <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white">
            <Dumbbell size={16} />
          </span>
          <span className="text-base font-semibold tracking-tight">Repify</span>
        </div>
        <div className="mx-auto w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
