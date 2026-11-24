"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Photo, PhotoKind } from "@/lib/db/schema";
import type { GalleryPhoto } from "@/lib/db/queries";
import { roomsFor } from "@/lib/rooms";
import { imageSrc, originalUrl } from "@/lib/cloudinary/urls";
import { deletePhoto, setPhotoKind, setPhotoRoom } from "@/app/actions";

const EDIT_BADGE = { cleanup: "Cleaned up", stage: "Staged", dusk: "Dusk" } as const;

const KINDS: { kind: PhotoKind; label: string; on: string }[] = [
  { kind: "interior", label: "Interior", on: "bg-walnut text-trim border-walnut" },
  { kind: "exterior", label: "Exterior", on: "bg-sky text-trim border-sky" },
];

export function PhotoTile({ photo, sizes, priority }: { photo: GalleryPhoto; sizes: string; priority?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const viewer = useRef<HTMLDialogElement>(null);
  const name = photo.originalFilename ?? "Listing photo";

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      setError(null);
      try {
        const res = (await fn()) as { error?: string } | undefined;
        if (res?.error) setError(res.error);
      } catch (e) {
        setError((e as Error).message);
      }
    });

  return (
    <figure className={`transition-opacity ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
      <button
        type="button"
        onClick={() => viewer.current?.showModal()}
        className="group relative block aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-photo)] bg-plaster"
        aria-label={`View ${name} larger`}
      >
        <Image
          src={imageSrc(photo.display)}
          alt={name}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        {photo.edited && (
          <span className="absolute top-2 left-2 rounded-[var(--radius-control)] bg-slate/75 px-2 py-0.5 text-sm text-trim">
            {EDIT_BADGE[photo.editType ?? "cleanup"]}
          </span>
        )}
      </button>

      <figcaption className="mt-2.5 space-y-2">
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Inside or outside" className="flex shrink-0">
            {KINDS.map(({ kind, label, on }, i) => {
              const active = photo.kind === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={active}
                  disabled={pending}
                  onClick={() => run(() => setPhotoKind(photo.id, active ? null : kind))}
                  className={`border px-2.5 py-1.5 text-sm font-medium transition-colors ${
                    i === 0 ? "rounded-l-[var(--radius-control)]" : "-ml-px rounded-r-[var(--radius-control)]"
                  } ${active ? on : "border-wall bg-white text-slate hover:bg-plaster"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <RoomSelect photo={photo} disabled={pending} onPick={(room) => run(() => setPhotoRoom(photo.id, room))} />
        </div>
        <p className="flex gap-4 text-sm">
          <Link
            href={`/houses/${photo.houseId}/photos/${photo.id}`}
            className="text-slate underline underline-offset-4 hover:no-underline"
          >
            Clean up
          </Link>
          <Link
            href={`/houses/${photo.houseId}/photos/${photo.id}?tool=stage`}
            className="text-slate underline underline-offset-4 hover:no-underline"
          >
            Stage
          </Link>
          <Link
            href={`/houses/${photo.houseId}/photos/${photo.id}?tool=dusk`}
            className="text-slate underline underline-offset-4 hover:no-underline"
          >
            Dusk
          </Link>
        </p>
        {error && (
          <p role="alert" className="text-sm text-alarm">
            {error}
          </p>
        )}
      </figcaption>

      <dialog
        ref={viewer}
        className="m-auto max-h-[92dvh] w-[min(92vw,1400px)] bg-transparent p-0 backdrop:bg-slate/85"
        onClick={(e) => e.target === e.currentTarget && viewer.current?.close()}
      >
        <div className="relative aspect-[4/3] max-h-[78dvh] w-full">
          <Image
            src={imageSrc(photo.display)}
            alt={name}
            fill
            sizes="(min-width: 1520px) 1400px, 92vw"
            className="object-contain"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-trim">
          <span className="mr-auto truncate">
            {name}{photo.edited ? `, ${EDIT_BADGE[photo.editType ?? "cleanup"].toLowerCase()}` : ""}, {photo.display.width} × {photo.display.height}
          </span>
          <a href={originalUrl(photo.display)} className="underline underline-offset-4 hover:no-underline">
            Download
          </a>
          <Link href={`/houses/${photo.houseId}/photos/${photo.id}`} className="underline underline-offset-4 hover:no-underline">
            Edit
          </Link>
          <button
            type="button"
            className="underline underline-offset-4 hover:no-underline"
            onClick={() => {
              if (!confirm(`Delete ${name}? It's removed from Cloudinary too, and this can't be undone.`)) return;
              viewer.current?.close();
              run(() => deletePhoto(photo.id));
            }}
          >
            Delete photo
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => viewer.current?.close()}
            className="rounded-[var(--radius-control)] bg-trim px-3 py-1.5 font-medium text-slate"
          >
            Close
          </button>
        </div>
      </dialog>
    </figure>
  );
}

function RoomSelect({
  photo,
  disabled,
  onPick,
}: {
  photo: Photo;
  disabled: boolean;
  onPick: (room: string | null) => void;
}) {
  const kinds: PhotoKind[] = photo.kind ? [photo.kind] : ["interior", "exterior"];
  return (
    <label className="min-w-0 flex-1">
      <span className="sr-only">Room</span>
      <select
        value={photo.room ?? ""}
        disabled={disabled}
        onChange={(e) => onPick(e.target.value || null)}
        className="w-full truncate rounded-[var(--radius-control)] border border-wall bg-white px-2 py-1.5 text-sm text-slate hover:bg-plaster"
      >
        <option value="">{photo.kind === "exterior" ? "Pick an area" : "Pick a room"}</option>
        {kinds.map((k) => (
          <optgroup key={k} label={k === "interior" ? "Interior" : "Exterior"}>
            {roomsFor(k).map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
