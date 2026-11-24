import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { assertConfigured } from "./server";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Renders a listing video from its transformation URL, then stores the MP4 as a Cloudinary video
 * asset so it has a stable URL to share and download. Cloudinary answers 423 while it renders.
 */
export async function renderListingVideo(opts: {
  transformation: string;
  base: { publicId: string; version: number };
  destPublicId: string;
  assetFolder: string;
  tags: string[];
  timeoutMs?: number;
}) {
  assertConfigured();
  const cloud = cloudinary.config().cloud_name;
  const url = `https://res.cloudinary.com/${cloud}/image/upload/${opts.transformation}/v${opts.base.version}/${opts.base.publicId}.mp4`;

  const deadline = Date.now() + (opts.timeoutMs ?? 240_000);
  for (;;) {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(120_000) });
    if (res.ok) {
      await res.arrayBuffer();
      break;
    }
    if (res.status !== 423) {
      const why = res.headers.get("x-cld-error");
      throw new Error(why ? `Cloudinary couldn't make the video: ${why}` : `Cloudinary couldn't make the video (HTTP ${res.status}).`);
    }
    if (Date.now() > deadline) throw new Error("Cloudinary is still making this video. Try again in a minute.");
    await sleep(3000);
  }

  return cloudinary.uploader.upload(url, {
    resource_type: "video",
    public_id: opts.destPublicId,
    asset_folder: opts.assetFolder,
    tags: opts.tags,
    overwrite: false,
  });
}

export async function destroyVideos(publicIds: string[]) {
  assertConfigured();
  for (let i = 0; i < publicIds.length; i += 100) {
    await cloudinary.api.delete_resources(publicIds.slice(i, i + 100), {
      resource_type: "video",
      type: "upload",
      invalidate: true,
    });
  }
}
