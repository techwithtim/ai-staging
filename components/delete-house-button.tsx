"use client";

import { useState, useTransition } from "react";
import { deleteHouse } from "@/app/actions";

export function DeleteHouseButton({ houseId, address, photoCount }: { houseId: string; address: string; photoCount: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const photos = photoCount ? ` and its ${photoCount} ${photoCount === 1 ? "photo" : "photos"} (also from Cloudinary)` : "";
          if (!confirm(`Delete ${address}${photos}? This can't be undone.`)) return;
          start(async () => {
            const res = await deleteHouse(houseId);
            if (res?.error) setError(res.error);
          });
        }}
        className="rounded-[var(--radius-control)] px-3 py-1.5 text-sm text-slate-soft hover:bg-plaster hover:text-alarm disabled:opacity-60"
      >
        {pending ? "Deleting house…" : "Delete house"}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-sm text-alarm">
          {error}
        </p>
      )}
    </div>
  );
}
