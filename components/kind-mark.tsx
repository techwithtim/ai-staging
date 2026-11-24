import type { PhotoKind } from "@/lib/db/schema";

// Walnut (the floor) marks interior, sky marks exterior, everywhere in the app.
export const KIND_STYLE: Record<PhotoKind, { dot: string; label: string }> = {
  interior: { dot: "bg-walnut", label: "Interior" },
  exterior: { dot: "bg-sky", label: "Exterior" },
};

export function KindMark({ kind, count }: { kind: PhotoKind; count?: number }) {
  const s = KIND_STYLE[kind];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={`size-2 rounded-full ${s.dot}`} />
      {count != null ? `${count} ${s.label.toLowerCase()}` : s.label}
    </span>
  );
}
