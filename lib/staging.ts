import type { StageQuality } from "./db/schema";
import type { ModelChoice } from "./cloudinary/generate";
import { roomFor } from "./rooms";

// Everything that decides what a staging request says. Prompt changes go here, nowhere else.
export const PROMPT_VERSION = 1;

export type Style = { slug: string; label: string; look: string };

export const STYLES: Style[] = [
  { slug: "modern", label: "Modern", look: "clean-lined modern furniture in warm greys and natural wood, a few textured accents" },
  { slug: "scandinavian", label: "Scandinavian", look: "light oak and white furniture, soft wool and linen textiles, simple and airy" },
  { slug: "mid-century", label: "Mid-century", look: "walnut furniture with tapered legs, mustard and teal accents, low-slung pieces" },
  { slug: "farmhouse", label: "Farmhouse", look: "relaxed farmhouse furniture, reclaimed wood, cream linen, black metal accents" },
  { slug: "coastal", label: "Coastal", look: "white and sand-coloured furniture, rattan and jute, soft blue accents" },
  { slug: "luxury", label: "Luxury", look: "upscale furniture in velvet and marble, brass details, a refined neutral palette" },
  { slug: "industrial", label: "Industrial", look: "leather, dark metal and raw wood furniture, an urban loft feel" },
  { slug: "minimal", label: "Minimal", look: "very few, well-chosen pieces in white, black and natural wood, lots of open floor" },
];

// What to put in each kind of room. Keys are room slugs from lib/rooms.ts.
const FURNISHINGS: Record<string, string> = {
  "living-room": "a sofa, a coffee table, a large area rug, one or two accent chairs, a side table, a floor lamp, a plant and simple wall art",
  "family-room": "a comfortable sectional sofa, a coffee table, an area rug, a media console, a floor lamp, a plant and simple wall art",
  bedroom: "a bed with neatly made bedding and pillows, two nightstands with lamps, a dresser, an area rug and simple wall art",
  "dining-room": "a dining table with matching chairs, an area rug under the table, a sideboard and a simple centrepiece",
  kitchen: "bar stools at the island or counter if there is one, a bowl of fruit and a few tasteful counter accessories; do not change cabinets, counters or appliances",
  office: "a desk, a desk chair, a bookshelf with a few books, a desk lamp, an area rug and a plant",
  bathroom: "fresh folded towels, a bath mat, a small plant and a few simple accessories; do not change fixtures, tiles or the vanity",
  entry: "a slim console table, a mirror, a bench, a runner rug and a plant",
  laundry: "baskets, neatly folded towels and a few simple accessories; do not change the appliances",
  basement: "a sectional sofa, a coffee table, an area rug, a media console and a floor lamp",
  "other-interior": "furniture and decor that suit how this room would be used",
  back: "outdoor furniture: a patio table with chairs or a pair of lounge chairs, and potted plants",
  yard: "outdoor furniture: a patio table with chairs or a pair of lounge chairs, and potted plants",
  "other-exterior": "a little outdoor furniture and potted plants where they fit",
};

/** Rooms that can be picked for staging, in the order they're shown. */
export const STAGEABLE_ROOMS = Object.keys(FURNISHINGS)
  .map((slug) => roomFor(slug))
  .filter((r): r is NonNullable<typeof r> => !!r);

export function isStageableRoom(slug: string | null | undefined) {
  return !!slug && slug in FURNISHINGS;
}

export const QUALITY: Record<StageQuality, { label: string; detail: string; model: ModelChoice; resolution: "1K" | "2K"; estimate: number }> = {
  // estimate = credits before we've measured one; the app uses the last measured cost after that.
  draft: {
    label: "Draft",
    detail: "Quick, lower cost, 1K",
    model: { id: "nano-banana-2-lite-edit" },
    resolution: "1K",
    estimate: 4,
  },
  final: {
    label: "Final",
    detail: "Best quality, 2K",
    model: { family: "nano-banana", tier: "premium" },
    resolution: "2K",
    estimate: 14,
  },
};

export function buildStagingPrompt(opts: { room: string; style: string; notes?: string }) {
  const room = roomFor(opts.room);
  const style = STYLES.find((s) => s.slug === opts.style) ?? STYLES[0];
  const where = room?.label.toLowerCase() ?? "room";
  const furniture = FURNISHINGS[opts.room] ?? FURNISHINGS["other-interior"];
  const notes = (opts.notes ?? "").replace(/\s+/g, " ").trim().slice(0, 300);

  return [
    `Virtually stage the ${where} in [1] for a real estate listing photo, in a ${style.label.toLowerCase()} style: ${style.look}.`,
    `Add ${furniture}. Scale every piece correctly for the room and place it where a professional stager would, leaving clear walkways.`,
    notes ? `The agent asks: ${notes}.` : "",
    "Keep the room exactly as it is: the same camera angle and framing, walls and wall colour, windows and their trim, doors, ceiling, lights, floor, baseboards, outlets and vents. Do not add, move, resize or remove any window, door or wall. Only add furniture and decor.",
    "Never add people, pets, text, logos or brand names. Keep every piece of furniture fully inside the frame, not cut off at the edges.",
    "Photorealistic, natural daylight matching the photo, with consistent shadows and reflections.",
  ]
    .filter(Boolean)
    .join(" ");
}
