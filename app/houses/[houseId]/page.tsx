import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getHouse, listPhotos, type GalleryPhoto } from "@/lib/db/queries";
import { groupPhotos, type Group } from "@/lib/gallery";
import { houseFacts, photoCount } from "@/lib/format";
import { UploadPanel } from "@/components/upload-panel";
import { PhotoTile } from "@/components/photo-tile";
import { KIND_STYLE } from "@/components/kind-mark";
import { DeleteHouseButton } from "@/components/delete-house-button";

export async function generateMetadata({ params }: PageProps<"/houses/[houseId]">): Promise<Metadata> {
  const house = await getHouse((await params).houseId);
  return { title: house?.address ?? "House" };
}

export default function HousePage({ params }: PageProps<"/houses/[houseId]">) {
  return (
    <Suspense fallback={<p className="mt-12 text-slate-soft">Loading house…</p>}>
      <House params={params} />
    </Suspense>
  );
}

async function House({ params }: { params: PageProps<"/houses/[houseId]">["params"] }) {
  const { houseId } = await params;
  const [house, photos] = await Promise.all([getHouse(houseId), listPhotos(houseId)]);
  if (!house) notFound();

  const groups = groupPhotos(photos);
  const facts = houseFacts(house);

  return (
    <>
      <Link href="/houses" className="mt-8 inline-block text-sm text-slate-soft hover:text-slate">
        All houses
      </Link>

      <header className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b-4 border-slate pb-5">
        <div className="min-w-0">
          <h1 className="text-[2.5rem] leading-[1.02] font-bold tracking-[-0.03em] text-balance sm:text-[3.75rem]">
            {house.address}
          </h1>
          {(house.city || facts.length > 0) && (
            <p className="mt-3 text-lg text-slate-soft">{[house.city, ...facts].filter(Boolean).join(", ")}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {photos.length > 0 && (
            <Link
              href={`/houses/${house.id}/video`}
              className="rounded-[var(--radius-control)] bg-slate px-3.5 py-2 text-sm font-medium text-trim hover:bg-slate/90"
            >
              Make a listing video
            </Link>
          )}
          <DeleteHouseButton houseId={house.id} address={house.address} photoCount={photos.length} />
        </div>
      </header>

      <UploadPanel houseId={house.id} />

      {groups.length > 0 ? (
        <>
          <RoomIndex houseId={house.id} groups={groups} total={photos.length} />
          {groups.map((g, i) => (
            <GroupSection key={g.slug} houseId={house.id} group={g} first={i === 0} />
          ))}
        </>
      ) : (
        <p className="mt-12 text-slate-soft">
          No photos yet. Add them above and they&apos;ll be grouped here by room.
        </p>
      )}
    </>
  );
}

function RoomIndex({ houseId, groups, total }: { houseId: string; groups: Group<GalleryPhoto>[]; total: number }) {
  return (
    <nav aria-label="Rooms" className="mt-14">
      <h2 className="text-lg font-semibold tracking-tight">
        Rooms <span className="font-normal text-slate-soft">{photoCount(total)}</span>
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {groups.map((g) => (
          <li key={g.slug}>
            <Link
              href={`/houses/${houseId}/rooms/${g.slug}`}
              className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-wall bg-white px-3 py-1.5 text-sm hover:border-slate"
            >
              <span
                aria-hidden
                className={`size-2 rounded-full ${g.kind ? KIND_STYLE[g.kind].dot : "border border-slate-soft"}`}
              />
              {g.kind && <span className="sr-only">{KIND_STYLE[g.kind].label}:</span>}
              <span className="font-medium">{g.label}</span>
              <span className="text-slate-soft">{g.photos.length}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function GroupSection({ houseId, group, first }: { houseId: string; group: Group<GalleryPhoto>; first: boolean }) {
  return (
    <section aria-labelledby={`g-${group.slug}`} className="mt-12">
      <div className="flex items-baseline justify-between gap-4 border-b border-wall pb-2">
        <h2 id={`g-${group.slug}`} className="text-xl font-semibold tracking-tight">
          {group.label} <span className="font-normal text-slate-soft">{group.photos.length}</span>
        </h2>
        <Link
          href={`/houses/${houseId}/rooms/${group.slug}`}
          className="shrink-0 text-sm text-slate-soft underline-offset-4 hover:text-slate hover:underline"
        >
          Open {group.slug === "unsorted" ? "unsorted photos" : group.label.toLowerCase()}
        </Link>
      </div>
      {group.slug === "unsorted" && (
        <p className="mt-3 text-slate-soft">Mark each one interior or exterior, or pick its room.</p>
      )}
      <ul className="mt-5 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {group.photos.map((p, i) => (
          <li key={p.id}>
            <PhotoTile
              photo={p}
              priority={first && i < 3}
              sizes="(min-width: 1024px) 352px, (min-width: 640px) 50vw, 100vw"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
