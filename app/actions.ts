"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, LOCAL_USER_ID } from "@/lib/db/client";
import {
  houses,
  listingVideos,
  photoEdits,
  photos,
  type CleanupParams,
  type DuskParams,
  type PhotoKind,
  type StageParams,
  type StageQuality,
} from "@/lib/db/schema";
import { buildStagingPrompt, isStageableRoom, PROMPT_VERSION, QUALITY, STYLES } from "@/lib/staging";
import { closestAspect, GenerationError, imageToImage } from "@/lib/cloudinary/generate";
import { buildDuskPrompt, moodFor } from "@/lib/dusk";
import {
  cleanItem,
  cleanupTransformation,
  CLEANUP_COST_TRANSFORMATIONS,
  MAX_ITEMS,
  renderCleanup,
  toPrompts,
} from "@/lib/cloudinary/cleanup";
import { getGenerationBudget, getHouse } from "@/lib/db/queries";
import { roomFor } from "@/lib/rooms";
import { destroyVideos } from "@/lib/cloudinary/video";
import {
  destroyImages,
  editPublicId,
  MissingCredentialsError,
  photoPublicId,
  signUpload,
  verifyUpload,
} from "@/lib/cloudinary/server";

// Every action is a public POST endpoint, so each one re-checks its inputs and ownership.

const KINDS = new Set<PhotoKind>(["interior", "exterior"]);
const isKind = (v: unknown): v is PhotoKind => typeof v === "string" && KINDS.has(v as PhotoKind);

async function ownedHouse(houseId: string) {
  const house = typeof houseId === "string" ? await getHouse(houseId) : null;
  if (!house) throw new Error("That house no longer exists.");
  return house;
}

async function ownedPhoto(photoId: string) {
  const [photo] = await db
    .select()
    .from(photos)
    .where(and(eq(photos.id, String(photoId)), eq(photos.userId, LOCAL_USER_ID)));
  if (!photo) throw new Error("That photo no longer exists.");
  return photo;
}

async function touchHouse(houseId: string) {
  await db
    .update(houses)
    .set({ updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))` })
    .where(eq(houses.id, houseId));
}

// ---------------------------------------------------------------- houses

export type HouseFormState = { error?: string; fields?: Record<string, string> };

function optionalNumber(raw: FormDataEntryValue | null, label: string, opts: { int?: boolean } = {}) {
  const text = String(raw ?? "").replace(/[$,\s]/g, "");
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be a positive number.`);
  return opts.int ? Math.round(n) : n;
}

export async function createHouse(_prev: HouseFormState, formData: FormData): Promise<HouseFormState> {
  const fields = Object.fromEntries(
    ["address", "city", "price", "beds", "baths", "sqft"].map((k) => [k, String(formData.get(k) ?? "")]),
  );
  const address = fields.address.trim();
  if (!address) return { error: "Add the street address so you can find this house later.", fields };

  let values;
  try {
    values = {
      price: optionalNumber(formData.get("price"), "Price", { int: true }),
      beds: optionalNumber(formData.get("beds"), "Bedrooms"),
      baths: optionalNumber(formData.get("baths"), "Bathrooms"),
      sqft: optionalNumber(formData.get("sqft"), "Square feet", { int: true }),
    };
  } catch (e) {
    return { error: (e as Error).message, fields };
  }

  const id = randomUUID();
  await db.insert(houses).values({
    id,
    userId: LOCAL_USER_ID,
    address: address.slice(0, 200),
    city: fields.city.trim().slice(0, 120) || null,
    ...values,
  });
  redirect(`/houses/${id}`);
}

