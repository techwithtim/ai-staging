"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * The hero's before/after. On load the line sweeps once from the empty room to the middle, so the
 * first thing a visitor sees is the staging happen; after that it follows the pointer or arrow keys.
 */
export function HeroCompare({ before, after, alt }: { before: string; after: string; alt: string }) {
  const [pos, setPos] = useState(100);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (touched) return;
    // Under reduced motion the line jumps straight to the middle on the first frame.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const start = performance.now() + (reduce ? 0 : 500);
    const tick = (now: number) => {
      const t = reduce ? 1 : Math.min(1, Math.max(0, (now - start) / 1400));
      const ease = 1 - Math.pow(1 - t, 3);
      setPos(100 - ease * 55);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [touched]);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[10px] bg-plaster shadow-[0_30px_80px_-30px_rgba(38,44,49,0.55)]">
      <Image src={before} alt={`${alt}, empty`} fill priority sizes="(min-width: 1024px) 680px, 100vw" className="object-cover" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        <Image src={after} alt={`${alt}, virtually staged`} fill priority sizes="(min-width: 1024px) 680px, 100vw" className="object-cover" />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(pos)}
        onChange={(e) => {
          setTouched(true);
          setPos(Number(e.target.value));
        }}
        aria-label="Compare the empty room with the staged room"
        className="peer absolute inset-0 z-10 h-full w-full cursor-ew-resize opacity-0"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-trim peer-focus-visible:*:ring-2 peer-focus-visible:*:ring-slate"
        style={{ left: `${pos}%` }}
      >
        <span className="absolute top-1/2 left-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-trim text-lg text-slate shadow-lg">
          ⟷
        </span>
      </div>
      <span className="pointer-events-none absolute top-4 left-4 z-20 rounded-full bg-slate/70 px-3 py-1 text-sm text-trim backdrop-blur">
        Empty
      </span>
      <span className="pointer-events-none absolute top-4 right-4 z-20 rounded-full bg-trim/85 px-3 py-1 text-sm text-slate backdrop-blur">
        Staged
      </span>
    </div>
  );
}
