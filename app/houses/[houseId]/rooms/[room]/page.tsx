import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getHouse, listPhotos } from "@/lib/db/queries";
import { groupPhotos, isGroupSlug } from "@/lib/gallery";
import { groupLabel } from "@/lib/rooms";
import { PhotoTile } from "@/components/photo-tile";
import { KindMark } from "@/components/kind-mark";

type Props = PageProps<"/houses/[houseId]/rooms/[room]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { houseId, room } = await params;
  const house = await getHouse(houseId);
  return { title: `${groupLabel(room) ?? "Room"}, ${house?.address ?? "House"}` };
}

export default function RoomPage({ params }: Props) {
  return (
    <Suspense fallback={<p className="mt-12 text-slate-soft">Loading room…</p>}>
      <Room params={params} />
    </Suspense>
  );
}

async function Room({ params }: { params: Props["params"] }) {
  const { houseId, room } = await params;
  if (!isGroupSlug(room)) notFound();
  const [house, photos] = await Promise.all([getHouse(houseId), listPhotos(houseId)]);
  if (!house) notFound();

  const groups = groupPhotos(photos);
  const index = groups.findIndex((g) => g.slug === room);
  const group = groups[index];
  const prev = index > 0 ? groups[index - 1] : null;
  const next = index >= 0 && index < groups.length - 1 ? groups[index + 1] : null;

  return (
    <>
      <Link href={`/houses/${house.id}`} className="mt-8 inline-block text-sm text-slate-soft hover:text-slate">
        {house.address}
      </Link>
      <header className="mt-3 flex flex-wrap items-end justify-between gap-4 border-b-4 border-slate pb-5">
        <h1 className="text-[2.25rem] leading-[1.05] font-bold tracking-[-0.03em] sm:text-[3rem]">
          {groupLabel(room)}
        </h1>
        <p className="flex items-center gap-4 text-slate-soft">
          {group?.kind && <KindMark kind={group.kind} />}
          <span>
            {group?.photos.length ?? 0} {group?.photos.length === 1 ? "photo" : "photos"}
          </span>
        </p>
      </header>

      {group ? (
        <ul className="mt-8 grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2">
          {group.photos.map((p, i) => (
            <li key={p.id}>
              <PhotoTile photo={p} priority={i < 2} sizes="(min-width: 768px) 536px, 100vw" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 text-slate-soft">
          No photos are in this room any more.{" "}
          <Link href={`/houses/${house.id}`} className="text-slate underline underline-offset-4">
            Back to the house
          </Link>
        </p>
      )}

      {(prev || next) && (
        <nav aria-label="Other rooms" className="mt-16 flex justify-between gap-4 border-t border-wall pt-5">
          {prev ? (
            <Link href={`/houses/${house.id}/rooms/${prev.slug}`} className="group">
              <span className="block text-sm text-slate-soft">Previous room</span>
              <span className="font-medium group-hover:underline group-hover:underline-offset-4">{prev.label}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/houses/${house.id}/rooms/${next.slug}`} className="group text-right">
              <span className="block text-sm text-slate-soft">Next room</span>
              <span className="font-medium group-hover:underline group-hover:underline-offset-4">{next.label}</span>
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
