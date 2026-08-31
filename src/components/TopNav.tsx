import Link from 'next/link';
import { BottomNav } from '@/components/BottomNav';
import { SyncStatus } from '@/components/SyncStatus';

export function TopNav() {
  return (
    <>
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-tight">Repify</Link>
          <div className="flex items-center gap-1 text-sm">
            <SyncStatus />
            {/* Page links live in the bottom tab bar on mobile. */}
            <nav className="hidden sm:flex items-center gap-1">
              <Link href="/" className="px-3 py-1.5 rounded-md hover:bg-zinc-800">Home</Link>
              <Link href="/exercises" className="px-3 py-1.5 rounded-md hover:bg-zinc-800">Exercises</Link>
              <Link href="/workout/new" className="px-3 py-1.5 rounded-md hover:bg-zinc-800">Workout</Link>
              <Link href="/workouts" className="px-3 py-1.5 rounded-md hover:bg-zinc-800">History</Link>
              <Link href="/body" className="px-3 py-1.5 rounded-md hover:bg-zinc-800">Body</Link>
            </nav>
            <Link
              href="/settings"
              aria-label="Settings"
              className="ml-1 p-2 rounded-md hover:bg-zinc-800 text-zinc-400"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
          </div>
        </div>
      </header>
      <BottomNav />
    </>
  );
}
