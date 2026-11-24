import type { Photo, PhotoKind } from "./db/schema";
import { groupLabel, groupSlug, ROOMS, UNLABELLED, UNSORTED } from "./rooms";

export type Group<P extends Photo = Photo> = { slug: string; label: string; kind: PhotoKind | null; photos: P[] };

// Unsorted photos first (they need a decision), then exterior, then interior, each in ROOMS order.
const ORDER = [
  UNSORTED.slug,
  UNLABELLED.exterior.slug,
  ...ROOMS.filter((r) => r.kind === "exterior").map((r) => r.slug),
  UNLABELLED.interior.slug,
  ...ROOMS.filter((r) => r.kind === "interior").map((r) => r.slug),
];

function kindOf(slug: string): PhotoKind | null {
  if (slug === UNSORTED.slug) return null;
  if (slug === "interior" || slug === "exterior") return slug;
  return ROOMS.find((r) => r.slug === slug)?.kind ?? null;
}

export function groupPhotos<P extends Photo>(photos: P[]): Group<P>[] {
  const map = new Map<string, P[]>();
  for (const p of photos) {
    const slug = groupSlug(p);
    map.set(slug, [...(map.get(slug) ?? []), p]);
  }
  return ORDER.filter((slug) => map.has(slug)).map((slug) => ({
    slug,
    label: groupLabel(slug)!,
    kind: kindOf(slug),
    photos: map.get(slug)!,
  }));
}

export function isGroupSlug(slug: string) {
  return ORDER.includes(slug);
}
