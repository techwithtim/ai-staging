"use client";

import { useRef, useState } from "react";
import Image from "next/image";

const card =
  "group flex h-full flex-col overflow-hidden rounded-[10px] bg-[#2f363c] ring-1 ring-white/8 transition duration-300 hover:-translate-y-0.5 hover:ring-white/20";

/** A tool shown by its real result; the button flips to the photo it started from. */
export function ToolCard({
  title,
  body,
  before,
  after,
  alt,
}: {
  title: string;
  body: string;
  before: string;
  after: string;
  alt: string;
}) {
  const [showBefore, setShowBefore] = useState(false);
  return (
    <article className={card}>
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={after}
          alt={`${alt}, after`}
          fill
          sizes="(min-width: 1024px) 540px, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.025]"
        />
        <Image
          src={before}
          alt={`${alt}, before`}
          fill
          sizes="(min-width: 1024px) 540px, (min-width: 640px) 50vw, 100vw"
          className={`object-cover transition-opacity duration-300 ${showBefore ? "opacity-100" : "opacity-0"}`}
        />
        <button
          type="button"
          aria-pressed={showBefore}
          onClick={() => setShowBefore((v) => !v)}
          className="absolute right-3 bottom-3 rounded-full bg-trim/90 px-3.5 py-2 text-sm font-medium text-slate backdrop-blur transition hover:bg-trim active:scale-95"
        >
          {showBefore ? "See after" : "See before"}
        </button>
      </div>
      <div className="p-6">
        <h3 className="text-xl font-semibold tracking-tight text-trim">{title}</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-trim/70">{body}</p>
      </div>
    </article>
  );
}

/** The video tool shows the real video the app made, muted, with a pause control. */
export function VideoCard({ title, body, src, poster }: { title: string; body: string; src: string; poster: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  return (
    <article className={card}>
      <div className="relative grid aspect-[4/3] place-items-center overflow-hidden bg-[#1c2226]">
        <video
          ref={video}
          src={src}
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          aria-label="A 12-second vertical listing video made by the app"
          className="absolute top-[4%] left-1/2 aspect-[9/16] h-[92%] w-auto -translate-x-1/2 rounded-[14px] object-cover shadow-2xl ring-4 ring-black/40"
        />
        <button
          type="button"
          aria-pressed={paused}
          onClick={() => {
            const v = video.current;
            if (!v) return;
            if (v.paused) {
              v.play();
              setPaused(false);
            } else {
              v.pause();
              setPaused(true);
            }
          }}
          className="absolute right-3 bottom-3 rounded-full bg-trim/90 px-3.5 py-2 text-sm font-medium text-slate backdrop-blur transition hover:bg-trim active:scale-95"
        >
          {paused ? "Play video" : "Pause video"}
        </button>
      </div>
      <div className="p-6">
        <h3 className="text-xl font-semibold tracking-tight text-trim">{title}</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-trim/70">{body}</p>
      </div>
    </article>
  );
}
