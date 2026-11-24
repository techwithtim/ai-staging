import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { assertConfigured } from "./server";

// Cleanup = Cloudinary generative remove (e_gen_remove), applied to one version of a photo.
// Each run counts as 50 transformations (cloudinary.com/documentation/transformation_counts).
export const CLEANUP_COST_TRANSFORMATIONS = 50;
export const MAX_ITEMS = 6;

/** Keeps a prompt to plain words so it can't break out of the transformation syntax. */
export function cleanItem(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9 '\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

function singular(word: string) {
  if (/(ss|us|is)$/.test(word) || word.length < 4) return word;
  if (/ies$/.test(word)) return word.slice(0, -3) + "y";
  if (/(ches|shes|xes|zes|sses)$/.test(word)) return word.slice(0, -2);
  if (/s$/.test(word)) return word.slice(0, -1);
  return word;
}

/**
 * Turns what the agent typed into the prompts Cloudinary detects best: singular nouns, one object
 * each. Tested on a kitchen: "bar stools" removed 1 of 3 stools; "bar stool" with multiple_true removed all 3.
 */
export function toPrompts(items: string[]) {
  const out = new Set<string>();
  for (const item of items) {
    for (const part of cleanItem(item).split(/\s+and\s+/)) {
      const words = part.trim().split(" ");
      if (!words[0]) continue;
      words[words.length - 1] = singular(words[words.length - 1]);
      out.add(words.join(" "));
    }
  }
  return [...out];
}

/**
 * e_gen_remove:prompt_(a;b)[;remove-shadow_true]/q_NN
 * One prompt gets multiple_true so every instance goes; with several prompts Cloudinary removes every
 * instance of each anyway. Results vary run to run but Cloudinary caches each URL, so a retry changes
 * the output quality by a point (q_95, q_94, …) to ask for a fresh render.
 */
export function cleanupTransformation(prompts: string[], removeShadow: boolean, attempt = 0) {
  const p = prompts.map((i) => encodeURIComponent(i));
  const prompt = p.length === 1 ? `prompt_${p[0]};multiple_true` : `prompt_(${p.join(";")})`;
  const quality = 95 - (attempt % 10);
  return `e_gen_remove:${prompt}${removeShadow ? ";remove-shadow_true" : ""}/q_${quality}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Renders the cleanup on Cloudinary, then stores the result as a new asset so later edits
 * and staging can start from it. Cloudinary answers 423 while it is still generating.
 */
export async function renderCleanup(opts: {
  source: { publicId: string; version: number };
  transformation: string;
  destPublicId: string;
  assetFolder: string;
  tags: string[];
  timeoutMs?: number;
}) {
  assertConfigured();
  const cloud = cloudinary.config().cloud_name;
  const url = `https://res.cloudinary.com/${cloud}/image/upload/${opts.transformation}/v${opts.source.version}/${opts.source.publicId}.jpg`;

  const deadline = Date.now() + (opts.timeoutMs ?? 150_000);
  for (;;) {
    const res = await fetch(url, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(60_000) });
    if (res.ok) {
      await res.arrayBuffer(); // the derived image now exists; let Cloudinary copy it from here
      break;
    }
    if (res.status !== 423) {
      const why = res.headers.get("x-cld-error");
      throw new Error(
        why ? `Cloudinary couldn't clean up this photo: ${why}` : `Cloudinary couldn't clean up this photo (HTTP ${res.status}).`,
      );
    }
    if (Date.now() > deadline) throw new Error("Cloudinary is still working on this cleanup. Try again in a minute.");
    await sleep(2500);
  }

  return cloudinary.uploader.upload(url, {
    public_id: opts.destPublicId,
    asset_folder: opts.assetFolder,
    tags: opts.tags,
    overwrite: false,
  });
}
