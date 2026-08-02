"use client";

import { useEffect, useState } from "react";

/** Animates its fill in from 0 on mount; snaps instantly under prefers-reduced-motion. */
export function CostShareBar({ share }: { share: number }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setWidth(share * 100));
    return () => cancelAnimationFrame(raf);
  }, [share]);

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-(--color-surface-alt)">
      <div
        className="h-full rounded-full bg-(--color-accent) transition-[width] duration-500 motion-reduce:transition-none"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
