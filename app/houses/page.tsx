import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { listHouses, type HouseSummary } from "@/lib/db/queries";
import { imageSrc } from "@/lib/cloudinary/urls";
import { houseFacts, photoCount } from "@/lib/format";
import { KindMark } from "@/components/kind-mark";

export const metadata: Metadata = { title: "Houses" };

export default function HousesPage() {
  return (
    <>
      <div className="mt-12 mb-10 flex flex-wrap items-end justify-between gap-4 border-b-4 border-slate pb-5">
        <h1 className="text-[2.5rem] leading-none font-bold tracking-[-0.035em] sm:text-[3.25rem]">Houses</h1>
        <p className="text-slate-soft">Each house keeps its photos, edits and videos together.</p>
      </div>
      <Suspense fallback={<p className="text-slate-soft">Loading houses…</p>}>
        <HouseList />
      </Suspense>
    </>
  );
}

async function HouseList() {
  const houses = await listHouses();
  if (!houses.length) return <EmptyState />;
  return (
    <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      {houses.map((h, i) => (
        <li key={h.id}>
          <HouseCard house={h} priority={i < 3} />
        </li>
      ))}
    </ul>
  );
}

function HouseCard({ house, priority }: { house: HouseSummary; priority: boolean }) {
  const facts = houseFacts(house);
  const unsorted = house.total - house.interior - house.exterior;
  return (
    <Link href={`/houses/${house.id}`} className="group block">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[10px] bg-plaster shadow-[0_18px_40px_-28px_rgba(38,44,49,0.7)] transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_26px_50px_-28px_rgba(38,44,49,0.75)]">
        {house.cover ? (
          <Image
            src={imageSrc(house.cover)}
            alt=""
            fill
            priority={priority}
            sizes="(min-width: 1024px) 352px, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-sm text-slate-soft">Add photos to see them here</span>
        )}
        <span className="absolute bottom-3 left-3 rounded-full bg-trim/90 px-2.5 py-1 text-sm font-medium text-slate backdrop-blur">
          {photoCount(house.total)}
        </span>
      </div>
      <p className="mt-4 text-xl leading-tight font-bold tracking-[-0.02em] group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">
        {house.address}
      </p>
      {(house.city || facts.length > 0) && (
        <p className="mt-1 text-slate-soft">{[house.city, ...facts].filter(Boolean).join(", ")}</p>
      )}
      <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {house.interior > 0 && <KindMark kind="interior" count={house.interior} />}
        {house.exterior > 0 && <KindMark kind="exterior" count={house.exterior} />}
        {unsorted > 0 && <span className="text-slate-soft">{unsorted} to sort</span>}
      </p>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="grid gap-8 rounded-[10px] border border-wall bg-white p-8 sm:grid-cols-[1fr_auto] sm:items-center sm:p-10">
      <div>
        <p className="text-2xl font-bold tracking-[-0.02em]">Add your first house</p>
        <p className="mt-2 max-w-md text-slate-soft">
          Start with the address, then upload its listing photos. Stage, clean up, turn to dusk and make a video from there.
        </p>
      </div>
      <Link
        href="/houses/new"
        className="inline-flex items-center justify-center rounded-[var(--radius-control)] bg-slate px-5 py-3 font-medium text-trim transition hover:-translate-y-px hover:bg-slate/90 active:translate-y-0"
      >
        Add a house
      </Link>
    </div>
  );
}
