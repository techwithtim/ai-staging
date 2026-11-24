import Image from "next/image";
import Link from "next/link";
import { Wordmark } from "@/components/brand";
import { HeroCompare } from "@/components/landing/hero-compare";
import { ToolCard, VideoCard } from "@/components/landing/tool-card";

// Every picture and the video are real results made with this app, stored in your own Cloudinary
// account under ai-staging/marketing/ (upload yours with `npm run marketing:upload`, see README).
// v1 is a fixed placeholder version so next/image gets a stable URL; Cloudinary serves the latest file.
const m = (name: string) => `v1/ai-staging/marketing/${name}`;
const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const VIDEO = `https://res.cloudinary.com/${cloud}/video/upload/q_auto/ai-staging/marketing/listing-video.mp4`;
const POSTER = `https://res.cloudinary.com/${cloud}/video/upload/so_1,w_540/f_auto/q_auto/ai-staging/marketing/listing-video.jpg`;

const primary =
  "inline-flex items-center justify-center rounded-[var(--radius-control)] bg-slate px-5 py-3 font-medium text-trim transition hover:-translate-y-px hover:bg-slate/90 active:translate-y-0";

export default function Landing() {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-wall/70 bg-trim/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5 sm:px-8">
          <Wordmark />
          <nav aria-label="Main" className="hidden gap-7 text-sm text-slate-soft md:flex">
            <a href="#tools" className="transition-colors hover:text-slate">
              Tools
            </a>
            <a href="#how" className="transition-colors hover:text-slate">
              How it works
            </a>
          </nav>
          <Link href="/houses/new" className={`${primary} ml-auto px-4 py-2 text-sm`}>
            Start a listing
          </Link>
        </div>
      </header>

      <main id="main">
        {/* Hero: what it is, who it's for, one hard fact, the work itself. */}
        <section className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
          <div className="landing-enter">
            <h1 className="text-[2.6rem] leading-[1.02] font-bold tracking-[-0.035em] text-balance sm:text-[3.6rem] lg:text-[4.1rem]">
              AI virtual staging for real estate agents
            </h1>
            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-slate-soft">
              Upload listing photos and get them back furnished, decluttered or turned to dusk, then cut into a vertical video.
              The original photo is always kept.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link href="/houses/new" className={primary}>
                Start a listing
              </Link>
              <a href="#tools" className="font-medium text-slate underline decoration-wall decoration-2 underline-offset-[6px] transition hover:decoration-slate">
                See the four tools
              </a>
            </div>
            <p className="mt-10 flex items-baseline gap-3 border-t border-wall pt-5">
              <span className="text-3xl font-bold tracking-tight">10 s</span>
              <span className="text-slate-soft">for a staged draft of an empty room</span>
            </p>
          </div>
          <div className="landing-enter [animation-delay:120ms]">
            <HeroCompare before={m("stage-before")} after={m("stage-after")} alt="Living room" />
          </div>
        </section>

        {/* The four tools, each shown by a real result. */}
        <section id="tools" aria-labelledby="tools-heading" className="scroll-mt-16 bg-slate py-24 text-trim sm:py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="max-w-2xl">
              <h2 id="tools-heading" className="text-[2.2rem] leading-[1.05] font-bold tracking-[-0.03em] sm:text-[3rem]">
                Four edits for every listing photo
              </h2>
              <p className="mt-4 text-lg text-trim/70">
                Each edit is saved as a new version beside the original, so you can compare, try again or go back.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              <ToolCard
                title="Furnishes empty rooms"
                body="Pick the room and one of eight styles. Drafts take about 10 seconds; finals come back at 2K."
                before={m("stage-before")}
                after={m("stage-after")}
                alt="Living room staged in a Scandinavian style"
              />
              <ToolCard
                title="Removes the clutter you name"
                body="Type “TV” or “bar stools” and they go, with the floor and cabinets behind them filled in."
                before={m("cleanup-before")}
                after={m("cleanup-after")}
                alt="Kitchen with the bar stools removed"
              />
              <ToolCard
                title="Turns daytime into dusk"
                body="Golden hour, dusk or night, with the windows glowing and the porch lights on."
                before={m("dusk-before")}
                after={m("dusk-after")}
                alt="Front of the house at dusk"
              />
              <VideoCard
                title="Cuts a vertical listing video"
                body="Pick the rooms and get a 1080 × 1920 MP4 with the address and room names, ready for Reels."
                src={VIDEO}
                poster={POSTER}
              />
            </div>
          </div>
        </section>

        {/* How it works: a real sequence, beside the real editor. */}
        <section id="how" aria-labelledby="how-heading" className="scroll-mt-16 py-24 sm:py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
            <div>
              <h2 id="how-heading" className="text-[2.2rem] leading-[1.05] font-bold tracking-[-0.03em] sm:text-[3rem]">
                From upload to listing in three steps
              </h2>
              <ol className="mt-10 space-y-7">
                {[
                  ["Add the house", "The address and listing details, entered once."],
                  ["Upload and sort the photos", "Drop them in, mark each one interior or exterior and give it a room."],
                  ["Edit, then download", "Choose the version for the gallery. Downloads can carry a “Virtually staged” label for listing rules."],
                ].map(([title, body], i) => (
                  <li key={title} className="grid grid-cols-[2.5rem_1fr] gap-3">
                    <span className="grid size-9 place-items-center rounded-full border-2 border-slate text-sm font-bold">{i + 1}</span>
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
                      <p className="mt-1 text-slate-soft">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="overflow-hidden rounded-[10px] border border-wall bg-white shadow-[0_30px_80px_-35px_rgba(38,44,49,0.45)]">
              <div aria-hidden className="flex items-center gap-1.5 border-b border-wall bg-plaster px-4 py-3">
                <span className="size-2.5 rounded-full bg-wall" />
                <span className="size-2.5 rounded-full bg-wall" />
                <span className="size-2.5 rounded-full bg-wall" />
              </div>
              <Image
                src="/landing/editor.webp"
                alt="The AIStaging editor with the Stage tool open on a living room"
                width={2560}
                height={1560}
                sizes="(min-width: 1024px) 700px, 100vw"
                unoptimized
                className="block h-auto w-full"
              />
            </div>
          </div>
        </section>

        {/* Close. */}
        <section aria-labelledby="close-heading" className="bg-walnut py-24 text-trim sm:py-28">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-5 sm:px-8 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <h2 id="close-heading" className="text-[2.4rem] leading-[1.02] font-bold tracking-[-0.035em] sm:text-[3.4rem]">
                Staging for your next listing
              </h2>
              <p className="mt-4 text-lg text-trim/80">Add a house, upload its photos and see the first staged room within a minute.</p>
            </div>
            <Link
              href="/houses/new"
              className="inline-flex shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-trim px-6 py-3.5 font-medium text-slate transition hover:-translate-y-px hover:bg-white active:translate-y-0"
            >
              Start a listing
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-slate py-10 text-sm text-trim/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 sm:px-8">
          <Wordmark tone="light" />
          <p>Photos, AI edits and video run on Cloudinary.</p>
        </div>
      </footer>
    </>
  );
}
