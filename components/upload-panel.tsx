"use client";

import { useId, useRef, useState } from "react";
import type { PhotoKind } from "@/lib/db/schema";
import { prepareUpload, saveUpload, type UploadResult } from "@/app/actions";
import { fileSize } from "@/lib/format";

const MAX_BYTES = 20 * 1024 * 1024; // the Cloudinary plan's image limit
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const PARALLEL = 3;

type Item = {
  key: string;
  name: string;
  size: number;
  progress: number; // 0..1
  status: "waiting" | "uploading" | "saving" | "done" | "failed";
  error?: string;
};

const CHOICES: { value: PhotoKind | null; label: string }[] = [
  { value: null, label: "Decide later" },
  { value: "interior", label: "Interior" },
  { value: "exterior", label: "Exterior" },
];

export function UploadPanel({ houseId }: { houseId: string }) {
  const [kind, setKind] = useState<PhotoKind | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();

  const patch = (key: string, p: Partial<Item>) =>
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...p } : it)));

  async function uploadOne(file: File, key: string, batchKind: PhotoKind | null) {
    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
      return patch(key, { status: "failed", error: "Not a photo. Use JPEG, PNG, WebP or HEIC." });
    }
    if (file.size > MAX_BYTES) {
      return patch(key, { status: "failed", error: `Too large (${fileSize(file.size)}). The limit is 20 MB.` });
    }
    const ticket = await prepareUpload(houseId);
    if (!ticket.ok) return patch(key, { status: "failed", error: ticket.error });

    patch(key, { status: "uploading" });
    let result: UploadResult;
    try {
      result = await sendToCloudinary(file, ticket, (p) => patch(key, { progress: p }));
    } catch (e) {
      return patch(key, { status: "failed", error: (e as Error).message });
    }

    patch(key, { status: "saving", progress: 1 });
    const saved = await saveUpload(houseId, ticket.photoId, result, batchKind);
    patch(key, saved.ok ? { status: "done" } : { status: "failed", error: saved.error });
  }

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    const batchKind = kind;
    const queued = list.map((f) => ({ file: f, key: `${f.name}-${f.size}-${crypto.randomUUID()}` }));
    setItems((cur) => [
      ...cur.filter((it) => it.status !== "done"),
      ...queued.map(({ file, key }) => ({ key, name: file.name, size: file.size, progress: 0, status: "waiting" as const })),
    ]);
    let next = 0;
    const worker = async () => {
      while (next < queued.length) {
        const { file, key } = queued[next++];
        await uploadOne(file, key, batchKind);
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, queued.length) }, worker));
  }

  const busy = items.some((it) => it.status === "waiting" || it.status === "uploading" || it.status === "saving");
  const done = items.filter((it) => it.status === "done").length;

  return (
    <section aria-labelledby="upload-heading" className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="upload-heading" className="text-lg font-semibold tracking-tight">
          Add photos
        </h2>
        <div role="radiogroup" aria-label="Mark new photos as" className="flex items-center gap-1 text-sm">
          <span className="mr-2 text-slate-soft">Mark new photos as</span>
          {CHOICES.map((c) => (
            <button
              key={c.label}
              type="button"
              role="radio"
              aria-checked={kind === c.value}
              onClick={() => setKind(c.value)}
              className={`rounded-[var(--radius-control)] px-2.5 py-1.5 font-medium transition-colors ${
                kind === c.value
                  ? c.value === "interior"
                    ? "bg-walnut text-trim"
                    : c.value === "exterior"
                      ? "bg-sky text-trim"
                      : "bg-slate text-trim"
                  : "text-slate hover:bg-plaster"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`mt-3 flex flex-col items-center justify-center gap-3 rounded-[var(--radius-control)] border-2 border-dashed px-6 py-10 text-center transition-colors ${
          over ? "border-slate bg-plaster" : "border-wall"
        }`}
      >
        <p className="text-slate-soft" id={hintId}>
          Drop listing photos here. JPEG, PNG, WebP or HEIC, up to 20 MB each.
        </p>
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-describedby={hintId}
          className="rounded-[var(--radius-control)] bg-slate px-4 py-2.5 font-medium text-trim hover:bg-slate/90 active:translate-y-px"
        >
          Choose photos
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <div className="mt-4" aria-live="polite">
          <p className="text-sm text-slate-soft">
            {busy ? `Uploading ${done} of ${items.length}…` : `${done} of ${items.length} uploaded.`}
          </p>
          <ul className="mt-2 space-y-1.5">
            {items
              .filter((it) => it.status !== "done" || busy)
              .map((it) => (
                <li key={it.key} className="grid grid-cols-[1fr_auto] items-center gap-x-4 text-sm">
                  <span className="truncate">{it.name}</span>
                  <span className={it.status === "failed" ? "text-alarm" : "text-slate-soft"}>
                    {label(it)}
                  </span>
                  {it.status !== "failed" && it.status !== "done" && (
                    <span className="col-span-2 mt-1 h-1 overflow-hidden rounded-full bg-plaster">
                      <span
                        className="block h-full bg-slate transition-[width]"
                        style={{ width: `${Math.round(it.progress * 100)}%` }}
                      />
                    </span>
                  )}
                  {it.error && <span className="col-span-2 text-alarm">{it.error}</span>}
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function label(it: Item) {
  switch (it.status) {
    case "waiting":
      return "Waiting";
    case "uploading":
      return `${Math.round(it.progress * 100)}%`;
    case "saving":
      return "Saving";
    case "done":
      return "Added";
    case "failed":
      return "Not added";
  }
}

/** Posts one file straight to Cloudinary with the signed parameters, reporting progress. */
function sendToCloudinary(
  file: File,
  ticket: { cloudName: string; apiKey: string; params: Record<string, string | number>; signature: string },
  onProgress: (p: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append("file", file);
    body.append("api_key", ticket.apiKey);
    body.append("signature", ticket.signature);
    for (const [k, v] of Object.entries(ticket.params)) body.append(k, String(v));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${ticket.cloudName}/image/upload`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onerror = () => reject(new Error("The upload didn't reach Cloudinary. Check your connection and try again."));
    xhr.onload = () => {
      let json: (UploadResult & { error?: { message: string } }) | null = null;
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        /* not JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300 && json) resolve(json);
      else reject(new Error(json?.error?.message ?? `Cloudinary refused the upload (${xhr.status}).`));
    };
    xhr.send(body);
  });
}
