"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, LOCAL_USER_ID } from "@/lib/db/client";
import { listingVideos, type VideoSettings } from "@/lib/db/schema";
import { getHouse, listPhotos } from "@/lib/db/queries";
import { houseFacts } from "@/lib/format";
import { roomFor } from "@/lib/rooms";
import { buildVideo, VIDEO } from "@/lib/video-recipe";
import { destroyVideos, renderListingVideo } from "@/lib/cloudinary/video";
import { MissingCredentialsError } from "@/lib/cloudinary/server";

// Vertical listing videos: Cloudinary transformations only (zoompan, splice, text), no Image
// Generation credits. Cost is ordinary transformation and video-processing usage.

export type VideoResult = { ok: true; videoId: string } | { ok: false; error: string };

const SECONDS = new Set([2.5, 3, 4]);

export async function createListingVideo(houseId: string, input: VideoSettings): Promise<VideoResult> {
  const house = typeof houseId === "string" ? await getHouse(houseId) : null;
  if (!house) return { ok: false, error: "That house no longer exists." };

  // Only this house's photos, in the order the agent chose, each in its gallery version.
  const photos = await listPhotos(house.id);
  const byId = new Map(photos.map((p) => [p.id, p]));
  const chosen = (Array.isArray(input?.photoIds) ? input.photoIds : [])
    .map((id) => byId.get(String(id)))
    .filter((p): p is NonNullable<typeof p> => !!p);
  if (!chosen.length) return { ok: false, error: "Pick at least one photo for the video." };
  if (chosen.length > VIDEO.maxShots) return { ok: false, error: `Use up to ${VIDEO.maxShots} photos; short videos do better on social.` };

  const settings: VideoSettings = {
    photoIds: chosen.map((p) => p.id),
    framing: input?.framing === "whole" ? "whole" : "fill",
    secondsPerShot: SECONDS.has(Number(input?.secondsPerShot)) ? Number(input.secondsPerShot) : 3,
    showTitle: input?.showTitle !== false,
    showCaptions: input?.showCaptions !== false,
    closing: String(input?.closing ?? "").replace(/\s+/g, " ").trim().slice(0, 40),
  };

  const facts = houseFacts(house).join(", ");
  const { transformation, base, seconds } = buildVideo({
    framing: settings.framing,
    secondsPerShot: settings.secondsPerShot,
    title: settings.showTitle ? { line1: house.address, line2: facts || house.city || undefined } : null,
    closing: settings.closing || null,
    shots: chosen.map((p) => ({
      publicId: p.display.publicId,
      version: p.display.version,
      caption: settings.showCaptions
        ? (roomFor(p.room)?.label ?? (p.kind === "exterior" ? "Outside" : null))
        : null,
    })),
  });

  const videoId = randomUUID();
  await db.insert(listingVideos).values({
    id: videoId,
    houseId: house.id,
    userId: LOCAL_USER_ID,
    settings,
    transformation,
    status: "running",
    seconds,
  });
  refresh();

  const started = Date.now();
  try {
    const result = await renderListingVideo({
      transformation,
      base,
      destPublicId: `ai-staging/${LOCAL_USER_ID}/${house.id}/videos/${videoId}`,
      assetFolder: `ai-staging/${LOCAL_USER_ID}/${house.id}/videos`,
      tags: ["ai-staging", `house-${house.id}`, "listing-video"],
    });
    await db
      .update(listingVideos)
      .set({
        status: "done",
        publicId: result.public_id,
        assetId: result.asset_id,
        version: result.version,
        bytes: result.bytes,
        seconds: typeof result.duration === "number" ? result.duration : seconds,
        latencyMs: Date.now() - started,
      })
      .where(eq(listingVideos.id, videoId));
    refresh();
    return { ok: true, videoId };
  } catch (e) {
    const message =
      e instanceof MissingCredentialsError ? e.message : (e as Error).message || "Cloudinary couldn't make the video. Try again.";
    await db
      .update(listingVideos)
      .set({ status: "failed", error: message, latencyMs: Date.now() - started })
      .where(eq(listingVideos.id, videoId));
    refresh();
    return { ok: false, error: message };
  }
}

export async function deleteListingVideo(videoId: string) {
  const [video] = await db
    .select()
    .from(listingVideos)
    .where(and(eq(listingVideos.id, String(videoId)), eq(listingVideos.userId, LOCAL_USER_ID)));
  if (!video) return { error: "That video no longer exists." };
  if (video.publicId) {
    try {
      await destroyVideos([video.publicId]);
    } catch (e) {
      if (e instanceof MissingCredentialsError) return { error: e.message };
      return { error: "Cloudinary didn't delete this video. Try again." };
    }
  }
  await db.delete(listingVideos).where(eq(listingVideos.id, video.id));
  refresh();
  return {};
}
