import { Suspense } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/brand";
import { AppNav } from "@/components/app-nav";

export default function AppLayout({ children }: LayoutProps<"/houses">) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-wall/80 bg-trim/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5 sm:px-8">
          <Wordmark href="/houses" />
          <Suspense
            fallback={
              <nav aria-label="App" className="hidden text-sm sm:block">
                <Link href="/houses" className="font-medium text-slate-soft">
                  Houses
                </Link>
              </nav>
            }
          >
            <AppNav />
          </Suspense>
          <Link
            href="/houses/new"
            className="ml-auto rounded-[var(--radius-control)] bg-slate px-3.5 py-2 text-sm font-medium text-trim transition hover:-translate-y-px hover:bg-slate/90 active:translate-y-0"
          >
            New house
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-5 pb-28 sm:px-8">
        {children}
      </main>
    </>
  );
}
