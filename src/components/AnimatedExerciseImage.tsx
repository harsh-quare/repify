'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

// Free Exercise DB ships two static frames per exercise (start + end).
// We alternate them client-side at 700ms to approximate animation.
export function AnimatedExerciseImage({
  urls,
  alt,
  className,
}: {
  urls: string[];
  alt: string;
  className?: string;
}) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (urls.length < 2) return;
    const id = window.setInterval(() => setIdx((i) => (i + 1) % urls.length), 700);
    return () => window.clearInterval(id);
  }, [urls.length]);

  if (urls.length === 0) {
    return (
      <div className={`bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-500 text-xs ${className ?? ''}`}>
        no image
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden rounded-lg bg-zinc-800 ${className ?? ''}`}>
      <Image
        src={urls[idx]}
        alt={alt}
        fill
        sizes="(max-width: 768px) 50vw, 25vw"
        className="object-cover"
        unoptimized
      />
    </div>
  );
}