export async function deleteHouse(houseId: string) {
  const house = await ownedHouse(houseId);
  const rows = await db.select({ publicId: photos.publicId }).from(photos).where(eq(photos.houseId, house.id));
  const editRows = await db
    .select({ publicId: photoEdits.publicId })
    .from(photoEdits)
    .innerJoin(photos, eq(photos.id, photoEdits.photoId))
    .where(eq(photos.houseId, house.id));
  const publicIds = [...rows.map((r) => r.publicId), ...editRows.flatMap((r) => (r.publicId ? [r.publicId] : []))];
  const videoIds = (await db.select({ publicId: listingVideos.publicId }).from(listingVideos).where(eq(listingVideos.houseId, house.id)))
    .flatMap((v) => (v.publicId ? [v.publicId] : []));
  if (publicIds.length || videoIds.length) {
    try {
      if (publicIds.length) await destroyImages(publicIds);
      if (videoIds.length) await destroyVideos(videoIds);
    } catch (e) {
      if (e instanceof MissingCredentialsError) return { error: e.message };
      return { error: "Cloudinary didn't delete the photos, so the house was kept. Try again." };
    }
  }
  const photoIds = (await db.select({ id: photos.id }).from(photos).where(eq(photos.houseId, house.id))).map((p) => p.id);
  if (photoIds.length) await db.delete(photoEdits).where(inArray(photoEdits.photoId, photoIds));
  await db.delete(listingVideos).where(eq(listingVideos.houseId, house.id));
  await db.delete(photos).where(eq(photos.houseId, house.id));
  await db.delete(houses).where(eq(houses.id, house.id));
  redirect("/houses");
}

// ---------------------------------------------------------------- uploads

export type UploadTicket =
  | { ok: true; photoId: string; cloudName: string; apiKey: string; params: Record<string, string | number>; signature: string }
  | { ok: false; error: string };

