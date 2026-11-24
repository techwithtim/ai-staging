import type { Metadata } from "next";
import Link from "next/link";
import { HouseForm } from "./house-form";

export const metadata: Metadata = { title: "New house" };

export default function NewHousePage() {
  return (
    <div className="max-w-xl">
      <Link href="/houses" className="mt-8 inline-block text-sm text-slate-soft hover:text-slate">
        Back to houses
      </Link>
      <h1 className="mt-4 mb-2 text-[2rem] leading-tight font-semibold tracking-tight">New house</h1>
      <p className="mb-8 text-slate-soft">Only the address is required. Add the rest now or leave it for later.</p>
      <HouseForm />
    </div>
  );
}
