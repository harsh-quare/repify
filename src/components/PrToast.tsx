'use client';

import { useEffect, useRef, useState } from 'react';

// The emotional peak of the product: a logged set beat a personal record.
// SetLogger fires PR_EVENT; this shows a toast + a brief confetti burst.
// Confetti and vibration respect prefers-reduced-motion.

export const PR_EVENT = 'repify:pr';

const CONFETTI_COLORS = ['#818cf8', '#34d399', '#fbbf24', '#fb7185', '#e4e4e7'];
const TOAST_MS = 4000;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  vrot: number;
  life: number;
};

function burst(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);

  const originX = window.innerWidth / 2;
  const originY = 110;
  const particles: Particle[] = Array.from({ length: 90 }, () => ({
    x: originX,
    y: originY,
    vx: (Math.random() - 0.5) * 9,
    vy: -(2 + Math.random() * 7),
    size: 4 + Math.random() * 4,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    rot: Math.random() * Math.PI,
    vrot: (Math.random() - 0.5) * 0.3,
    life: 70 + Math.random() * 40,
  }));

  let frame = 0;
  let raf = 0;
  function tick() {
    frame++;
    ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight);
    let alive = false;
    for (const p of particles) {
      if (frame > p.life) continue;
      alive = true;
      p.vy += 0.22;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;
      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.globalAlpha = Math.max(0, 1 - frame / p.life);
      ctx!.fillStyle = p.color;
      ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx!.restore();
    }
    if (alive) raf = requestAnimationFrame(tick);
    else ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

export function PrToast() {
  const [labels, setLabels] = useState<string[] | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let hideTimer = 0;
    function onPr(e: Event) {
      const detail = (e as CustomEvent<string[]>).detail;
      if (!detail || detail.length === 0) return;
      setLabels(detail);
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reduced) {
        try {
          navigator.vibrate?.([100, 50, 100]);
        } catch {}
        if (canvasRef.current) {
          cleanupRef.current?.();
          cleanupRef.current = burst(canvasRef.current);
        }
      }
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setLabels(null), TOAST_MS);
    }
    window.addEventListener(PR_EVENT, onPr);
    return () => {
      window.removeEventListener(PR_EVENT, onPr);
      window.clearTimeout(hideTimer);
      cleanupRef.current?.();
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className={`fixed inset-0 z-50 pointer-events-none ${labels ? '' : 'hidden'}`}
        aria-hidden
      />
      {labels && (
        <div className="fixed top-16 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
          <div
            role="status"
            className="pointer-events-auto rounded-full border border-indigo-400 bg-indigo-500 text-white shadow-xl px-5 py-2.5 text-sm font-medium"
          >
            🏆 New PR — {labels.join(' · ')}
          </div>
        </div>
      )}
    </>
  );
}