/** Step 1 of an upload: sign the parameters for one file. */
export async function prepareUpload(houseId: string): Promise<UploadTicket> {
  try {
    const house = await ownedHouse(houseId);
    const photoId = randomUUID();
    const signed = signUpload({ userId: LOCAL_USER_ID, houseId: house.id, photoId });
    return { ok: true, photoId, ...signed };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type UploadResult = {
  public_id: string;
  asset_id: string;
  version: number;
  width: number;
  height: number;
  bytes: number;
  format: string;
  original_filename?: string;
  signature: string;
};

/** Step 3 of an upload: after the browser sent the file to Cloudinary, record it. */
export async function saveUpload(
  houseId: string,
  photoId: string,
  result: UploadResult,
  kind: PhotoKind | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const house = await ownedHouse(houseId);
    const expected = photoPublicId(LOCAL_USER_ID, house.id, String(photoId));
    if (result?.public_id !== expected || !verifyUpload(result.public_id, Number(result.version), String(result.signature))) {
      return { ok: false, error: "This upload couldn't be verified with Cloudinary, so it wasn't added." };
    }
    await db
      .insert(photos)
      .values({
        id: String(photoId),
        houseId: house.id,
        userId: LOCAL_USER_ID,
        publicId: result.public_id,
        assetId: String(result.asset_id),
        version: Number(result.version),
        width: Number(result.width),
        height: Number(result.height),
        bytes: Number(result.bytes),
        format: String(result.format),
        originalFilename: result.original_filename ? String(result.original_filename).slice(0, 200) : null,
        kind: isKind(kind) ? kind : null,
        kindSource: isKind(kind) ? "manual" : null,
      })
      .onConflictDoNothing();
    await touchHouse(house.id);
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------- sorting

export async function setPhotoKind(photoId: string, kind: PhotoKind | null) {
  const photo = await ownedPhoto(photoId);
  const next = isKind(kind) ? kind : null;
  const room = roomFor(photo.room);
  await db
    .update(photos)
    .set({
      kind: next,
      kindSource: next ? "manual" : null,
      // A room only stays if it belongs to the new side of the house.
      room: room && room.kind === next ? photo.room : null,
    })
    .where(eq(photos.id, photo.id));
  await touchHouse(photo.houseId);
  refresh();
}

export async function setPhotoRoom(photoId: string, roomSlug: string | null) {
  const photo = await ownedPhoto(photoId);
  const room = roomFor(roomSlug);
  // Picking a room also settles interior or exterior.
  await db
    .update(photos)
    .set(room ? { room: room.slug, kind: room.kind, kindSource: "manual" } : { room: null })
    .where(eq(photos.id, photo.id));
  await touchHouse(photo.houseId);
  refresh();
}

export async function deletePhoto(photoId: string) {
  const photo = await ownedPhoto(photoId);
  const edits = await db.select({ publicId: photoEdits.publicId }).from(photoEdits).where(eq(photoEdits.photoId, photo.id));
  try {
    await destroyImages([photo.publicId, ...edits.flatMap((e) => (e.publicId ? [e.publicId] : []))]);
  } catch (e) {
    if (e instanceof MissingCredentialsError) return { error: e.message };
    return { error: "Cloudinary didn't delete this photo. Try again." };
  }
  await db.delete(photoEdits).where(eq(photoEdits.photoId, photo.id));
  await db.delete(photos).where(eq(photos.id, photo.id));
  await touchHouse(photo.houseId);
  refresh();
  return {};
}

// ---------------------------------------------------------------- cleanup (generative remove)

async function ownedEdit(editId: string) {
  const [edit] = await db
    .select()
    .from(photoEdits)
    .where(and(eq(photoEdits.id, String(editId)), eq(photoEdits.userId, LOCAL_USER_ID)));
  if (!edit) throw new Error("That version no longer exists.");
  return edit;
}

export type CleanupResult = { ok: true; editId: string } | { ok: false; error: string; editId?: string };

/** Removes the named items from one version of a photo and saves the result as a new version. */
export async function cleanupPhoto(
  photoId: string,
  sourceEditId: string | null,
  rawItems: string[],
  removeShadow: boolean,
): Promise<CleanupResult> {
  let photo;
  try {
    photo = await ownedPhoto(photoId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const items = [...new Set((Array.isArray(rawItems) ? rawItems : []).map((i) => cleanItem(String(i))).filter(Boolean))];
  if (!items.length) return { ok: false, error: "Add at least one thing to remove, like “TV” or “bar stools”." };
  if (items.length > MAX_ITEMS) return { ok: false, error: `Remove up to ${MAX_ITEMS} things at a time.` };

  // Work from the original or from an earlier finished version of the same photo.
  let source = { publicId: photo.publicId, version: photo.version };
  if (sourceEditId) {
    const base = await ownedEdit(sourceEditId).catch(() => null);
    if (!base || base.photoId !== photo.id || base.status !== "done" || !base.publicId || !base.version) {
      return { ok: false, error: "That version isn't ready to clean up. Pick another one." };
    }
    source = { publicId: base.publicId, version: base.version };
  }

  const prompts = toPrompts(items);
  if (!prompts.length) return { ok: false, error: "Use plain words for what to remove, like “TV” or “bar stools”." };
  const shadow = removeShadow === true;

  // The same request again would come back from Cloudinary's cache, so each repeat is a new attempt.
  const earlier = await db
    .select({ params: photoEdits.params, sourceEditId: photoEdits.sourceEditId })
    .from(photoEdits)
    .where(and(eq(photoEdits.photoId, photo.id), eq(photoEdits.type, "cleanup")));
  const key = (p: string[]) => [...p].sort().join("|");
  const attempt = earlier.filter(
    (e) =>
      (e.sourceEditId ?? null) === (sourceEditId || null) &&
      key((e.params as CleanupParams).prompts ?? []) === key(prompts) &&
      (e.params as CleanupParams).removeShadow === shadow,
  ).length;

  const editId = randomUUID();
  const transformation = cleanupTransformation(prompts, shadow, attempt);
  await db.insert(photoEdits).values({
    id: editId,
    photoId: photo.id,
    userId: LOCAL_USER_ID,
    type: "cleanup",
    sourceEditId: sourceEditId || null,
    params: { items, prompts, removeShadow: shadow, attempt },
    transformation,
    status: "running",
    costTransformations: CLEANUP_COST_TRANSFORMATIONS,
  });

  const started = Date.now();
  try {
    const result = await renderCleanup({
      source,
      transformation,
      destPublicId: editPublicId(LOCAL_USER_ID, photo.houseId, photo.id, editId),
      assetFolder: `ai-staging/${LOCAL_USER_ID}/${photo.houseId}/edits`,
      tags: ["ai-staging", `house-${photo.houseId}`, "cleanup"],
    });
    await db
      .update(photoEdits)
      .set({
        status: "done",
        publicId: result.public_id,
        assetId: result.asset_id,
        version: result.version,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        format: result.format,
        latencyMs: Date.now() - started,
      })
      .where(eq(photoEdits.id, editId));
    await touchHouse(photo.houseId);
    refresh();
    return { ok: true, editId };
  } catch (e) {
    const message =
      e instanceof MissingCredentialsError ? e.message : (e as Error).message || "Cloudinary couldn't clean up this photo.";
    await db
      .update(photoEdits)
      .set({ status: "failed", error: message, latencyMs: Date.now() - started })
      .where(eq(photoEdits.id, editId));
    refresh();
    return { ok: false, error: message, editId };
  }
}

/** Runs the same edit again from the same starting version, for a different result. */
export async function retryEdit(editId: string): Promise<CleanupResult> {
  const edit = await ownedEdit(editId).catch(() => null);
  if (!edit) return { ok: false, error: "That version no longer exists." };
  if (edit.type === "stage") {
    const p = edit.params as StageParams;
    return stagePhoto(edit.photoId, edit.sourceEditId, { room: p.room, style: p.style, notes: p.notes, quality: p.quality });
  }
  if (edit.type === "dusk") {
    const p = edit.params as DuskParams;
    return duskPhoto(edit.photoId, edit.sourceEditId, p);
  }
  const p = edit.params as CleanupParams;
  return cleanupPhoto(edit.photoId, edit.sourceEditId, p.items, p.removeShadow);
}

// ---------------------------------------------------------------- Image Generation: staging and dusk

/** Where a generation starts: the original photo or a finished earlier version of it. */
async function sourceFor(photo: { id: string; assetId: string; width: number; height: number }, sourceEditId: string | null) {
  if (!sourceEditId) return { assetId: photo.assetId, width: photo.width, height: photo.height };
  const base = await ownedEdit(sourceEditId).catch(() => null);
  if (!base || base.photoId !== photo.id || base.status !== "done" || !base.assetId) return null;
  return { assetId: base.assetId, width: base.width!, height: base.height! };
}

/**
 * Runs one Image Generation edit (staging or dusk) and records it as a version: checks the month's
 * credits first, saves a running row, calls Cloudinary, then stores the asset, model and credits.
 */
async function runGeneration(opts: {
  photo: Awaited<ReturnType<typeof ownedPhoto>>;
  sourceEditId: string | null;
  type: "stage" | "dusk";
  quality: StageQuality;
  prompt: string;
  params: (seed: number) => StageParams | DuskParams;
  verb: string; // "stage", "turn to dusk"
}): Promise<CleanupResult> {
  const { photo, quality, prompt } = opts;
  const source = await sourceFor(photo, opts.sourceEditId);
  if (!source) return { ok: false, error: `That version isn't ready to ${opts.verb}. Pick another one.` };

  // Don't start a request the month's credits can't cover.
  const budget = await getGenerationBudget();
  const needed = budget.costs[quality];
  if (budget.remaining != null && budget.remaining < needed) {
    return {
      ok: false,
      error: `This needs about ${needed} Image Generation credits and ${budget.remaining} are left this month. Try a draft, or add credits in the Cloudinary console.`,
    };
  }

  const editId = randomUUID();
  const seed = Math.floor(Math.random() * 2_147_483_647);
  const preset = QUALITY[quality];
  await db.insert(photoEdits).values({
    id: editId,
    photoId: photo.id,
    userId: LOCAL_USER_ID,
    type: opts.type,
    sourceEditId: opts.sourceEditId || null,
    params: opts.params(seed),
    transformation: `image_to_image v${PROMPT_VERSION}`,
    status: "running",
  });

  const started = Date.now();
  try {
    const { asset, credits } = await imageToImage({
      referenceAssetId: source.assetId,
      prompt,
      model: preset.model,
      aspectRatio: closestAspect(source.width, source.height),
      resolution: preset.resolution,
      publicId: editPublicId(LOCAL_USER_ID, photo.houseId, photo.id, editId),
      seed,
    });
    await db
      .update(photoEdits)
      .set({
        status: "done",
        publicId: asset.publicId,
        assetId: asset.assetId,
        version: asset.version,
        width: asset.width,
        height: asset.height,
        bytes: asset.bytes,
        format: asset.format,
        model: asset.model,
        creditsUsed: credits.used,
        creditsRemaining: credits.remaining,
        creditsLimit: credits.limit,
        latencyMs: Date.now() - started,
      })
      .where(eq(photoEdits.id, editId));
    await touchHouse(photo.houseId);
    refresh();
    return { ok: true, editId };
  } catch (e) {
    const credits = e instanceof GenerationError ? e.credits : null;
    const message =
      e instanceof MissingCredentialsError || e instanceof GenerationError
        ? e.message.replace("stage this photo", `${opts.verb} this photo`)
        : `Cloudinary couldn't ${opts.verb} this photo. Try again.`;
    await db
      .update(photoEdits)
      .set({
        status: "failed",
        error: message,
        creditsUsed: credits?.used ?? null,
        creditsRemaining: credits?.remaining ?? null,
        creditsLimit: credits?.limit ?? null,
        latencyMs: Date.now() - started,
      })
      .where(eq(photoEdits.id, editId));
    refresh();
    return { ok: false, error: message, editId };
  }
}

const qualityOf = (q: unknown): StageQuality => (q === "final" ? "final" : "draft");

export async function stagePhoto(
  photoId: string,
  sourceEditId: string | null,
  input: { room: string; style: string; notes?: string; quality: StageQuality },
): Promise<CleanupResult> {
  let photo;
  try {
    photo = await ownedPhoto(photoId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const room = String(input?.room ?? "");
  const style = String(input?.style ?? "");
  const quality = qualityOf(input?.quality);
  const notes = String(input?.notes ?? "").slice(0, 300);
  if (!isStageableRoom(room)) return { ok: false, error: "Pick which room this is, so the right furniture goes in." };
  if (!STYLES.some((s) => s.slug === style)) return { ok: false, error: "Pick a style." };

  const prompt = buildStagingPrompt({ room, style, notes });
  return runGeneration({
    photo,
    sourceEditId,
    type: "stage",
    quality,
    prompt,
    verb: "stage",
    params: (seed) => ({ room, style, notes, quality, prompt, seed }),
  });
}

/** Day to dusk: the same photo with an evening sky and the lights on. */
export async function duskPhoto(
  photoId: string,
  sourceEditId: string | null,
  input: { mood: string; windowsLit: boolean; outdoorLights: boolean; quality: StageQuality },
): Promise<CleanupResult> {
  let photo;
  try {
    photo = await ownedPhoto(photoId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const mood = String(input?.mood ?? "");
  if (!moodFor(mood)) return { ok: false, error: "Pick golden hour, dusk or night." };
  const windowsLit = input?.windowsLit !== false;
  const outdoorLights = input?.outdoorLights !== false;
  const quality = qualityOf(input?.quality);

  const prompt = buildDuskPrompt({ kind: photo.kind, mood, windowsLit, outdoorLights });
  return runGeneration({
    photo,
    sourceEditId,
    type: "dusk",
    quality,
    prompt,
    verb: "turn to dusk",
    params: (seed) => ({ mood, windowsLit, outdoorLights, quality, prompt, seed }),
  });
}

/** Chooses which version the gallery shows. Null goes back to the original. */
export async function setActiveEdit(photoId: string, editId: string | null) {
  const photo = await ownedPhoto(photoId);
  if (editId) {
    const edit = await ownedEdit(editId);
    if (edit.photoId !== photo.id || edit.status !== "done") throw new Error("That version can't be used.");
  }
  await db.update(photos).set({ activeEditId: editId || null }).where(eq(photos.id, photo.id));
  await touchHouse(photo.houseId);
  refresh();
}

export async function deleteEdit(editId: string) {
  const edit = await ownedEdit(editId);
  if (edit.publicId) {
    try {
      await destroyImages([edit.publicId]);
    } catch (e) {
      if (e instanceof MissingCredentialsError) return { error: e.message };
      return { error: "Cloudinary didn't delete this version. Try again." };
    }
  }
  // Versions made from this one keep their images; they just lose the link back.
  await db.update(photoEdits).set({ sourceEditId: null }).where(eq(photoEdits.sourceEditId, edit.id));
  await db.update(photos).set({ activeEditId: null }).where(eq(photos.activeEditId, edit.id));
  await db.delete(photoEdits).where(eq(photoEdits.id, edit.id));
  refresh();
  return {};
}
