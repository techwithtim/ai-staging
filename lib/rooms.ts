import type { PhotoKind } from "./db/schema";

export type Room = { slug: string; label: string; kind: PhotoKind };

// Order here is the order rooms appear in a house's gallery.
export const ROOMS: Room[] = [
  { slug: "front", label: "Front", kind: "exterior" },
  { slug: "back", label: "Back", kind: "exterior" },
  { slug: "yard", label: "Yard and garden", kind: "exterior" },
  { slug: "street", label: "Street view", kind: "exterior" },
  { slug: "aerial", label: "Aerial", kind: "exterior" },
  { slug: "other-exterior", label: "Other outdoor", kind: "exterior" },
  { slug: "entry", label: "Entry and hallway", kind: "interior" },
  { slug: "living-room", label: "Living room", kind: "interior" },
  { slug: "family-room", label: "Family room", kind: "interior" },
  { slug: "kitchen", label: "Kitchen", kind: "interior" },
  { slug: "dining-room", label: "Dining room", kind: "interior" },
  { slug: "bedroom", label: "Bedroom", kind: "interior" },
  { slug: "bathroom", label: "Bathroom", kind: "interior" },
  { slug: "office", label: "Office", kind: "interior" },
  { slug: "laundry", label: "Laundry", kind: "interior" },
  { slug: "basement", label: "Basement", kind: "interior" },
  { slug: "other-interior", label: "Other room", kind: "interior" },
];

// Photos that have a kind but no room yet are grouped under these.
export const UNLABELLED: Record<PhotoKind, Room> = {
  interior: { slug: "interior", label: "Interior, room not set", kind: "interior" },
  exterior: { slug: "exterior", label: "Exterior, area not set", kind: "exterior" },
};
export const UNSORTED = { slug: "unsorted", label: "Not sorted yet" } as const;

const bySlug = new Map(ROOMS.map((r) => [r.slug, r]));

export function roomFor(slug: string | null | undefined): Room | undefined {
  return slug ? bySlug.get(slug) : undefined;
}

export function roomsFor(kind: PhotoKind): Room[] {
  return ROOMS.filter((r) => r.kind === kind);
}

/** The gallery group a photo belongs to: its room, else its kind, else unsorted. */
export function groupSlug(photo: { kind: PhotoKind | null; room: string | null }): string {
  if (!photo.kind) return UNSORTED.slug;
  const room = roomFor(photo.room);
  return room && room.kind === photo.kind ? room.slug : UNLABELLED[photo.kind].slug;
}

export function groupLabel(slug: string): string | undefined {
  if (slug === UNSORTED.slug) return UNSORTED.label;
  if (slug === "interior" || slug === "exterior") return UNLABELLED[slug].label;
  return roomFor(slug)?.label;
}
