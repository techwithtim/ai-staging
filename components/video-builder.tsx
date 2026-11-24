"use client";

import { useId, useState, useTransition } from "react";
import Image from "next/image";
import { createListingVideo, deleteListingVideo } from "@/app/video-actions";
import { imageSrc, videoPoster, videoUrl } from "@/lib/cloudinary/urls";
import { fileSize } from "@/lib/format";

type Asset = { publicId: string; version: number };
export type BuilderPhoto = {
  id: string;
  asset: Asset;
  caption: string;
  badge: string | null;
  selected: boolean;
};
type BuilderVideo = {
  id: string;
  status: "running" | "done" | "failed";
  error: string | null;
  seconds: number | null;
  bytes: number | null;
  createdAt: string;
  photoCount: number;
  asset: Asset | null;
};

const MAX = 10;
const PACE = [
  { value: 2.5, label: "Quick", detail: "2.5 s a room" },
  { value: 3, label: "Steady", detail: "3 s a room" },
  { value: 4, label: "Slow", detail: "4 s a room" },
];

export function VideoBuilder({
  houseId,
  title,
  photos,
  videos,
}: {
  houseId: string;
  title: { address: string; facts: string };
  photos: BuilderPhoto[];
  videos: BuilderVideo[];
}) {
  // Order of every photo; the chosen ones play in this order.
  const [order, setOrder] = useState(photos.map((p) => p.id));
  const [chosen, setChosen] = useState(() => new Set(photos.filter((p) => p.selected).map((p) => p.id)));
  const [framing, setFraming] = useState<"fill" | "whole">("fill");
  const [pace, setPace] = useState(3);
  const [showTitle, setShowTitle] = useState(true);
  const [showCaptions, setShowCaptions] = useState(true);
  const [closing, setClosing] = useState("Book a showing");
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(videos.find((v) => v.asset)?.id ?? null);
  const [making, startMaking] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const closingId = useId();

  const byId = new Map(photos.map((p) => [p.id, p]));
  const sequence = order.filter((id) => chosen.has(id)).map((id) => byId.get(id)!);
  const seconds = sequence.length * pace;
  const current = videos.find((v) => v.id === playing && v.asset) ?? null;

  function move(id: string, by: -1 | 1) {
    setOrder((o) => {
      const i = o.indexOf(id);
      const j = i + by;
      if (j < 0 || j >= o.length) return o;
      const next = [...o];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function toggle(id: string) {
    setChosen((c) => {
      const next = new Set(c);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX) next.add(id);
      else setError(`Use up to ${MAX} photos.`);
      return next;
    });
  }

  function make() {
    setError(null);
    startMaking(async () => {
      const res = await createListingVideo(houseId, {
        photoIds: sequence.map((p) => p.id),
        framing,
        secondsPerShot: pace,
        showTitle,
        showCaptions,
        closing,
      });
      if (res.ok) setPlaying(res.videoId);
      else setError(res.error);
    });
  }

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[22rem_minmax(0,1fr)]">
      {/* Phone preview: the latest video, or the first chosen photo with the title card. */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="mx-auto w-full max-w-[20rem] rounded-[2.25rem] bg-slate p-2.5 shadow-[0_20px_50px_-20px_rgba(38,44,49,0.6)]">
          <div className="relative aspect-[9/16] overflow-hidden rounded-[1.75rem] bg-black">
            {current?.asset ? (
              <video
                key={current.id}
                src={videoUrl(current.asset)}
                poster={videoPoster(current.asset)}
                controls
                playsInline
                loop
                className="h-full w-full object-cover"
              />
            ) : sequence[0] ? (
              <>
                <Image
                  src={imageSrc(sequence[0].asset)}
                  alt=""
                  fill
                  sizes="320px"
                  className={framing === "fill" ? "object-cover" : "object-contain"}
                />
                {showTitle && (
                  <div className="absolute inset-x-0 top-[12%] flex flex-col items-center gap-1 px-4 text-center text-trim">
                    <span className="bg-black/45 px-1.5 text-lg font-bold">{title.address}</span>
                    {title.facts && <span className="bg-black/45 px-1.5 text-xs">{title.facts}</span>}
                  </div>
                )}
                {making && (
                  <div className="absolute inset-0 grid place-items-center bg-slate/60 text-center text-sm text-trim">
                    <span className="animate-pulse px-6">Cloudinary is making your video…</span>
                  </div>
                )}
              </>
            ) : (
              <p className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-trim/70">Pick photos to preview</p>
            )}
          </div>
        </div>
        <p className="mt-3 text-center text-sm text-slate-soft">
          {current ? "Your latest video" : "Preview of the opening shot"}, 1080 × 1920
        </p>
      </div>

      <div className="space-y-10">
        <section aria-labelledby="shots-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="shots-heading" className="text-lg font-semibold tracking-tight">
              Rooms in the video
            </h2>
            <p className="text-sm text-slate-soft">
              {sequence.length} of {MAX}, {seconds % 1 ? seconds.toFixed(1) : seconds} seconds
            </p>
          </div>
          <p className="mt-1 text-sm text-slate-soft">Each photo plays in its gallery version. Staged, dusk and cleaned-up photos start ticked.</p>
          <ol className="mt-3 divide-y divide-wall border-y border-wall">
            {order.map((id, i) => {
              const p = byId.get(id)!;
              const on = chosen.has(id);
              const n = on ? sequence.findIndex((s) => s.id === id) + 1 : null;
              return (
                <li key={id} className={`flex items-center gap-3 py-2 ${on ? "" : "opacity-55"}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={making}
                    onChange={() => toggle(id)}
                    aria-label={`Include ${p.caption}`}
                    className="size-4 accent-slate"
                  />
                  <div className="relative aspect-[4/3] w-16 shrink-0 overflow-hidden rounded-[var(--radius-photo)] bg-plaster">
                    <Image src={imageSrc(p.asset)} alt="" fill sizes="64px" className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">
                      {n ? <span className="mr-1.5 text-slate-soft">{n}.</span> : null}
                      {p.caption}
                    </p>
                    {p.badge && <p className="text-slate-soft">{p.badge}</p>}
                  </div>
                  <div className="flex shrink-0">
                    <button
                      type="button"
                      onClick={() => move(id, -1)}
                      disabled={making || i === 0}
                      aria-label={`Move ${p.caption} earlier`}
                      className="grid size-9 place-items-center rounded-[var(--radius-control)] hover:bg-plaster disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(id, 1)}
                      disabled={making || i === order.length - 1}
                      aria-label={`Move ${p.caption} later`}
                      className="grid size-9 place-items-center rounded-[var(--radius-control)] hover:bg-plaster disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="look-heading" className="grid gap-6 sm:grid-cols-2">
          <h2 id="look-heading" className="sr-only">
            How it looks
          </h2>
          <fieldset>
            <legend className="text-sm font-medium">Framing</legend>
            <div className="mt-1.5 grid gap-1.5">
              {(
                [
                  ["fill", "Fill the screen", "Crops to vertical with a slow push-in"],
                  ["whole", "Show the whole room", "Full photo on a blurred background"],
                ] as const
              ).map(([value, label, detail]) => (
                <Choice key={value} name="framing" checked={framing === value} disabled={making} onChange={() => setFraming(value)}>
                  <span className="block font-medium">{label}</span>
                  <span className={framing === value ? "text-trim/80" : "text-slate-soft"}>{detail}</span>
                </Choice>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium">Pace</legend>
            <div className="mt-1.5 grid gap-1.5">
              {PACE.map((p) => (
                <Choice key={p.value} name="pace" checked={pace === p.value} disabled={making} onChange={() => setPace(p.value)}>
                  <span className="font-medium">{p.label}</span>{" "}
                  <span className={pace === p.value ? "text-trim/80" : "text-slate-soft"}>{p.detail}</span>
                </Choice>
              ))}
            </div>
          </fieldset>
          <div className="space-y-2.5 text-sm sm:col-span-2">
            <label className="flex items-center gap-2.5">
              <input type="checkbox" checked={showTitle} disabled={making} onChange={(e) => setShowTitle(e.target.checked)} className="size-4 accent-slate" />
              Open with the address and listing details
            </label>
            <label className="flex items-center gap-2.5">
              <input type="checkbox" checked={showCaptions} disabled={making} onChange={(e) => setShowCaptions(e.target.checked)} className="size-4 accent-slate" />
              Name each room
            </label>
            <div>
              <label htmlFor={closingId} className="font-medium">
                Closing line <span className="font-normal text-slate-soft">Optional</span>
              </label>
              <input
                id={closingId}
                value={closing}
                maxLength={40}
                disabled={making}
                onChange={(e) => setClosing(e.target.value)}
                placeholder="Book a showing"
                className="mt-1.5 block w-full rounded-[var(--radius-control)] border border-wall bg-white px-3 py-2 text-base text-slate placeholder:text-slate-soft/60 focus:border-slate focus:outline-none"
              />
            </div>
          </div>
        </section>

        <div>
          <button
            type="button"
            onClick={make}
            disabled={making || !sequence.length}
            className="w-full rounded-[var(--radius-control)] bg-slate px-4 py-3 font-medium text-trim hover:bg-slate/90 active:translate-y-px disabled:opacity-50"
          >
            {making ? "Making video…" : `Make a ${seconds % 1 ? seconds.toFixed(1) : seconds}-second video`}
          </button>
          <p className="mt-2 text-sm text-slate-soft" aria-live="polite">
            {making
              ? "Cloudinary is animating each room and joining them. Usually under a minute."
              : "Uses Cloudinary video processing, not Image Generation credits."}
          </p>
          {error && (
            <p role="alert" className="mt-2 text-sm text-alarm">
              {error}
            </p>
          )}
        </div>

        {videos.length > 0 && (
          <section aria-labelledby="videos-heading">
            <h2 id="videos-heading" className="text-lg font-semibold tracking-tight">
              Your videos
            </h2>
            <ul className="mt-3 divide-y divide-wall border-y border-wall">
              {videos.map((v, i) => (
                <li key={v.id} className="flex items-center gap-3 py-3 text-sm">
                  <button
                    type="button"
                    disabled={!v.asset}
                    onClick={() => setPlaying(v.id)}
                    aria-pressed={playing === v.id}
                    aria-label={`Play video ${videos.length - i}`}
                    className={`relative aspect-[9/16] w-12 shrink-0 overflow-hidden rounded-[var(--radius-photo)] bg-plaster outline-offset-2 ${
                      playing === v.id ? "outline-2 outline-slate" : ""
                    }`}
                  >
                    {v.asset && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={videoPoster(v.asset)} alt="" className="h-full w-full object-cover" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">Video {videos.length - i}</p>
                    <p className="text-slate-soft">
                      {v.status === "running"
                        ? "Being made…"
                        : v.status === "failed"
                          ? v.error
                          : `${v.photoCount} rooms, ${Math.round(v.seconds ?? 0)} seconds${v.bytes ? `, ${fileSize(v.bytes)}` : ""}`}
                    </p>
                  </div>
                  {v.asset && (
                    <a href={videoUrl(v.asset, true)} className="underline underline-offset-4 hover:no-underline">
                      Download
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={deleting || v.status === "running"}
                    onClick={() => {
                      if (!confirm(`Delete video ${videos.length - i}? It's removed from Cloudinary too.`)) return;
                      startDeleting(async () => {
                        const res = await deleteListingVideo(v.id);
                        if (res?.error) setError(res.error);
                      });
                    }}
                    className="text-slate-soft underline underline-offset-4 hover:text-alarm disabled:opacity-50"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function Choice({
  name,
  checked,
  disabled,
  onChange,
  children,
}: {
  name: string;
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`cursor-pointer rounded-[var(--radius-control)] border px-3 py-2 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-slate ${
        checked ? "border-slate bg-slate text-trim" : "border-wall bg-white hover:border-slate"
      }`}
    >
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}
