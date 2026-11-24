"use client";

import { useActionState } from "react";
import { createHouse, type HouseFormState } from "@/app/actions";

const input =
  "mt-1.5 block w-full rounded-[var(--radius-control)] border border-wall bg-white px-3 py-2.5 text-base text-slate placeholder:text-slate-soft/60 focus:border-slate focus:outline-none";

export function HouseForm() {
  const [state, action, pending] = useActionState<HouseFormState, FormData>(createHouse, {});
  const v = state.fields ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      <label className="block">
        <span className="font-medium">Street address</span>
        <input
          name="address"
          required
          autoFocus
          autoComplete="off"
          defaultValue={v.address}
          placeholder="48 Larch Street"
          className={`${input} text-lg`}
          aria-invalid={state.error?.includes("address") || undefined}
          aria-describedby={state.error ? "form-error" : undefined}
        />
      </label>
      <label className="block">
        <span className="font-medium">City</span>
        <input name="city" defaultValue={v.city} autoComplete="off" placeholder="Halifax, NS" className={input} />
      </label>

      <fieldset className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <legend className="mb-1.5 font-medium">Listing details</legend>
        <Num name="beds" label="Bedrooms" value={v.beds} step="1" />
        <Num name="baths" label="Bathrooms" value={v.baths} step="0.5" />
        <Num name="sqft" label="Square feet" value={v.sqft} step="1" />
        <Num name="price" label="Price" value={v.price} step="1000" />
      </fieldset>

      {state.error && (
        <p id="form-error" role="alert" className="text-alarm">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-[var(--radius-control)] bg-slate px-5 py-2.5 font-medium text-trim hover:bg-slate/90 active:translate-y-px disabled:opacity-60"
      >
        {pending ? "Creating house…" : "Create house"}
      </button>
    </form>
  );
}

function Num({ name, label, value, step }: { name: string; label: string; value?: string; step: string }) {
  return (
    <label className="block">
      <span className="text-sm text-slate-soft">{label}</span>
      <input name={name} type="number" min="0" step={step} inputMode="decimal" defaultValue={value} className={input} />
    </label>
  );
}
