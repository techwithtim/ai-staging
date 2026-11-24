import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGenerationBudget, getHouse, getPhoto, listEdits } from "@/lib/db/queries";
import type { CleanupParams, DuskParams, StageParams } from "@/lib/db/schema";
import { moodFor } from "@/lib/dusk";
import { groupLabel, groupSlug, roomFor } from "@/lib/rooms";
import { isStageableRoom, QUALITY, STYLES } from "@/lib/staging";
import { PhotoEditor, type EditorEdit, type Tool } from "@/components/photo-editor";

type Props = PageProps<"/houses/[houseId]/photos/[photoId]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { photoId } = await params;
  const photo = await getPhoto(photoId);
  return { title: photo ? `Edit ${groupLabel(groupSlug(photo))?.toLowerCase() ?? "photo"}` : "Photo" };
}

export default function PhotoPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<p className="mt-12 text-slate-soft">Loading photo…</p>}>
      <Editor params={params} searchParams={searchParams} />
    </Suspense>
  );
}

function describe(e: Awaited<ReturnType<typeof listEdits>>[number]): string {
  if (e.type === "dusk") {
    const p = e.params as DuskParams;
    const lights = [p.windowsLit && "lights on", p.outdoorLights && "outdoor lights"].filter(Boolean).join(", ");
    return `${moodFor(p.mood)?.label ?? "Dusk"}${lights ? `, ${lights}` : ""}, ${QUALITY[p.quality].label.toLowerCase()}`;
  }
  if (e.type === "stage") {
    const p = e.params as StageParams;
    const style = STYLES.find((s) => s.slug === p.style)?.label ?? p.style;
    const room = roomFor(p.room)?.label.toLowerCase() ?? "room";
    return `${style} ${room}, ${QUALITY[p.quality].label.toLowerCase()}${p.notes ? `: ${p.notes}` : ""}`;
  }
  const p = e.params as CleanupParams;
  return `${e.status === "failed" ? "Tried to remove" : "Removed"} ${p.items.join(", ")}`;
}

async function Editor({ params, searchParams }: { params: Props["params"]; searchParams: Props["searchParams"] }) {
  const [{ houseId, photoId }, query] = await Promise.all([params, searchParams]);
  const [house, photo, edits, budget] = await Promise.all([
    getHouse(houseId),
    getPhoto(photoId),
    listEdits(photoId),
    getGenerationBudget(),
  ]);
  if (!house || !photo || photo.houseId !== house.id) notFound();

  const group = groupSlug(photo);
  const tool: Tool = query.tool === "stage" || query.tool === "dusk" ? query.tool : "cleanup";
  // ?v=<version id> opens that version; otherwise the gallery version.
  const asked = typeof query.v === "string" ? edits.find((e) => e.id === query.v && e.status === "done") : undefined;
  const defaultRoom = isStageableRoom(photo.room) ? photo.room! : photo.kind === "exterior" ? "back" : "living-room";

  const editorEdits: EditorEdit[] = edits.map((e) => ({
    id: e.id,
    type: e.type,
    sourceEditId: e.sourceEditId,
    detail: describe(e),
    status: e.status,
    error: e.error,
    creditsUsed: e.creditsUsed,
    asset:
      e.status === "done" && e.publicId
        ? { publicId: e.publicId, version: e.version!, format: e.format!, width: e.width!, height: e.height! }
        : null,
  }));

  return (
    <>
      <nav aria-label="Breadcrumb" className="mt-8 text-sm text-slate-soft">
        <Link href={`/houses/${house.id}`} className="hover:text-slate">
          {house.address}
        </Link>
        <span aria-hidden className="mx-2">
          /
        </span>
        <Link href={`/houses/${house.id}/rooms/${group}`} className="hover:text-slate">
          {groupLabel(group)}
        </Link>
      </nav>
      <h1 className="mt-3 border-b-4 border-slate pb-5 text-[2.25rem] leading-[1.05] font-bold tracking-[-0.03em] sm:text-[3rem]">
        {roomFor(photo.room)?.label ?? (photo.kind === "exterior" ? "Exterior" : photo.kind === "interior" ? "Interior" : "Photo")}
      </h1>
      <PhotoEditor
        key={photo.id}
        initialTool={tool}
        initialVersion={asked?.id ?? null}
        photo={{
          id: photo.id,
          kind: photo.kind,
          name: photo.originalFilename ?? "Listing photo",
          original: {
            publicId: photo.publicId,
            version: photo.version,
            format: photo.format,
            width: photo.width,
            height: photo.height,
          },
          activeEditId: photo.edited ? photo.activeEditId : null,
          defaultRoom,
        }}
        edits={editorEdits}
        budget={budget}
      />
    </>
  );
}
