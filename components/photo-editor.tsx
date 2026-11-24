"use client";

import { useId, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import type { PhotoKind, StageQuality } from "@/lib/db/schema";
import type { GenerationBudget } from "@/lib/db/queries";
import { cleanupPhoto, deleteEdit, duskPhoto, retryEdit, setActiveEdit, stagePhoto } from "@/app/actions";
import { imageSrc, labelledUrl, originalUrl } from "@/lib/cloudinary/urls";
import { QUALITY, STAGEABLE_ROOMS, STYLES } from "@/lib/staging";
import { MOODS } from "@/lib/dusk";

type Asset = { publicId: string; version: number; format: string; width: number; height: number };
export type Tool = "cleanup" | "stage" | "dusk";
export type EditorEdit = {
  id: string;
  type: "cleanup" | "stage" | "dusk";
  sourceEditId: string | null;
  detail: string;
  status: "running" | "done" | "failed";
  error: string | null;
  creditsUsed: number | null;
  asset: Asset | null;
};
type EditorPhoto = {
  id: string;
  kind: PhotoKind | null;
  name: string;
  original: Asset;
  activeEditId: string | null;
  defaultRoom: string;
};
type Result = { ok: true; editId: string } | { ok: false; error: string };

export function PhotoEditor({
  initialTool,
  initialVersion,
  photo,
  edits,
  budget,
}: {
  initialTool: Tool;
  initialVersion?: string | null;
  photo: EditorPhoto;
  edits: EditorEdit[];
  budget: GenerationBudget;
}) {
  const [tool, setTool] = useState<Tool>(initialTool);
  const [selected, setSelected] = useState<string | null>(initialVersion ?? photo.activeEditId);
  const [error, setError] = useState<string | null>(null);
  const [running, startRun] = useTransition();
  const [saving, startSave] = useTransition();

  // "Cleanup 2", "Staging 1": numbered per tool, in the order they were made.
  const names = useMemo(() => {
    const out = new Map<string, string>();
    const count = { cleanup: 0, stage: 0, dusk: 0 };
    const word = { cleanup: "Cleanup", stage: "Staging", dusk: "Dusk" };
    for (const e of edits) out.set(e.id, `${word[e.type]} ${++count[e.type]}`);
    return out;
  }, [edits]);

  // A selected version that was deleted (or failed) falls back to the original.
  const current = edits.find((e) => e.id === selected && e.status === "done" && e.asset) ?? null;
  const workingOn = current ? names.get(current.id)! : null;

  function run(job: () => Promise<Result>) {
    setError(null);
    startRun(async () => {
      const res = await job();
      if (res.ok) setSelected(res.editId);
      else setError(res.error);
    });
  }

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_23rem]">
      <div>
        <Compare before={photo.original} after={current?.asset ?? null} name={photo.name} busy={running} />
        <p className="mt-3 text-sm text-slate-soft">
          {current
            ? `Drag the line to compare the original with ${workingOn!.toLowerCase()}.`
            : "This is the original photo. Clean it up, stage it or turn it to dusk to compare before and after."}
        </p>
      </div>

      <div className="space-y-10">
        <section aria-label="Tools">
          <div role="tablist" aria-label="Tool" className="grid grid-cols-3 rounded-[var(--radius-control)] bg-plaster p-1">
            {(["cleanup", "stage", "dusk"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                type="button"
                aria-selected={tool === t}
                onClick={() => {
                  setTool(t);
                  setError(null);
                }}
                className={`rounded-[calc(var(--radius-control)-2px)] px-3 py-2 font-medium transition-colors ${
                  tool === t ? "bg-white text-slate shadow-sm" : "text-slate-soft hover:text-slate"
                }`}
              >
                {TOOL_LABEL[t]}
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-soft">
            Working on <span className="font-medium text-slate">{workingOn ?? "the original"}</span>
            {workingOn && (
              <>
                {" "}
                <button type="button" onClick={() => setSelected(null)} className="underline underline-offset-4 hover:no-underline">
                  use the original
                </button>
              </>
            )}
          </p>

          <div role="tabpanel" className="mt-5">
            {tool === "cleanup" ? (
              <CleanupPanel
                kind={photo.kind}
                running={running}
                onRun={(items, removeShadow) => run(() => cleanupPhoto(photo.id, current?.id ?? null, items, removeShadow))}
                onError={setError}
              />
            ) : tool === "dusk" ? (
              <DuskPanel
                kind={photo.kind}
                budget={budget}
                running={running}
                onRun={(input) => run(() => duskPhoto(photo.id, current?.id ?? null, input))}
              />
            ) : (
              <StagePanel
                defaultRoom={photo.defaultRoom}
                budget={budget}
                running={running}
                fromCleanup={current?.type === "cleanup"}
                onRun={(input) => run(() => stagePhoto(photo.id, current?.id ?? null, input))}
              />
            )}
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm text-alarm">
              {error}
            </p>
          )}
        </section>

        <section aria-labelledby="versions-heading">
          <h2 id="versions-heading" className="text-lg font-semibold tracking-tight">
            Versions
          </h2>
          <ul className="mt-3 divide-y divide-wall border-y border-wall">
            <VersionRow
              label="Original"
              detail={photo.name}
              asset={photo.original}
              selected={!current}
              inGallery={!photo.activeEditId}
              disabled={running || saving}
              onSelect={() => setSelected(null)}
              onUseInGallery={() => startSave(() => setActiveEdit(photo.id, null))}
            />
            {edits.map((e) => (
              <VersionRow
                key={e.id}
                label={names.get(e.id)!}
                detail={`${e.detail}${e.sourceEditId && names.has(e.sourceEditId) ? `, from ${names.get(e.sourceEditId)}` : ""}`}
                cost={e.type !== "cleanup" && e.creditsUsed != null ? `${e.creditsUsed} credits` : null}
                asset={e.asset}
                label2={e.type === "stage" ? "Virtually staged" : e.type === "dusk" ? "Virtual twilight" : null}
                status={e.status}
                error={e.error}
                selected={current?.id === e.id}
                inGallery={photo.activeEditId === e.id}
                disabled={running || saving}
                onSelect={() => setSelected(e.id)}
                onUseInGallery={() => startSave(() => setActiveEdit(photo.id, e.id))}
                onRetry={() => run(() => retryEdit(e.id))}
                onDelete={() => {
                  if (!confirm(`Delete ${names.get(e.id)}? It's removed from Cloudinary too.`)) return;
                  startSave(async () => {
                    const res = await deleteEdit(e.id);
                    if (res?.error) setError(res.error);
                  });
                }}
              />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

const TOOL_LABEL: Record<Tool, string> = { cleanup: "Clean up", stage: "Stage", dusk: "Dusk" };

// ---------------------------------------------------------------- Clean up

const MAX_ITEMS = 6;
const SUGGESTIONS: Record<PhotoKind | "any", string[]> = {
  interior: ["TV", "bar stools", "boxes", "toys", "laundry basket", "shoes", "cords and cables", "fridge magnets", "framed photos", "trash can"],
  exterior: ["car", "garbage bins", "garden hose", "toys", "ladder", "for sale sign"],
  any: ["TV", "bar stools", "boxes", "toys", "car", "garbage bins"],
};

function CleanupPanel({
  kind,
  running,
  onRun,
  onError,
}: {
  kind: PhotoKind | null;
  running: boolean;
  onRun: (items: string[], removeShadow: boolean) => void;
  onError: (e: string | null) => void;
}) {
  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [removeShadow, setRemoveShadow] = useState(false);
  const inputId = useId();
  const suggestions = SUGGESTIONS[kind ?? "any"].filter((s) => !items.includes(s));

  function add(raw: string) {
    const v = raw.trim().replace(/\s+/g, " ");
    if (!v) return;
    if (items.length >= MAX_ITEMS) return onError(`Remove up to ${MAX_ITEMS} things at a time.`);
    if (!items.some((i) => i.toLowerCase() === v.toLowerCase())) setItems([...items, v]);
    setDraft("");
    onError(null);
  }

  function submit() {
    const list = draft.trim() ? [...items, draft.trim()] : items;
    if (!list.length) return onError("Add at least one thing to remove, like “TV” or “bar stools”.");
    setItems([]);
    setDraft("");
    onRun(list, removeShadow);
  }

  return (
    <>
      <h2 className="text-lg font-semibold tracking-tight">What should go?</h2>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add(draft);
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Something to remove
        </label>
        <input
          id={inputId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={running}
          maxLength={40}
          placeholder="TV, bar stool, boxes…"
          className="min-w-0 flex-1 rounded-[var(--radius-control)] border border-wall bg-white px-3 py-2 text-slate placeholder:text-slate-soft/60 focus:border-slate focus:outline-none"
        />
        <button
          type="submit"
          disabled={running || !draft.trim()}
          className="rounded-[var(--radius-control)] border border-wall bg-white px-3 py-2 font-medium hover:bg-plaster disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {items.length > 0 && (
        <ul aria-label="Will be removed" className="mt-3 flex flex-wrap gap-2">
          {items.map((it) => (
            <li key={it}>
              <button
                type="button"
                disabled={running}
                onClick={() => setItems(items.filter((x) => x !== it))}
                aria-label={`Keep ${it}`}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-slate px-2.5 py-1 text-sm text-trim hover:bg-slate/85"
              >
                {it}
                <span aria-hidden>×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {suggestions.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-slate-soft">Common in {kind ? `${kind} ` : ""}photos</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={running}
                onClick={() => add(s)}
                className="rounded-[var(--radius-control)] border border-wall bg-white px-2.5 py-1 text-sm hover:border-slate disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="mt-5 flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={removeShadow}
          disabled={running}
          onChange={(e) => setRemoveShadow(e.target.checked)}
          className="size-4 accent-slate"
        />
        Remove their shadows too
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={running || (!items.length && !draft.trim())}
        className="mt-5 w-full rounded-[var(--radius-control)] bg-slate px-4 py-3 font-medium text-trim hover:bg-slate/90 active:translate-y-px disabled:opacity-50"
      >
        {running ? "Working…" : items.length > 1 ? `Remove ${items.length} things` : "Remove"}
      </button>
      <p className="mt-2 text-sm text-slate-soft" aria-live="polite">
        {running
          ? "Cloudinary is working on it. This usually takes 15 to 40 seconds."
          : "Works best on separate objects like a TV, bar stools or boxes. About 0.05 Cloudinary credits each."}
      </p>
    </>
  );
}

// ---------------------------------------------------------------- Stage

function StagePanel({
  defaultRoom,
  budget,
  running,
  fromCleanup,
  onRun,
}: {
  defaultRoom: string;
  budget: GenerationBudget;
  running: boolean;
  fromCleanup: boolean;
  onRun: (input: { room: string; style: string; notes: string; quality: StageQuality }) => void;
}) {
  const [room, setRoom] = useState(defaultRoom);
  const [style, setStyle] = useState(STYLES[0].slug);
  const [notes, setNotes] = useState("");
  const [quality, setQuality] = useState<StageQuality>("draft");
  const roomId = useId();
  const notesId = useId();
  const short = budget.remaining != null && budget.remaining < budget.costs[quality];

  return (
    <>
      <h2 className="text-lg font-semibold tracking-tight">Furnish this room</h2>
      {!fromCleanup && (
        <p className="mt-1 text-sm text-slate-soft">Works best on an empty room. Clear out furniture first with Clean up.</p>
      )}

      <label htmlFor={roomId} className="mt-4 block text-sm font-medium">
        Room
      </label>
      <select
        id={roomId}
        value={room}
        disabled={running}
        onChange={(e) => setRoom(e.target.value)}
        className="mt-1.5 w-full rounded-[var(--radius-control)] border border-wall bg-white px-2.5 py-2 text-slate"
      >
        {(["interior", "exterior"] as const).map((k) => (
          <optgroup key={k} label={k === "interior" ? "Interior" : "Exterior"}>
            {STAGEABLE_ROOMS.filter((r) => r.kind === k).map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium">Style</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {STYLES.map((s) => (
            <label
              key={s.slug}
              title={s.look}
              className={`cursor-pointer rounded-[var(--radius-control)] border px-3 py-2 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-slate ${
                style === s.slug ? "border-slate bg-slate text-trim" : "border-wall bg-white hover:border-slate"
              }`}
            >
              <input
                type="radio"
                name="style"
                value={s.slug}
                checked={style === s.slug}
                disabled={running}
                onChange={() => setStyle(s.slug)}
                className="sr-only"
              />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor={notesId} className="mt-5 block text-sm font-medium">
        Anything specific? <span className="font-normal text-slate-soft">Optional</span>
      </label>
      <textarea
        id={notesId}
        value={notes}
        disabled={running}
        maxLength={300}
        rows={2}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="A navy sofa, no rug, a reading chair by the window"
        className="mt-1.5 w-full resize-y rounded-[var(--radius-control)] border border-wall bg-white px-3 py-2 text-slate placeholder:text-slate-soft/60 focus:border-slate focus:outline-none"
      />

      <QualityPicker quality={quality} setQuality={setQuality} budget={budget} running={running} />

      <button
        type="button"
        onClick={() => onRun({ room, style, notes, quality })}
        disabled={running || short}
        className="mt-5 w-full rounded-[var(--radius-control)] bg-slate px-4 py-3 font-medium text-trim hover:bg-slate/90 active:translate-y-px disabled:opacity-50"
      >
        {running ? "Staging…" : `Stage ${quality === "draft" ? "a draft" : "the final"}`}
      </button>
      <CreditsNote budget={budget} quality={quality} running={running} busyText="Cloudinary is furnishing the room. This usually takes 10 to 60 seconds." />
    </>
  );
}

// ---------------------------------------------------------------- Dusk

function DuskPanel({
  kind,
  budget,
  running,
  onRun,
}: {
  kind: PhotoKind | null;
  budget: GenerationBudget;
  running: boolean;
  onRun: (input: { mood: string; windowsLit: boolean; outdoorLights: boolean; quality: StageQuality }) => void;
}) {
  const [mood, setMood] = useState("dusk");
  const [windowsLit, setWindowsLit] = useState(true);
  const [outdoorLights, setOutdoorLights] = useState(true);
  const [quality, setQuality] = useState<StageQuality>("draft");
  const exterior = kind !== "interior";
  const label = MOODS.find((m) => m.slug === mood)!.label;

  return (
    <>
      <h2 className="text-lg font-semibold tracking-tight">Change the time of day</h2>
      <p className="mt-1 text-sm text-slate-soft">
        {exterior
          ? "Keeps the house as it is and changes the sky and the lighting."
          : "Keeps the room as it is and changes the light and the view through the windows."}
      </p>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">From day to night</legend>
        <div className="mt-1.5 grid grid-cols-3 overflow-hidden rounded-[var(--radius-control)] border border-wall">
          {MOODS.map((m, i) => (
            <label
              key={m.slug}
              className={`relative cursor-pointer px-2.5 py-2.5 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-slate ${
                i > 0 ? "border-l border-wall" : ""
              } ${mood === m.slug ? MOOD_SWATCH[m.slug] : "bg-white hover:bg-plaster"}`}
            >
              <input
                type="radio"
                name="mood"
                value={m.slug}
                checked={mood === m.slug}
                disabled={running}
                onChange={() => setMood(m.slug)}
                className="sr-only"
              />
              <span className="block font-medium">{m.label}</span>
              <span className={mood === m.slug ? "opacity-85" : "text-slate-soft"}>{m.detail}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 space-y-2.5 text-sm">
        <label className="flex items-center gap-2.5">
          <input type="checkbox" checked={windowsLit} disabled={running} onChange={(e) => setWindowsLit(e.target.checked)} className="size-4 accent-slate" />
          {exterior ? "Lights on inside, glowing in the windows" : "Turn on the room's lights"}
        </label>
        {exterior && (
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={outdoorLights}
              disabled={running}
              onChange={(e) => setOutdoorLights(e.target.checked)}
              className="size-4 accent-slate"
            />
            Porch and garden lights on
          </label>
        )}
      </div>

      <QualityPicker quality={quality} setQuality={setQuality} budget={budget} running={running} />

      <button
        type="button"
        onClick={() => onRun({ mood, windowsLit, outdoorLights: exterior && outdoorLights, quality })}
        disabled={running || (budget.remaining != null && budget.remaining < budget.costs[quality])}
        className="mt-5 w-full rounded-[var(--radius-control)] bg-slate px-4 py-3 font-medium text-trim hover:bg-slate/90 active:translate-y-px disabled:opacity-50"
      >
        {running ? "Changing the light…" : `Make it ${label.toLowerCase()}${quality === "draft" ? ", draft" : ""}`}
      </button>
      <CreditsNote budget={budget} quality={quality} running={running} busyText="Cloudinary is relighting the photo. This usually takes 10 to 60 seconds." />
    </>
  );
}

// Each mood's selected state shows its own light, so the choice reads at a glance.
const MOOD_SWATCH: Record<string, string> = {
  golden: "bg-[#e9b872] text-slate",
  dusk: "bg-[#3e4f78] text-trim",
  night: "bg-[#161d2c] text-trim",
};

function QualityPicker({
  quality,
  setQuality,
  budget,
  running,
}: {
  quality: StageQuality;
  setQuality: (q: StageQuality) => void;
  budget: GenerationBudget;
  running: boolean;
}) {
  const group = useId();
  return (
    <fieldset className="mt-5">
      <legend className="text-sm font-medium">Quality</legend>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        {(["draft", "final"] as const).map((q) => (
          <label
            key={q}
            className={`cursor-pointer rounded-[var(--radius-control)] border px-3 py-2 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-slate ${
              quality === q ? "border-slate bg-slate text-trim" : "border-wall bg-white hover:border-slate"
            }`}
          >
            <input
              type="radio"
              name={group}
              value={q}
              checked={quality === q}
              disabled={running}
              onChange={() => setQuality(q)}
              className="sr-only"
            />
            <span className="block font-medium">{QUALITY[q].label}</span>
            <span className={quality === q ? "text-trim/80" : "text-slate-soft"}>
              {QUALITY[q].detail}, {budget.measured[q] ? "" : "about "}
              {budget.costs[q]} credits
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CreditsNote({
  budget,
  quality,
  running,
  busyText,
}: {
  budget: GenerationBudget;
  quality: StageQuality;
  running: boolean;
  busyText: string;
}) {
  const short = budget.remaining != null && budget.remaining < budget.costs[quality];
  return (
    <>
      <p className="mt-2 text-sm text-slate-soft" aria-live="polite">
        {running
          ? busyText
          : budget.remaining != null
            ? `${budget.remaining} of ${budget.limit} Image Generation credits left this month.`
            : "Your remaining Image Generation credits show here after the first staging."}
      </p>
      {short && (
        <p className="mt-1 text-sm text-alarm">
          Not enough credits left for a {QUALITY[quality].label.toLowerCase()}. Try a draft, or add credits in the Cloudinary console.
        </p>
      )}
    </>
  );
}

// ---------------------------------------------------------------- shared

function VersionRow(props: {
  label: string;
  detail: string;
  cost?: string | null;
  asset: Asset | null;
  label2?: string | null;
  status?: EditorEdit["status"];
  error?: string | null;
  selected: boolean;
  inGallery: boolean;
  disabled: boolean;
  onSelect: () => void;
  onUseInGallery: () => void;
  onRetry?: () => void;
  onDelete?: () => void;
}) {
  const { label, detail, asset, status = "done", error, selected, inGallery, disabled } = props;
  const link = "underline underline-offset-4 hover:no-underline disabled:opacity-50";
  return (
    <li className="flex gap-3 py-3">
      <button
        type="button"
        onClick={props.onSelect}
        disabled={!asset || disabled}
        aria-pressed={selected}
        aria-label={`Show ${label}`}
        className={`relative aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-[var(--radius-photo)] bg-plaster outline-offset-2 ${
          selected ? "outline-2 outline-slate" : ""
        }`}
      >
        {asset && <Image src={imageSrc(asset)} alt="" fill sizes="80px" className="object-cover" />}
      </button>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">
          {label}
          {inGallery && <span className="ml-2 font-normal text-slate-soft">In gallery</span>}
          {props.cost && <span className="ml-2 font-normal text-slate-soft">{props.cost}</span>}
        </p>
        <p className="truncate text-slate-soft" title={detail}>
          {detail}
        </p>
        {status === "running" && <p className="text-slate-soft">Working on it…</p>}
        {status === "failed" && error && <p className="text-alarm">{error}</p>}
        <div className="mt-1 flex flex-wrap gap-x-3">
          {asset && !inGallery && (
            <button type="button" disabled={disabled} onClick={props.onUseInGallery} className={link}>
              Use in gallery
            </button>
          )}
          {asset && (
            <a href={originalUrl(asset)} className={link}>
              Download
            </a>
          )}
          {asset && props.label2 && (
            <a href={labelledUrl(asset, props.label2)} className={link} title={`Adds a “${props.label2}” label, which many listing services require`}>
              Download labelled
            </a>
          )}
          {props.onRetry && status !== "running" && (
            <button type="button" disabled={disabled} onClick={props.onRetry} className={link}>
              Try again
            </button>
          )}
          {props.onDelete && (
            <button type="button" disabled={disabled} onClick={props.onDelete} className={`text-slate-soft hover:text-alarm ${link}`}>
              Delete
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

/** Before and after stacked; a range input moves the line. Keyboard: arrow keys. */
function Compare({ before, after, name, busy }: { before: Asset; after: Asset | null; name: string; busy: boolean }) {
  const [pos, setPos] = useState(50);
  return (
    <div
      className={`relative w-full overflow-hidden rounded-[var(--radius-photo)] bg-plaster ${busy ? "animate-pulse" : ""}`}
      style={{ aspectRatio: `${before.width} / ${before.height}` }}
    >
      <Image src={imageSrc(before)} alt={`${name}, original`} fill priority sizes="(min-width: 1024px) 720px, 100vw" className="object-cover" />
      {after && (
        <>
          <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
            <Image src={imageSrc(after)} alt={`${name}, edited`} fill priority sizes="(min-width: 1024px) 720px, 100vw" className="object-cover" />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            aria-label="Compare before and after"
            className="peer absolute inset-0 z-10 h-full w-full cursor-ew-resize opacity-0"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-trim shadow-[0_0_0_1px_rgba(38,44,49,0.35)] peer-focus-visible:*:ring-2 peer-focus-visible:*:ring-slate"
            style={{ left: `${pos}%` }}
          >
            <span className="absolute top-1/2 left-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-trim text-slate shadow">
              ⟷
            </span>
          </div>
          <span className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-[var(--radius-control)] bg-slate/75 px-2 py-0.5 text-sm text-trim">
            Before
          </span>
          <span className="pointer-events-none absolute right-3 bottom-3 z-20 rounded-[var(--radius-control)] bg-slate/75 px-2 py-0.5 text-sm text-trim">
            After
          </span>
        </>
      )}
    </div>
  );
}
