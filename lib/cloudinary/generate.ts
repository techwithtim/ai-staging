import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { assertConfigured } from "./server";

// Cloudinary Image Generation API (cloudinary.com/documentation/image_generation_addon).
// POST /v2/generate/<cloud>/image_to_image with HTTP Basic auth (API key and secret).
// Billing is in Image Generation credits, about one US cent each, reported on every response.

export type ModelChoice = { id: string } | { family: string; tier: "standard" | "premium" };
export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

export type GeneratedAsset = {
  assetId: string;
  publicId: string;
  version: number;
  width: number;
  height: number;
  bytes: number;
  format: string;
  model: string;
};
export type Credits = { used: number | null; remaining: number | null; limit: number | null };

export class GenerationError extends Error {
  constructor(
    message: string,
    public credits: Credits = { used: null, remaining: null, limit: null },
  ) {
    super(message);
  }
}

/** The supported aspect ratio closest to the source photo, so the room isn't cropped or stretched. */
export function closestAspect(width: number, height: number): AspectRatio {
  const r = width / height;
  const options: [AspectRatio, number][] = [
    ["1:1", 1],
    ["16:9", 16 / 9],
    ["9:16", 9 / 16],
    ["4:3", 4 / 3],
    ["3:4", 3 / 4],
  ];
  return options.reduce((best, o) => (Math.abs(Math.log(o[1] / r)) < Math.abs(Math.log(best[1] / r)) ? o : best))[0];
}

function auth() {
  assertConfigured();
  const { cloud_name, api_key, api_secret } = cloudinary.config();
  return {
    base: `https://api.cloudinary.com/v2/generate/${cloud_name}`,
    header: "Basic " + Buffer.from(`${api_key}:${api_secret}`).toString("base64"),
  };
}

type ApiAsset = {
  bytes: number;
  format: string;
  width: number;
  height: number;
  model?: { id?: string };
  storage?: { asset_id: string; public_id: string; version: number };
};
type ApiBody = {
  data?: { assets?: ApiAsset[]; result?: { assets?: ApiAsset[] }; status?: string; task_id?: string };
  limits?: { addons_quota?: { type: string; limit: number; remaining: number; used_by_request: number }[] };
  error?: { message?: string; code?: string };
  status?: string;
  task_id?: string;
};

function creditsOf(body: ApiBody): Credits {
  const q = body.limits?.addons_quota?.find((x) => x.type === "image_generation");
  return { used: q?.used_by_request ?? null, remaining: q?.remaining ?? null, limit: q?.limit ?? null };
}

function errorText(status: number, body: ApiBody) {
  const msg = body.error?.message;
  if (status === 402 || /quota|credit|limit/i.test(msg ?? "")) {
    return "Your Cloudinary Image Generation credits for this month are used up. Upgrade the add-on in the Cloudinary console or wait for the monthly reset.";
  }
  return msg ? `Cloudinary couldn't stage this photo: ${msg}` : `Cloudinary couldn't stage this photo (HTTP ${status}).`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Generates an image from one reference photo and stores it as a Cloudinary asset. */
export async function imageToImage(opts: {
  referenceAssetId: string;
  prompt: string;
  model: ModelChoice;
  aspectRatio: AspectRatio;
  resolution: "1K" | "2K";
  publicId: string;
  seed?: number;
  timeoutMs?: number;
}): Promise<{ asset: GeneratedAsset; credits: Credits }> {
  const { base, header } = auth();
  const deadline = Date.now() + (opts.timeoutMs ?? 180_000);

  const res = await fetch(`${base}/image_to_image`, {
    method: "POST",
    headers: { Authorization: header, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: opts.prompt,
      reference_images: [{ source_type: "managed_asset", asset_id: opts.referenceAssetId }],
      model: opts.model,
      image_size: { aspect_ratio: opts.aspectRatio, resolution: opts.resolution },
      format: "jpeg",
      seed: opts.seed,
      target: { target_type: "managed_asset", public_id: opts.publicId },
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 180_000),
  });
  let body = (await res.json().catch(() => ({}))) as ApiBody;
  let credits = creditsOf(body);
  if (!res.ok && res.status !== 202) throw new GenerationError(errorText(res.status, body), credits);

  // A long generation comes back as a task to poll.
  const taskId = body.data?.task_id ?? body.task_id;
  if (res.status === 202 || (taskId && !body.data?.assets?.length)) {
    if (!taskId) throw new GenerationError("Cloudinary accepted the staging but gave no task to follow.", credits);
    for (;;) {
      if (Date.now() > deadline) throw new GenerationError("Cloudinary is still staging this photo. Try again in a minute.", credits);
      await sleep(3000);
      const poll = await fetch(`${base}/tasks/${taskId}`, { headers: { Authorization: header }, cache: "no-store" });
      body = (await poll.json().catch(() => ({}))) as ApiBody;
      credits = creditsOf(body).used != null ? creditsOf(body) : credits;
      const status = body.data?.status ?? body.status;
      if (status === "failed" || (!poll.ok && poll.status !== 404)) throw new GenerationError(errorText(poll.status, body), credits);
      if (status === "completed" || body.data?.result?.assets?.length) break;
    }
  }

  const a = body.data?.assets?.[0] ?? body.data?.result?.assets?.[0];
  if (!a?.storage?.asset_id) throw new GenerationError("Cloudinary finished but didn't return the staged image.", credits);
  return {
    credits,
    asset: {
      assetId: a.storage.asset_id,
      publicId: a.storage.public_id,
      version: a.storage.version,
      width: a.width,
      height: a.height,
      bytes: a.bytes,
      format: a.format,
      model: a.model?.id ?? "unknown",
    },
  };
}
