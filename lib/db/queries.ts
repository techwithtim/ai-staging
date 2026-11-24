import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, LOCAL_USER_ID } from "./client";
import { houses, listingVideos, photoEdits, photos, type Photo, type PhotoEdit, type StageParams, type StageQuality } from "./schema";
import { QUALITY } from "../staging";

// Reads call connection() so pages render at request time with fresh rows.

export type HouseSummary = Awaited<ReturnType<typeof listHouses>>[number];

export async function listHouses() {
  await connection();
  const rows = await db
    .select({
      house: houses,
      total: sql<number>`count(${photos.id})`,
      interior: sql<number>`sum(case when ${photos.kind} = 'interior' then 1 else 0 end)`,
      exterior: sql<number>`sum(case when ${photos.kind} = 'exterior' then 1 else 0 end)`,
    })
    .from(houses)
    .leftJoin(photos, eq(photos.houseId, houses.id))
    .where(eq(houses.userId, LOCAL_USER_ID))
    .groupBy(houses.id)
    .orderBy(desc(houses.updatedAt));

  // One cover photo per house: an exterior first if there is one, else the first upload.
  const covers = await db
    .select({ photo: photos, edit: photoEdits })
    .from(photos)
    .leftJoin(photoEdits, eq(photoEdits.id, photos.activeEditId))
    .where(eq(photos.userId, LOCAL_USER_ID))
    .orderBy(sql`case when ${photos.kind} = 'exterior' then 0 else 1 end`, asc(photos.createdAt));
  const coverByHouse = new Map<string, DisplayAsset>();
  for (const r of covers) {
    if (!coverByHouse.has(r.photo.houseId)) coverByHouse.set(r.photo.houseId, withDisplay(r.photo, r.edit).display);
  }

  return rows.map((r) => ({
    ...r.house,
    total: Number(r.total ?? 0),
    interior: Number(r.interior ?? 0),
    exterior: Number(r.exterior ?? 0),
    cover: coverByHouse.get(r.house.id) ?? null,
  }));
}

export const getHouse = cache(async (id: string) => {
  await connection();
  const [house] = await db
    .select()
    .from(houses)
    .where(and(eq(houses.id, id), eq(houses.userId, LOCAL_USER_ID)));
  return house ?? null;
});

/** What the gallery shows for a photo: its kept edit if there is one, else the original. */
export type DisplayAsset = { publicId: string; version: number; format: string; width: number; height: number };
export type GalleryPhoto = Photo & { display: DisplayAsset; edited: boolean; editType: PhotoEdit["type"] | null };

function withDisplay(photo: Photo, edit: PhotoEdit | null): GalleryPhoto {
  const kept = edit && edit.status === "done" && edit.publicId ? edit : null;
  return {
    ...photo,
    edited: !!kept,
    editType: kept?.type ?? null,
    display: kept
      ? { publicId: kept.publicId!, version: kept.version!, format: kept.format!, width: kept.width!, height: kept.height! }
      : { publicId: photo.publicId, version: photo.version, format: photo.format, width: photo.width, height: photo.height },
  };
}

export const listPhotos = cache(async (houseId: string): Promise<GalleryPhoto[]> => {
  await connection();
  const rows = await db
    .select({ photo: photos, edit: photoEdits })
    .from(photos)
    .leftJoin(photoEdits, eq(photoEdits.id, photos.activeEditId))
    .where(and(eq(photos.houseId, houseId), eq(photos.userId, LOCAL_USER_ID)))
    .orderBy(asc(photos.createdAt));
  return rows.map((r) => withDisplay(r.photo, r.edit));
});

export const getPhoto = cache(async (photoId: string) => {
  await connection();
  const [row] = await db
    .select({ photo: photos, edit: photoEdits })
    .from(photos)
    .leftJoin(photoEdits, eq(photoEdits.id, photos.activeEditId))
    .where(and(eq(photos.id, photoId), eq(photos.userId, LOCAL_USER_ID)));
  return row ? withDisplay(row.photo, row.edit) : null;
});

export const listVideos = cache(async (houseId: string) => {
  await connection();
  return db
    .select()
    .from(listingVideos)
    .where(and(eq(listingVideos.houseId, houseId), eq(listingVideos.userId, LOCAL_USER_ID)))
    .orderBy(desc(listingVideos.createdAt));
});

export type GenerationBudget = {
  remaining: number | null; // null until the first staging reports it
  limit: number | null;
  costs: Record<StageQuality, number>; // last measured cost, else the preset estimate
  measured: Record<StageQuality, boolean>;
};

/** Image Generation credits, as Cloudinary reported them on the most recent staging. */
export const getGenerationBudget = cache(async (): Promise<GenerationBudget> => {
  await connection();
  const rows = await db
    .select({
      params: photoEdits.params,
      creditsUsed: photoEdits.creditsUsed,
      creditsRemaining: photoEdits.creditsRemaining,
      creditsLimit: photoEdits.creditsLimit,
      status: photoEdits.status,
    })
    .from(photoEdits)
    .where(and(eq(photoEdits.userId, LOCAL_USER_ID), inArray(photoEdits.type, ["stage", "dusk"])))
    .orderBy(desc(photoEdits.createdAt))
    .limit(50);

  const latest = rows.find((r) => r.creditsRemaining != null);
  const costOf = (q: StageQuality) =>
    rows.find((r) => r.status === "done" && r.creditsUsed != null && (r.params as StageParams).quality === q)?.creditsUsed;
  const draft = costOf("draft");
  const final = costOf("final");
  return {
    remaining: latest?.creditsRemaining ?? null,
    limit: latest?.creditsLimit ?? null,
    costs: { draft: draft ?? QUALITY.draft.estimate, final: final ?? QUALITY.final.estimate },
    measured: { draft: draft != null, final: final != null },
  };
});

export const listEdits = cache(async (photoId: string) => {
  await connection();
  return db
    .select()
    .from(photoEdits)
    .where(and(eq(photoEdits.photoId, photoId), eq(photoEdits.userId, LOCAL_USER_ID)))
    .orderBy(asc(photoEdits.createdAt));
});
