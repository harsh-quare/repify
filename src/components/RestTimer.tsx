'use client';

import { useEffect, useRef, useState } from 'react';
import { useProfile } from '@/lib/db/hooks';

// Auto-starts when a set is logged (SetLogger dispatches SET_LOGGED_EVENT).
// Survives reloads via localStorage. Rings with vibration + a short beep;
// the bar itself flips state as the visual fallback.

export const SET_LOGGED_EVENT = 'repify:set-logged';

const STEP = 15; // seconds per +/- tap

function storageKey(workoutId: string) {
  return `repify:rest:${workoutId}`;
}

let audioCtx: AudioContext | null = null;

function ensureAudio() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
  } catch {
    // No audio available — vibration and the visual state still fire.
  }
}

function beep() {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const now = audioCtx.currentTime;
  for (const [at, freq] of [
    [0, 880],
    [0.25, 1174.66],
  ] as const) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.001, now + at);
    gain.gain.exponentialRampToValueAtTime(0.2, now + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + at + 0.18);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now + at);
    osc.stop(now + at + 0.2);
  }
}

function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function RestTimer({ workoutId }: { workoutId: string }) {
  const profile = useProfile();
  const defaultSeconds = profile?.rest_timer_seconds ?? 90;
  const defaultRef = useRef(defaultSeconds);
  defaultRef.current = defaultSeconds;

  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [duration, setDuration] = useState(90);
  const [now, setNow] = useState(() => Date.now());
  const [done, setDone] = useState(false);
  const firedRef = useRef(false);

  // Restore a timer that was running before a reload.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(workoutId));
      if (!raw) return;
      const saved = JSON.parse(raw) as { endsAt: number; duration: number };
      if (saved.endsAt > Date.now()) {
        setEndsAt(saved.endsAt);
        setDuration(saved.duration);
        firedRef.current = false;
      } else {
        localStorage.removeItem(storageKey(workoutId));
      }
    } catch {
      // Corrupt or blocked storage — start fresh.
    }
  }, [workoutId]);

  // Start on every logged set. The Log tap is the user gesture that lets us
  // unlock audio for the ring later.
  useEffect(() => {
    function onSetLogged() {
      ensureAudio();
      const seconds = defaultRef.current;
      const target = Date.now() + seconds * 1000;
      setEndsAt(target);
      setDuration(seconds);
      setDone(false);
      firedRef.current = false;
      try {
        localStorage.setItem(storageKey(workoutId), JSON.stringify({ endsAt: target, duration: seconds }));
      } catch {}
    }
    window.addEventListener(SET_LOGGED_EVENT, onSetLogged);
    return () => window.removeEventListener(SET_LOGGED_EVENT, onSetLogged);
  }, [workoutId]);

  useEffect(() => {
    if (endsAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [endsAt]);

  const remainingMs = endsAt != null ? endsAt - now : 0;
  const remaining = Math.ceil(remainingMs / 1000);

  // Ring once when the countdown crosses zero.
  useEffect(() => {
    if (endsAt == null || remainingMs > 0 || firedRef.current) return;
    firedRef.current = true;
    setDone(true);
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {}
    beep();
    try {
      localStorage.removeItem(storageKey(workoutId));
    } catch {}
    const hide = window.setTimeout(() => {
      setEndsAt(null);
      setDone(false);
    }, 6000);
    return () => window.clearTimeout(hide);
  }, [endsAt, remainingMs, workoutId]);

  function adjust(deltaSeconds: number) {
    if (endsAt == null || done) return;
    const target = Math.max(Date.now() + 1000, endsAt + deltaSeconds * 1000);
    setEndsAt(target);
    setDuration((d) => Math.max(1, d + deltaSeconds));
    try {
      localStorage.setItem(
        storageKey(workoutId),
        JSON.stringify({ endsAt: target, duration: duration + deltaSeconds }),
      );
    } catch {}
  }

  function dismiss() {
    setEndsAt(null);
    setDone(false);
    try {
      localStorage.removeItem(storageKey(workoutId));
    } catch {}
  }

  if (endsAt == null) return null;

  const progress = done ? 1 : Math.min(1, Math.max(0, 1 - remainingMs / (duration * 1000)));

  return (
    <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] sm:bottom-0 inset-x-0 z-40">
      <div
        className={`border-t backdrop-blur ${
          done ? 'border-emerald-600 bg-emerald-950/90' : 'border-zinc-800 bg-zinc-950/95'
        }`}
      >
        <div className="h-0.5 bg-zinc-800">
          <div
            className={`h-full transition-[width] duration-300 ${done ? 'bg-emerald-400' : 'bg-indigo-500'}`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <span className={`text-sm font-medium ${done ? 'text-emerald-300' : 'text-zinc-300'}`}>
            {done ? 'Rest over — go!' : 'Rest'}
          </span>
          {!done && (
            <span className="text-lg font-semibold tabular-nums text-zinc-100">{fmtClock(remaining)}</span>
          )}
          <div className="ml-auto flex items-center gap-1.5 text-sm">
            {!done && (
              <>
                <button
                  type="button"
                  onClick={() => adjust(-STEP)}
                  className="px-2.5 py-1 rounded-md border border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                >
                  −{STEP}s
                </button>
                <button
                  type="button"
                  onClick={() => adjust(STEP)}
                  className="px-2.5 py-1 rounded-md border border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                >
                  +{STEP}s
                </button>
              </>
            )}
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss rest timer"
              className="px-2.5 py-1 rounded-md border border-zinc-700 hover:bg-zinc-800 text-zinc-400"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
