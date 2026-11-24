import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getHouse, listPhotos, listVideos } from "@/lib/db/queries";
import { groupPhotos } from "@/lib/gallery";
import { roomFor } from "@/lib/rooms";
import { houseFacts } from "@/lib/format";
import { VideoBuilder, type BuilderPhoto } from "@/components/video-builder";

type Props = PageProps<"/houses/[houseId]/video">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const house = await getHouse((await params).houseId);
  return { title: `Listing video, ${house?.address ?? "House"}` };
}

export default function VideoPage({ params }: Props) {
  return (
    <Suspense fallback={<p className="mt-12 text-slate-soft">Loading…</p>}>
      <Builder params={params} />
    </Suspense>
  );
}

async function Builder({ params }: { params: Props["params"] }) {
  const { houseId } = await params;
  const [house, photos, videos] = await Promise.all([getHouse(houseId), listPhotos(houseId), listVideos(houseId)]);
  if (!house) notFound();

  // Gallery order (exterior first, then rooms), sorted photos only.
  const ordered = groupPhotos(photos)
    .filter((g) => g.slug !== "unsorted")
    .flatMap((g) => g.photos);
  // Start with the edited ones (staged, dusk, cleaned up); if there are none, every sorted photo.
  const edited = ordered.filter((p) => p.edited);
  const preselected = new Set((edited.length ? edited : ordered).slice(0, 8).map((p) => p.id));

  const builderPhotos: BuilderPhoto[] = ordered.map((p) => ({
    id: p.id,
    asset: p.display,
    caption: roomFor(p.room)?.label ?? (p.kind === "exterior" ? "Outside" : "Room"),
    badge: p.editType === "stage" ? "Staged" : p.editType === "dusk" ? "Dusk" : p.editType === "cleanup" ? "Cleaned up" : null,
    selected: preselected.has(p.id),
  }));

  return (
    <>
      <Link href={`/houses/${house.id}`} className="mt-8 inline-block text-sm text-slate-soft hover:text-slate">
        {house.address}
      </Link>
      <h1 className="mt-3 border-b-4 border-slate pb-5 text-[2.25rem] leading-[1.05] font-bold tracking-[-0.03em] sm:text-[3rem]">
        Listing video
      </h1>
      {builderPhotos.length ? (
        <VideoBuilder
          houseId={house.id}
          title={{ address: house.address, facts: houseFacts(house).join(", ") || house.city || "" }}
          photos={builderPhotos}
          videos={videos.map((v) => ({
            id: v.id,
            status: v.status,
            error: v.error,
            seconds: v.seconds,
            bytes: v.bytes,
            createdAt: v.createdAt,
            photoCount: v.settings.photoIds.length,
            asset: v.status === "done" && v.publicId && v.version ? { publicId: v.publicId, version: v.version } : null,
          }))}
        />
      ) : (
        <p className="mt-10 text-slate-soft">
          Mark this house&apos;s photos as interior or exterior first, then come back to make a video.{" "}
          <Link href={`/houses/${house.id}`} className="text-slate underline underline-offset-4">
            Back to the house
          </Link>
        </p>
      )}
    </>
  );
}
