"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppNav() {
  const path = usePathname();
  const onHouses = path === "/houses" || (path.startsWith("/houses/") && path !== "/houses/new");
  return (
    <nav aria-label="App" className="hidden text-sm sm:block">
      <Link
        href="/houses"
        aria-current={onHouses ? "page" : undefined}
        className={`relative py-5 font-medium transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:origin-left after:bg-slate after:transition-transform ${
          onHouses ? "text-slate after:scale-x-100" : "text-slate-soft after:scale-x-0 hover:text-slate hover:after:scale-x-100"
        }`}
      >
        Houses
      </Link>
    </nav>
  );
}
