import Link from "next/link";

/** The mark: one square split walnut and sky, the app's interior and exterior colours. */
export function Wordmark({ href = "/", tone = "dark" }: { href?: string; tone?: "dark" | "light" }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2.5 text-[17px] font-bold tracking-[-0.02em] ${tone === "light" ? "text-trim" : "text-slate"}`}
    >
      <span aria-hidden className="grid size-6 grid-cols-2 overflow-hidden rounded-[5px]">
        <span className="bg-walnut" />
        <span className="bg-sky" />
      </span>
      AIStaging
    </Link>
  );
}
